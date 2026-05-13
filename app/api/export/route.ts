import { NextRequest } from "next/server";
import { and, eq, like, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { transactions, categoriesV2, budgets, months, userExpenseShares } from "@/db/schema";
import { requireUserId } from "@/lib/session";

function csvEscape(v: unknown): string {
  const s = v == null ? "" : String(v);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function csvRow(cells: unknown[]): string {
  return cells.map(csvEscape).join(",");
}

function csvResponse(filename: string, body: string) {
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

export async function GET(req: NextRequest) {
  const userId = await requireUserId();
  const type = req.nextUrl.searchParams.get("type");
  const monthIdParam = req.nextUrl.searchParams.get("monthId");
  const yearParam = req.nextUrl.searchParams.get("year");

  if (type === "monthly") {
    const monthId = Number(monthIdParam);
    const [m] = await db
      .select()
      .from(months)
      .where(and(eq(months.id, monthId), eq(months.userId, userId)))
      .limit(1);
    if (!m) return new Response("Month not found", { status: 404 });

    const rows = await db
      .select({
        date: sql<string>`to_char(${userExpenseShares.occurredAt}, 'YYYY-MM-DD')`,
        category: categoriesV2.name,
        description: transactions.description,
        amount: userExpenseShares.amount,
        currency: userExpenseShares.currency,
      })
      .from(userExpenseShares)
      .innerJoin(transactions, eq(userExpenseShares.transactionId, transactions.id))
      .leftJoin(categoriesV2, eq(userExpenseShares.categoryId, categoriesV2.id))
      .where(
        and(
          eq(userExpenseShares.userId, userId),
          sql`to_char(${userExpenseShares.occurredAt}, 'YYYY-MM') = ${m.yearMonth}`
        )
      )
      .orderBy(userExpenseShares.occurredAt, categoriesV2.name);

    const lines = [csvRow(["Date", "Category", "Description", "Amount", "Currency"])];
    for (const r of rows) {
      lines.push(csvRow([r.date, r.category ?? "Uncategorized", r.description ?? "", r.amount, r.currency]));
    }
    return csvResponse(`expenses-${m.yearMonth}.csv`, lines.join("\r\n"));
  }

  if (type === "categories") {
    const monthId = Number(monthIdParam);
    const [m] = await db
      .select()
      .from(months)
      .where(and(eq(months.id, monthId), eq(months.userId, userId)))
      .limit(1);
    if (!m) return new Response("Month not found", { status: 404 });

    const spend = db
      .select({
        categoryId: userExpenseShares.categoryId,
        total: sql<string>`SUM(${userExpenseShares.amount})`.as("total"),
      })
      .from(userExpenseShares)
      .where(
        and(
          eq(userExpenseShares.userId, userId),
          sql`to_char(${userExpenseShares.occurredAt}, 'YYYY-MM') = ${m.yearMonth}`
        )
      )
      .groupBy(userExpenseShares.categoryId)
      .as("spend");

    const rows = await db
      .select({
        name: categoriesV2.name,
        budgeted: sql<string>`COALESCE(${budgets.amount}, 0)`,
        spent: sql<string>`COALESCE(${spend.total}, 0)`,
      })
      .from(categoriesV2)
      .leftJoin(
        budgets,
        and(eq(budgets.categoryId, categoriesV2.id), eq(budgets.monthId, monthId))
      )
      .leftJoin(spend, eq(spend.categoryId, categoriesV2.id))
      .where(
        and(
          eq(categoriesV2.userId, userId),
          sql`(${budgets.id} IS NOT NULL OR ${spend.total} IS NOT NULL)`
        )
      )
      .orderBy(categoriesV2.sortOrder, categoriesV2.name);

    const lines = [csvRow(["Category", "Budgeted", "Spent", "Remaining", "% Used"])];
    for (const r of rows) {
      const budgeted = parseFloat(r.budgeted) || 0;
      const spent = parseFloat(r.spent) || 0;
      const remaining = budgeted - spent;
      const pct = budgeted > 0 ? Math.round((spent / budgeted) * 1000) / 10 : 0;
      lines.push(csvRow([r.name, budgeted.toFixed(2), spent.toFixed(2), remaining.toFixed(2), `${pct}%`]));
    }
    return csvResponse(`categories-${m.yearMonth}.csv`, lines.join("\r\n"));
  }

  if (type === "yearly") {
    const year = yearParam ?? new Date().getFullYear().toString();
    const yearRows = await db
      .select({
        yearMonth: months.yearMonth,
        label: months.label,
        income: sql<string>`COALESCE((
          SELECT SUM(amount) FROM transactions
          WHERE transactions.user_id = ${userId}
            AND transactions.kind = 'income'
            AND to_char(transactions.occurred_at, 'YYYY-MM') = ${months.yearMonth}
        ), 0)`,
        budgeted: sql<string>`COALESCE((
          SELECT SUM(amount) FROM budgets WHERE budgets.month_id = ${months.id}
        ), 0)`,
        spent: sql<string>`COALESCE((
          SELECT SUM(amount) FROM user_expense_shares
          WHERE user_expense_shares.user_id = ${userId}
            AND to_char(user_expense_shares.occurred_at, 'YYYY-MM') = ${months.yearMonth}
        ), 0)`,
      })
      .from(months)
      .where(and(eq(months.userId, userId), like(months.yearMonth, `${year}-%`)))
      .orderBy(months.yearMonth);

    const lines = [csvRow(["Month", "Income", "Budgeted", "Spent", "Savings"])];
    for (const r of yearRows) {
      const inc = parseFloat(r.income) || 0;
      const bud = parseFloat(r.budgeted) || 0;
      const spt = parseFloat(r.spent) || 0;
      lines.push(csvRow([r.label, inc.toFixed(2), bud.toFixed(2), spt.toFixed(2), (inc - spt).toFixed(2)]));
    }
    return csvResponse(`yearly-summary-${year}.csv`, lines.join("\r\n"));
  }

  return new Response("Invalid export type", { status: 400 });
}
