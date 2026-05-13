import Anthropic from "@anthropic-ai/sdk";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { transactions, categoriesV2, sources, months } from "@/db/schema";
import { listSources } from "@/lib/source-service";
import {
  getCategoryBreakdown,
  getMonthlyTrend,
  getMonthSummary,
} from "@/lib/budget-service";
import { listGoals } from "@/lib/goal-service";
import { sumInCurrency } from "@/lib/fx";
import { getCurrentYearMonth, isValidYearMonth } from "@/lib/month";
import { listGroups, getGroupBalances, isGroupMember } from "@/lib/group-service";
import { listFriends } from "@/lib/friend-service";
import { getOverallBalances } from "@/lib/settlement-service";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MODEL = "claude-sonnet-4-6";
const MAX_TOOL_TURNS = 6;

export type ChatMessage = { role: "user" | "assistant"; content: string };

const TOOLS: Anthropic.Tool[] = [
  {
    name: "get_total_balance",
    description: "Sum of balances across all the user's sources, optionally converted to a target currency (default = user's default currency).",
    input_schema: {
      type: "object",
      properties: {
        currency: { type: "string", description: "ISO 4217 currency code to roll up into (e.g. PKR, USD). Optional." },
      },
    },
  },
  {
    name: "get_sources",
    description: "List all the user's sources (accounts) with current balance and currency.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_month_summary",
    description: "For a specific YYYY-MM, return totals: income, budgeted, spent, remaining, savings rate.",
    input_schema: {
      type: "object",
      properties: {
        year_month: { type: "string", description: "Month as YYYY-MM. Defaults to current month if omitted." },
      },
    },
  },
  {
    name: "get_spending_by_category",
    description: "For a YYYY-MM, return each category's budget and spend.",
    input_schema: {
      type: "object",
      properties: {
        year_month: { type: "string", description: "Month as YYYY-MM. Defaults to current month." },
        top_n: { type: "number", description: "Limit to top-N by spend. Optional." },
      },
    },
  },
  {
    name: "get_recent_transactions",
    description: "Return the user's most recent transactions.",
    input_schema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Number of transactions (default 10, max 50)." },
        kind: { type: "string", enum: ["income", "expense", "transfer"], description: "Optional kind filter." },
      },
    },
  },
  {
    name: "get_goals",
    description: "List the user's savings goals with progress %.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_monthly_trend",
    description: "Income vs expense for the last N months.",
    input_schema: {
      type: "object",
      properties: {
        count: { type: "number", description: "How many months (default 6)." },
      },
    },
  },
  {
    name: "compare_months",
    description: "Compare totals between two months. Returns income/expense delta.",
    input_schema: {
      type: "object",
      properties: {
        from_year_month: { type: "string" },
        to_year_month: { type: "string" },
      },
      required: ["from_year_month", "to_year_month"],
    },
  },
  {
    name: "get_groups",
    description: "List the user's groups (Splitwise-style shared expense groups), with the user's net balance per group.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_friends",
    description: "List the user's friends (1-to-1 split relationships) with balance per currency.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_group_balances",
    description: "For a given group ID, return both raw pairwise balances and the simplified-debts settlement plan, per currency.",
    input_schema: {
      type: "object",
      properties: {
        group_id: { type: "number" },
      },
      required: ["group_id"],
    },
  },
  {
    name: "get_overall_balances",
    description: "Across all groups and friends, return who owes the user and whom the user owes, per currency.",
    input_schema: { type: "object", properties: {} },
  },
];

async function resolveMonthId(userId: string, yearMonth?: string): Promise<number | null> {
  const ym = yearMonth && isValidYearMonth(yearMonth) ? yearMonth : getCurrentYearMonth();
  const [m] = await db
    .select({ id: months.id })
    .from(months)
    .where(and(eq(months.userId, userId), eq(months.yearMonth, ym)))
    .limit(1);
  return m?.id ?? null;
}

async function runTool(userId: string, name: string, input: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case "get_total_balance": {
      const targetCurrency = (input.currency as string | undefined) ?? "PKR";
      const list = await listSources(userId, false);
      const byCurr: Record<string, number> = {};
      for (const s of list) byCurr[s.currency] = (byCurr[s.currency] ?? 0) + s.balance;
      const total = await sumInCurrency(
        Object.entries(byCurr).map(([c, a]) => ({ currency: c, amount: a })),
        targetCurrency
      );
      return { total: Math.round(total * 100) / 100, currency: targetCurrency, by_currency: byCurr };
    }
    case "get_sources": {
      const list = await listSources(userId, false);
      return list.map((s) => ({
        id: s.id,
        name: s.name,
        type: s.type,
        currency: s.currency,
        balance: Math.round(s.balance * 100) / 100,
      }));
    }
    case "get_month_summary": {
      const monthId = await resolveMonthId(userId, input.year_month as string);
      if (!monthId) return { error: "No data for that month." };
      const s = await getMonthSummary(userId, monthId);
      return s;
    }
    case "get_spending_by_category": {
      const monthId = await resolveMonthId(userId, input.year_month as string);
      if (!monthId) return [];
      const rows = await getCategoryBreakdown(userId, monthId);
      const sorted = rows.slice().sort((a, b) => b.spent - a.spent);
      const topN = Math.min(Number(input.top_n) || 100, 100);
      return sorted.slice(0, topN).map((r) => ({
        category: r.name,
        budgeted: r.budgetedAmount,
        spent: r.spent,
        percent: r.budgetedAmount > 0 ? Math.round((r.spent / r.budgetedAmount) * 100) : null,
      }));
    }
    case "get_recent_transactions": {
      const limit = Math.min(Math.max(1, Number(input.limit) || 10), 50);
      const kind = input.kind as "income" | "expense" | "transfer" | undefined;
      const rows = await db
        .select({
          id: transactions.id,
          kind: transactions.kind,
          amount: transactions.amount,
          currency: transactions.currency,
          occurredAt: transactions.occurredAt,
          description: transactions.description,
          sourceName: sources.name,
          categoryName: categoriesV2.name,
        })
        .from(transactions)
        .innerJoin(sources, eq(transactions.sourceId, sources.id))
        .leftJoin(categoriesV2, eq(transactions.categoryId, categoriesV2.id))
        .where(
          kind
            ? and(eq(transactions.userId, userId), eq(transactions.kind, kind))
            : eq(transactions.userId, userId)
        )
        .orderBy(desc(transactions.occurredAt), desc(transactions.id))
        .limit(limit);
      return rows.map((r) => ({
        kind: r.kind,
        amount: parseFloat(r.amount),
        currency: r.currency,
        date: r.occurredAt.toISOString().slice(0, 10),
        description: r.description,
        source: r.sourceName,
        category: r.categoryName,
      }));
    }
    case "get_goals": {
      const list = await listGoals(userId);
      return list.map((g) => ({
        name: g.name,
        target: g.targetAmount,
        current: g.currentAmount,
        currency: g.currency,
        percent: Math.round(g.percent),
        deadline: g.deadline,
        eta_months: g.etaMonths,
        completed: !!g.completedAt,
      }));
    }
    case "get_monthly_trend": {
      const count = Math.min(Math.max(1, Number(input.count) || 6), 24);
      const rows = await getMonthlyTrend(userId, count);
      return rows.map((r) => ({
        month: r.label,
        year_month: r.yearMonth,
        income: r.income,
        expenses: r.expenses,
        net: r.income - r.expenses,
      }));
    }
    case "compare_months": {
      const fromId = await resolveMonthId(userId, input.from_year_month as string);
      const toId = await resolveMonthId(userId, input.to_year_month as string);
      if (!fromId || !toId) return { error: "One or both months have no data." };
      const [a, b] = await Promise.all([getMonthSummary(userId, fromId), getMonthSummary(userId, toId)]);
      return {
        from: { ...a, year_month: input.from_year_month },
        to: { ...b, year_month: input.to_year_month },
        delta: {
          income: b.totalIncome - a.totalIncome,
          spent: b.totalSpent - a.totalSpent,
          savings: (b.totalIncome - b.totalSpent) - (a.totalIncome - a.totalSpent),
        },
      };
    }
    case "get_groups": {
      const list = await listGroups(userId, false);
      return list.map((g) => ({
        id: g.id,
        name: g.name,
        members: g.memberCount,
        currency: g.defaultCurrency,
        net_balance: g.netBalance,
      }));
    }
    case "get_friends": {
      const list = await listFriends(userId);
      return list.map((f) => ({
        friend_user_id: f.friendUserId,
        name: f.fullName ?? f.email.split("@")[0],
        email: f.email,
        balance_by_currency: f.balanceByCurrency,
      }));
    }
    case "get_group_balances": {
      const groupId = Number(input.group_id);
      if (!groupId || !(await isGroupMember(userId, groupId))) {
        return { error: "Not a member of that group" };
      }
      const views = await getGroupBalances(groupId);
      return views.map((v) => ({
        currency: v.currency,
        raw: v.pairs,
        simplified: v.simplified,
        net: v.netByUser.map((n) => ({ email: n.email, name: n.fullName, net: n.net })),
      }));
    }
    case "get_overall_balances": {
      const entries = await getOverallBalances(userId);
      return entries.map((e) => ({
        counterparty: e.name,
        email: e.email,
        context: e.context,
        source: e.source,
        currency: e.currency,
        amount: e.amount, // positive: owed to you; negative: you owe
      }));
    }
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

const SYSTEM = `You are Pocket's friendly financial assistant. You have read-only access to the user's accounts, transactions, budgets, goals, groups, friends, and shared-expense balances via tools. Answer concisely in plain language. Use specific numbers from the data. If the user asks about a time period and you don't have data for it, say so. Never invent numbers. Format currency like "PKR 12,500" with thousands separators. When the user asks about "owes" / "owed" or settling up, use the balance tools. Current date: ${new Date().toISOString().slice(0, 10)}.`;

export async function chat(userId: string, messages: ChatMessage[]): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return "AI is not configured yet. Set ANTHROPIC_API_KEY in .env.local to enable the assistant.";
  }

  const apiMessages: Anthropic.MessageParam[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM,
      tools: TOOLS,
      messages: apiMessages,
    });

    const toolUses = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    if (toolUses.length === 0) {
      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      return text || "(no response)";
    }

    // Append the assistant message with tool_use blocks, then run each tool and append results.
    apiMessages.push({ role: "assistant", content: response.content });

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const tu of toolUses) {
      try {
        const result = await runTool(userId, tu.name, (tu.input ?? {}) as Record<string, unknown>);
        toolResults.push({
          type: "tool_result",
          tool_use_id: tu.id,
          content: JSON.stringify(result),
        });
      } catch (err) {
        toolResults.push({
          type: "tool_result",
          tool_use_id: tu.id,
          content: `Error: ${err instanceof Error ? err.message : String(err)}`,
          is_error: true,
        });
      }
    }
    apiMessages.push({ role: "user", content: toolResults });
  }

  return "I had to stop after several tool calls — try asking something more specific?";
}
