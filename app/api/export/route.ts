import { NextRequest } from "next/server";
import { and, eq, like, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { categories, expenses, income, months } from "@/db/schema";
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
        date: expenses.expenseDate,
        category: categories.name,
        description: expenses.description,
        amount: expenses.amount,
      })
      .from(expenses)
      .innerJoin(categories, eq(expenses.categoryId, categories.id))
      .where(and(eq(expenses.userId, userId), eq(expenses.monthId, monthId)))
      .orderBy(expenses.expenseDate, categories.name);

    const lines = [csvRow(["Date", "Category", "Description", "Amount"])];
    for (const r of rows) lines.push(csvRow([r.date, r.category, r.description, r.amount]));
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

    const rows = await db
      .select({
        name: categories.name,
        budgeted: categories.budgetedAmount,
        spent: sql<string>`COALESCE(SUM(${expenses.amount}), 0)`,
      })
      .from(categories)
      .leftJoin(expenses, eq(expenses.categoryId, categories.id))
      .where(and(eq(categories.userId, userId), eq(categories.monthId, monthId)))
      .groupBy(categories.id)
      .orderBy(categories.sortOrder, categories.name);

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
        income: sql<string>`COALESCE((SELECT SUM(amount) FROM income WHERE income.month_id = ${months.id}), 0)`,
        budgeted: sql<string>`COALESCE((SELECT SUM(budgeted_amount) FROM categories WHERE categories.month_id = ${months.id}), 0)`,
        spent: sql<string>`COALESCE((SELECT SUM(amount) FROM expenses WHERE expenses.month_id = ${months.id}), 0)`,
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
