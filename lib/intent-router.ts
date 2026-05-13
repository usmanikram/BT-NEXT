/**
 * Heuristic intent router for the Pocket assistant.
 *
 * No LLM. Pattern-matches the user's question against a small set of intents and dispatches
 * to existing service functions. First match wins; if nothing matches, returns a help string
 * with the supported question shapes.
 *
 * Trade-off vs an LLM: doesn't handle paraphrases gracefully, but is free, instant, fully
 * offline, deterministic, and never invents numbers.
 */
import { and, desc, eq, ilike } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  users,
  months,
  transactions,
  sources as sourcesTable,
  categoriesV2,
} from "@/db/schema";
import { listSources } from "@/lib/source-service";
import {
  getCategoryBreakdown,
  getMonthlyTrend,
  getMonthSummary,
} from "@/lib/budget-service";
import { listGoals } from "@/lib/goal-service";
import { sumInCurrency } from "@/lib/fx";
import { listGroups } from "@/lib/group-service";
import { listFriends } from "@/lib/friend-service";
import { getOverallBalances, summarizeBalances } from "@/lib/settlement-service";
import { getCurrentYearMonth, getPrevYearMonth, isValidYearMonth } from "@/lib/month";
import { monthLabel } from "@/lib/format";

export const SUGGESTIONS: string[] = [
  "What's my total balance?",
  "How much did I spend on food this month?",
  "Show my recent transactions",
  "How is this month going?",
  "How is this month vs last month?",
  "What are my top spending categories?",
  "How am I doing on my goals?",
  "Who owes me money?",
  "What do I owe?",
  "Show my groups",
  "Show my friends",
];

/** Format a money amount with a currency code prefix and thousands separators. */
function fmt(amount: number, currency: string): string {
  const n = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount || 0);
  return `${currency} ${n}`;
}

const MONTH_NAMES = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

/**
 * Resolve a month expression embedded in the user's message.
 * Recognizes: "this month", "last month", "previous month", "in <Month>",
 * "in <Month> 2026", "for 2026-04". Defaults to current month.
 */
function resolveYearMonth(text: string): string {
  const t = text.toLowerCase();
  if (/\b(last|previous)\s+month\b/.test(t)) return getPrevYearMonth(getCurrentYearMonth());
  if (/\bthis\s+month\b/.test(t)) return getCurrentYearMonth();

  // "YYYY-MM"
  const explicit = t.match(/\b(\d{4})-(\d{1,2})\b/);
  if (explicit) {
    const ym = `${explicit[1]}-${explicit[2].padStart(2, "0")}`;
    if (isValidYearMonth(ym)) return ym;
  }

  // "in <Month> [Year]"
  for (let i = 0; i < MONTH_NAMES.length; i++) {
    const re = new RegExp(`\\b${MONTH_NAMES[i]}(?:\\s+(\\d{4}))?\\b`);
    const m = t.match(re);
    if (m) {
      const year = m[1] ?? new Date().getFullYear().toString();
      return `${year}-${String(i + 1).padStart(2, "0")}`;
    }
  }

  return getCurrentYearMonth();
}

async function resolveMonthId(userId: string, yearMonth: string): Promise<number | null> {
  const [m] = await db
    .select({ id: months.id })
    .from(months)
    .where(and(eq(months.userId, userId), eq(months.yearMonth, yearMonth)))
    .limit(1);
  return m?.id ?? null;
}

/** Find the user's category whose name best matches the query keyword. */
async function findCategory(userId: string, keyword: string) {
  const trimmed = keyword.trim();
  if (!trimmed) return null;
  const [row] = await db
    .select({ id: categoriesV2.id, name: categoriesV2.name })
    .from(categoriesV2)
    .where(and(eq(categoriesV2.userId, userId), ilike(categoriesV2.name, `%${trimmed}%`)))
    .limit(1);
  return row ?? null;
}

async function userDefaultCurrency(userId: string): Promise<string> {
  const [u] = await db.select({ c: users.defaultCurrency }).from(users).where(eq(users.id, userId)).limit(1);
  return u?.c ?? "PKR";
}

// ============================================================
// Handlers — each returns a human-friendly response string.
// ============================================================

async function answerTotalBalance(userId: string): Promise<string> {
  const list = await listSources(userId, false);
  if (list.length === 0) return "You haven't added any sources yet. Head to **Sources** to add a wallet or bank account.";
  const byCur: Record<string, number> = {};
  for (const s of list) byCur[s.currency] = (byCur[s.currency] ?? 0) + s.balance;
  const def = await userDefaultCurrency(userId);
  const total = await sumInCurrency(
    Object.entries(byCur).map(([c, a]) => ({ currency: c, amount: a })),
    def
  );
  const others = Object.entries(byCur).filter(([c]) => c !== def);
  const out = [`Your total balance is **${fmt(total, def)}** across ${list.length} ${list.length === 1 ? "source" : "sources"}.`];
  if (others.length > 0) {
    out.push(`Including: ${others.map(([c, a]) => fmt(a, c)).join(", ")} (converted via latest FX).`);
  }
  return out.join("\n");
}

async function answerSources(userId: string): Promise<string> {
  const list = await listSources(userId, false);
  if (list.length === 0) return "No sources yet.";
  const lines = list.map((s) => `• **${s.name}** (${s.type.replace("_", " ")}): ${fmt(s.balance, s.currency)}`);
  return lines.join("\n");
}

async function answerMonthSummary(userId: string, yearMonth: string): Promise<string> {
  const id = await resolveMonthId(userId, yearMonth);
  if (!id) return `No data for ${monthLabel(yearMonth)}.`;
  const s = await getMonthSummary(userId, id);
  const def = await userDefaultCurrency(userId);
  const lines = [
    `**${monthLabel(yearMonth)}** summary:`,
    `• Income: ${fmt(s.totalIncome, def)}`,
    `• Spent: ${fmt(s.totalSpent, def)}`,
    `• Budgeted: ${fmt(s.totalBudgeted, def)}`,
    `• Saved: ${fmt(s.totalIncome - s.totalSpent, def)} (${s.savingsRate.toFixed(1)}% savings rate)`,
  ];
  return lines.join("\n");
}

async function answerSpendingByCategory(
  userId: string,
  yearMonth: string,
  categoryFilter?: string
): Promise<string> {
  const id = await resolveMonthId(userId, yearMonth);
  if (!id) return `No data for ${monthLabel(yearMonth)}.`;
  const rows = await getCategoryBreakdown(userId, id);

  const def = await userDefaultCurrency(userId);

  if (categoryFilter) {
    const cat = await findCategory(userId, categoryFilter);
    if (!cat) return `I don't see a pocket called "${categoryFilter}". Try one of: ${rows.map((r) => r.name).join(", ") || "(none yet)"}.`;
    const row = rows.find((r) => r.id === cat.id);
    if (!row) return `No spending on **${cat.name}** in ${monthLabel(yearMonth)}.`;
    const lines = [
      `**${cat.name}** in ${monthLabel(yearMonth)}: spent ${fmt(row.spent, def)}`,
    ];
    if (row.budgetedAmount > 0) {
      const pct = (row.spent / row.budgetedAmount) * 100;
      lines.push(`Budget: ${fmt(row.budgetedAmount, def)} (${pct.toFixed(0)}% used)`);
    }
    return lines.join("\n");
  }

  const sorted = rows.slice().sort((a, b) => b.spent - a.spent).filter((r) => r.spent > 0);
  if (sorted.length === 0) return `No spending recorded in ${monthLabel(yearMonth)}.`;
  const top = sorted.slice(0, 5);
  const lines = [`Top categories in **${monthLabel(yearMonth)}**:`];
  for (const r of top) lines.push(`• ${r.name}: ${fmt(r.spent, def)}`);
  if (sorted.length > 5) lines.push(`…and ${sorted.length - 5} more.`);
  return lines.join("\n");
}

async function answerRecentTransactions(userId: string, limit = 10, kind?: "income" | "expense" | "transfer"): Promise<string> {
  const rows = await db
    .select({
      kind: transactions.kind,
      amount: transactions.amount,
      currency: transactions.currency,
      occurredAt: transactions.occurredAt,
      description: transactions.description,
      sourceName: sourcesTable.name,
      categoryName: categoriesV2.name,
    })
    .from(transactions)
    .innerJoin(sourcesTable, eq(transactions.sourceId, sourcesTable.id))
    .leftJoin(categoriesV2, eq(transactions.categoryId, categoriesV2.id))
    .where(kind ? and(eq(transactions.userId, userId), eq(transactions.kind, kind)) : eq(transactions.userId, userId))
    .orderBy(desc(transactions.occurredAt), desc(transactions.id))
    .limit(limit);

  if (rows.length === 0) return "No transactions yet.";
  const lines = [`Last ${rows.length} ${kind ?? "transactions"}:`];
  for (const r of rows) {
    const date = r.occurredAt.toISOString().slice(0, 10);
    const sign = r.kind === "expense" ? "-" : r.kind === "income" ? "+" : "↔";
    lines.push(`• ${date} ${sign}${fmt(parseFloat(r.amount), r.currency)} — ${r.description ?? r.categoryName ?? r.kind} (${r.sourceName})`);
  }
  return lines.join("\n");
}

async function answerCompareMonths(userId: string): Promise<string> {
  const cur = getCurrentYearMonth();
  const prev = getPrevYearMonth(cur);
  const curId = await resolveMonthId(userId, cur);
  const prevId = await resolveMonthId(userId, prev);
  if (!curId || !prevId) return "Need at least two months of data to compare.";
  const [a, b] = await Promise.all([getMonthSummary(userId, prevId), getMonthSummary(userId, curId)]);
  const def = await userDefaultCurrency(userId);
  const dSpent = b.totalSpent - a.totalSpent;
  const dIncome = b.totalIncome - a.totalIncome;
  const lines = [
    `**${monthLabel(prev)}** → **${monthLabel(cur)}**:`,
    `• Income: ${fmt(a.totalIncome, def)} → ${fmt(b.totalIncome, def)} (${dIncome >= 0 ? "+" : ""}${fmt(dIncome, def)})`,
    `• Spent: ${fmt(a.totalSpent, def)} → ${fmt(b.totalSpent, def)} (${dSpent >= 0 ? "+" : ""}${fmt(dSpent, def)})`,
  ];
  if (a.totalSpent > 0) {
    const pct = ((dSpent / a.totalSpent) * 100).toFixed(0);
    lines.push(`That's ${dSpent >= 0 ? "up" : "down"} ${Math.abs(Number(pct))}% on spending.`);
  }
  return lines.join("\n");
}

async function answerMonthlyTrend(userId: string): Promise<string> {
  const rows = await getMonthlyTrend(userId, 6);
  if (rows.length === 0) return "No monthly data yet.";
  const def = await userDefaultCurrency(userId);
  const lines = [`Last ${rows.length} months:`];
  for (const r of rows.slice().reverse()) {
    lines.push(`• ${r.label}: income ${fmt(r.income, def)} · spent ${fmt(r.expenses, def)} · net ${fmt(r.income - r.expenses, def)}`);
  }
  return lines.join("\n");
}

async function answerGoals(userId: string): Promise<string> {
  const list = await listGoals(userId);
  if (list.length === 0) return "You haven't set any savings goals yet. Head to **Goals** to add one.";
  const active = list.filter((g) => !g.completedAt);
  const done = list.filter((g) => g.completedAt);
  const lines: string[] = [];
  if (active.length > 0) {
    lines.push("**Active goals:**");
    for (const g of active) {
      const eta = g.etaMonths ? ` · ~${g.etaMonths} mo to go` : "";
      lines.push(`• ${g.name}: ${fmt(g.currentAmount, g.currency)} / ${fmt(g.targetAmount, g.currency)} (${Math.round(g.percent)}%)${eta}`);
    }
  }
  if (done.length > 0) {
    lines.push("\n**Achieved:** " + done.map((g) => g.name).join(", "));
  }
  return lines.join("\n");
}

async function answerGroups(userId: string): Promise<string> {
  const list = await listGroups(userId, false);
  if (list.length === 0) return "You haven't joined any groups yet. Head to **Groups** to create one.";
  const lines = [`You're in ${list.length} ${list.length === 1 ? "group" : "groups"}:`];
  for (const g of list) {
    if (g.netBalance === 0) {
      lines.push(`• **${g.name}** — settled up`);
    } else if (g.netBalance > 0) {
      lines.push(`• **${g.name}** — you're owed ${fmt(g.netBalance, g.defaultCurrency)}`);
    } else {
      lines.push(`• **${g.name}** — you owe ${fmt(Math.abs(g.netBalance), g.defaultCurrency)}`);
    }
  }
  return lines.join("\n");
}

async function answerFriends(userId: string): Promise<string> {
  const list = await listFriends(userId);
  if (list.length === 0) return "No friends added yet.";
  const lines = [`Friends:`];
  for (const f of list) {
    const entries = Object.entries(f.balanceByCurrency);
    const name = f.fullName ?? f.email.split("@")[0];
    if (entries.length === 0) {
      lines.push(`• **${name}** — settled up`);
    } else {
      const parts = entries.map(([cur, amt]) => (amt > 0 ? `owes you ${fmt(amt, cur)}` : `you owe ${fmt(Math.abs(amt), cur)}`));
      lines.push(`• **${name}** — ${parts.join(", ")}`);
    }
  }
  return lines.join("\n");
}

async function answerOverallBalances(userId: string): Promise<string> {
  const entries = await getOverallBalances(userId);
  if (entries.length === 0) return "All settled up across every group and friend.";
  const totals = summarizeBalances(entries);
  const lines: string[] = [];
  for (const [cur, t] of Object.entries(totals)) {
    lines.push(`**${cur}**: you're owed ${fmt(t.owed, cur)} · you owe ${fmt(t.owe, cur)}`);
  }
  lines.push("\nBy person:");
  const byPerson = new Map<string, typeof entries>();
  for (const e of entries) {
    const arr = byPerson.get(e.counterpartyId) ?? [];
    arr.push(e);
    byPerson.set(e.counterpartyId, arr);
  }
  for (const [, rows] of byPerson) {
    const name = rows[0].name;
    const parts = rows.map((r) =>
      r.amount > 0 ? `${fmt(r.amount, r.currency)} (${r.context})` : `you owe ${fmt(Math.abs(r.amount), r.currency)} (${r.context})`
    );
    lines.push(`• **${name}**: ${parts.join("; ")}`);
  }
  return lines.join("\n");
}

function answerHelp(): string {
  const lines = [
    "I can answer specific questions about your money — try these:",
    ...SUGGESTIONS.map((s) => `• ${s}`),
  ];
  return lines.join("\n");
}

// ============================================================
// The router — first match wins.
// ============================================================

type Intent = {
  test: (msg: string) => boolean;
  handle: (userId: string, msg: string) => Promise<string>;
};

const INTENTS: Intent[] = [
  // Help
  {
    test: (m) => /\b(help|what can you do|commands?|how does this work)\b/.test(m),
    handle: async () => answerHelp(),
  },
  // Total balance
  {
    test: (m) => /\b(total\s+balance|net\s+worth|how\s+much\s+(do\s+i\s+have|money))\b/.test(m),
    handle: async (uid) => answerTotalBalance(uid),
  },
  // Sources / accounts
  {
    test: (m) => /\b(my\s+(sources?|accounts?|wallets?)|list\s+(sources?|accounts?))\b/.test(m),
    handle: async (uid) => answerSources(uid),
  },
  // Spending on <category>
  {
    test: (m) => /\b(spend|spent|spending)\s+(on|for|in)\s+\w+/.test(m),
    handle: async (uid, m) => {
      const match = m.match(/\b(?:spend|spent|spending)\s+(?:on|for|in)\s+([a-z][a-z\s-]*?)(?:\s+(?:this|last|previous|in)\b|\?|$)/);
      const keyword = match ? match[1].trim() : "";
      return answerSpendingByCategory(uid, resolveYearMonth(m), keyword);
    },
  },
  // How much did I spend on <X>
  {
    test: (m) => /how\s+much\s+(did\s+i\s+)?spen[dt]/.test(m),
    handle: async (uid, m) => {
      const match = m.match(/spen[dt]\s+(?:on|for|in)\s+([a-z][a-z\s-]*?)(?:\s+(?:this|last|previous|in)\b|\?|$)/);
      const keyword = match ? match[1].trim() : "";
      if (keyword) return answerSpendingByCategory(uid, resolveYearMonth(m), keyword);
      return answerMonthSummary(uid, resolveYearMonth(m));
    },
  },
  // Recent transactions
  {
    test: (m) => /\b(recent|latest|last)\s+(transactions?|moves|activity|expenses?|spending|spends?|incom(e|es))\b/.test(m) ||
                  /\bshow\s+(me\s+)?(my\s+)?(recent|latest|last)/.test(m),
    handle: async (uid, m) => {
      const num = m.match(/\b(\d+)\s+(transactions?|expenses?|incomes?|moves?)/);
      const limit = num ? Math.min(50, Math.max(1, parseInt(num[1], 10))) : 10;
      let kind: "income" | "expense" | "transfer" | undefined;
      if (/\bincome/.test(m)) kind = "income";
      else if (/\bexpense|spend/.test(m)) kind = "expense";
      else if (/\btransfer/.test(m)) kind = "transfer";
      return answerRecentTransactions(uid, limit, kind);
    },
  },
  // Compare months
  {
    test: (m) => /\b(this\s+(month\s+)?vs\.?\s+last|compare\s+(this\s+to\s+last|months?)|month\s*-?\s*over\s*-?\s*month|mom)\b/.test(m),
    handle: async (uid) => answerCompareMonths(uid),
  },
  // Monthly trend
  {
    test: (m) => /\b(trend|last\s+(\d+\s+)?months|history|over\s+time)\b/.test(m),
    handle: async (uid) => answerMonthlyTrend(uid),
  },
  // Goals
  {
    test: (m) => /\b(goals?|savings?\s+goal|saving\s+for|how\s+am\s+i\s+doing\s+on\s+savings?)\b/.test(m),
    handle: async (uid) => answerGoals(uid),
  },
  // Groups
  {
    test: (m) => /\b(my\s+)?groups?\b/.test(m) && !/\bgroup\s+balance/.test(m),
    handle: async (uid) => answerGroups(uid),
  },
  // Friends
  {
    test: (m) => /\b(my\s+)?friends?\b/.test(m),
    handle: async (uid) => answerFriends(uid),
  },
  // Balances / who owes me / what do I owe
  {
    test: (m) => /\b(who\s+owes\s+me|what\s+do\s+i\s+owe|balances?|settle\s+up|how\s+much\s+(do\s+i\s+owe|am\s+i\s+owed))\b/.test(m),
    handle: async (uid) => answerOverallBalances(uid),
  },
  // Top categories / spending breakdown
  {
    test: (m) => /\b(top\s+(spending\s+)?categor|biggest\s+(spending|expense)|spending\s+(by\s+category|breakdown|categories)|where\s+(did\s+)?my\s+money\s+go)\b/.test(m),
    handle: async (uid, m) => answerSpendingByCategory(uid, resolveYearMonth(m)),
  },
  // "How is this month going?" / month summary
  {
    test: (m) => /\b(how\s+(is|am\s+i)\s+(doing|going)|this\s+month|summary|month\s+summary|month\s+overview)\b/.test(m),
    handle: async (uid, m) => answerMonthSummary(uid, resolveYearMonth(m)),
  },
  // Income
  {
    test: (m) => /\b(income|earnings|how\s+much\s+(did\s+i\s+)?(earn|make))\b/.test(m),
    handle: async (uid, m) => answerMonthSummary(uid, resolveYearMonth(m)),
  },
];

export async function routeIntent(userId: string, message: string): Promise<string> {
  const m = message.trim().toLowerCase();
  if (m === "") return answerHelp();
  for (const intent of INTENTS) {
    if (intent.test(m)) {
      try {
        return await intent.handle(userId, m);
      } catch (err) {
        console.error("intent handler error", err);
        return "Something went wrong while looking that up. Try a different question?";
      }
    }
  }
  return [
    "I didn't quite get that. Here are some things I can answer:",
    ...SUGGESTIONS.slice(0, 6).map((s) => `• ${s}`),
    "",
    "Type `help` for the full list.",
  ].join("\n");
}
