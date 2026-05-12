import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { categories, expenses, income, months } from "@/db/schema";

const n = (v: string | number | null | undefined) =>
  typeof v === "number" ? v : parseFloat((v as string) ?? "0") || 0;

export type MonthSummary = {
  totalIncome: number;
  totalBudgeted: number;
  totalSpent: number;
  remaining: number;
  unallocated: number;
  savingsRate: number;
};

export async function getMonthSummary(userId: string, monthId: number): Promise<MonthSummary> {
  const [incRow] = await db
    .select({ total: sql<string>`COALESCE(SUM(${income.amount}), 0)` })
    .from(income)
    .where(and(eq(income.userId, userId), eq(income.monthId, monthId)));

  const [budRow] = await db
    .select({ total: sql<string>`COALESCE(SUM(${categories.budgetedAmount}), 0)` })
    .from(categories)
    .where(and(eq(categories.userId, userId), eq(categories.monthId, monthId)));

  const [spentRow] = await db
    .select({ total: sql<string>`COALESCE(SUM(${expenses.amount}), 0)` })
    .from(expenses)
    .where(and(eq(expenses.userId, userId), eq(expenses.monthId, monthId)));

  const totalIncome = n(incRow.total);
  const totalBudgeted = n(budRow.total);
  const totalSpent = n(spentRow.total);

  return {
    totalIncome,
    totalBudgeted,
    totalSpent,
    remaining: totalIncome - totalSpent,
    unallocated: totalIncome - totalBudgeted,
    savingsRate: totalIncome > 0 ? ((totalIncome - totalSpent) / totalIncome) * 100 : 0,
  };
}

export type CategoryBreakdownRow = {
  id: number;
  name: string;
  color: string;
  budgetedAmount: number;
  spent: number;
};

export async function getCategoryBreakdown(
  userId: string,
  monthId: number
): Promise<CategoryBreakdownRow[]> {
  const rows = await db
    .select({
      id: categories.id,
      name: categories.name,
      color: categories.color,
      sortOrder: categories.sortOrder,
      budgetedAmount: categories.budgetedAmount,
      spent: sql<string>`COALESCE(SUM(${expenses.amount}), 0)`,
    })
    .from(categories)
    .leftJoin(expenses, eq(expenses.categoryId, categories.id))
    .where(and(eq(categories.userId, userId), eq(categories.monthId, monthId)))
    .groupBy(categories.id)
    .orderBy(categories.sortOrder, categories.name);

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    color: r.color,
    budgetedAmount: n(r.budgetedAmount),
    spent: n(r.spent),
  }));
}

export type RecentExpenseRow = {
  id: number;
  expenseDate: string;
  amount: number;
  description: string;
  categoryName: string;
  categoryColor: string;
};

export async function getRecentExpenses(
  userId: string,
  monthId: number,
  limit = 5
): Promise<RecentExpenseRow[]> {
  const rows = await db
    .select({
      id: expenses.id,
      expenseDate: expenses.expenseDate,
      amount: expenses.amount,
      description: expenses.description,
      createdAt: expenses.createdAt,
      categoryName: categories.name,
      categoryColor: categories.color,
    })
    .from(expenses)
    .innerJoin(categories, eq(expenses.categoryId, categories.id))
    .where(and(eq(expenses.userId, userId), eq(expenses.monthId, monthId)))
    .orderBy(desc(expenses.expenseDate), desc(expenses.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    expenseDate: r.expenseDate,
    amount: n(r.amount),
    description: r.description,
    categoryName: r.categoryName,
    categoryColor: r.categoryColor,
  }));
}

export type CategoryTotalRow = { name: string; color: string; total: number };

export async function getCategoryTotals(
  userId: string,
  monthId: number
): Promise<CategoryTotalRow[]> {
  const rows = await db
    .select({
      name: categories.name,
      color: categories.color,
      total: sql<string>`COALESCE(SUM(${expenses.amount}), 0)`,
    })
    .from(categories)
    .leftJoin(expenses, eq(expenses.categoryId, categories.id))
    .where(and(eq(categories.userId, userId), eq(categories.monthId, monthId)))
    .groupBy(categories.id, categories.name, categories.color)
    .having(sql`COALESCE(SUM(${expenses.amount}), 0) > 0`)
    .orderBy(desc(sql`COALESCE(SUM(${expenses.amount}), 0)`));

  return rows.map((r) => ({ name: r.name, color: r.color, total: n(r.total) }));
}

export type MonthlyTrendRow = {
  yearMonth: string;
  label: string;
  income: number;
  expenses: number;
};

export async function getMonthlyTrend(
  userId: string,
  count = 6
): Promise<MonthlyTrendRow[]> {
  const rows = await db
    .select({
      yearMonth: months.yearMonth,
      label: months.label,
      income: sql<string>`COALESCE((SELECT SUM(${income.amount}) FROM ${income} WHERE ${income.monthId} = ${months.id}), 0)`,
      expenses: sql<string>`COALESCE((SELECT SUM(${expenses.amount}) FROM ${expenses} WHERE ${expenses.monthId} = ${months.id}), 0)`,
    })
    .from(months)
    .where(eq(months.userId, userId))
    .orderBy(desc(months.yearMonth))
    .limit(count);

  return rows.map((r) => ({
    yearMonth: r.yearMonth,
    label: r.label,
    income: n(r.income),
    expenses: n(r.expenses),
  }));
}

export type SavingsTrendRow = {
  yearMonth: string;
  label: string;
  income: number;
  expenses: number;
};

export async function getSavingsRateTrend(
  userId: string,
  count = 12
): Promise<SavingsTrendRow[]> {
  const rows = await getMonthlyTrend(userId, count);
  return rows.reverse();
}

export type CategoryComparison = {
  months: { monthId: number; yearMonth: string; label: string }[];
  categories: string[];
  colors: Record<string, string>;
  data: Record<number, Record<string, number>>;
};

export async function getCategoryComparisonAcrossMonths(
  userId: string,
  count = 6
): Promise<CategoryComparison> {
  const monthRows = await db
    .select({ id: months.id, yearMonth: months.yearMonth, label: months.label })
    .from(months)
    .where(eq(months.userId, userId))
    .orderBy(desc(months.yearMonth))
    .limit(count);

  const ordered = [...monthRows].reverse();
  if (ordered.length === 0) {
    return { months: [], categories: [], colors: {}, data: {} };
  }

  const monthIds = ordered.map((m) => m.id);
  const rows = await db
    .select({
      monthId: categories.monthId,
      name: categories.name,
      color: categories.color,
      total: sql<string>`COALESCE(SUM(${expenses.amount}), 0)`,
    })
    .from(categories)
    .leftJoin(expenses, eq(expenses.categoryId, categories.id))
    .where(and(eq(categories.userId, userId), inArray(categories.monthId, monthIds)))
    .groupBy(categories.monthId, categories.name, categories.color)
    .orderBy(categories.name);

  const catNames = new Set<string>();
  const colors: Record<string, string> = {};
  const data: Record<number, Record<string, number>> = {};
  for (const r of rows) {
    catNames.add(r.name);
    colors[r.name] = r.color;
    if (!data[r.monthId]) data[r.monthId] = {};
    data[r.monthId][r.name] = n(r.total);
  }

  return {
    months: ordered.map((m) => ({ monthId: m.id, yearMonth: m.yearMonth, label: m.label })),
    categories: Array.from(catNames),
    colors,
    data,
  };
}

/**
 * Selection for copying a category from sourceMonth to targetMonth.
 * `rollover === "rollover"` means: finalBudget = max(0, newBudget + (sourceBudgeted - sourceSpent))
 * `rollover === "fresh"` means: finalBudget = newBudget
 */
export type CopySelection = {
  categoryId: number;
  include: boolean;
  newBudget: number;
  rollover: "fresh" | "rollover";
};

export async function copyCategoriesToMonth(
  userId: string,
  sourceMonthId: number,
  targetMonthId: number,
  selections: CopySelection[]
): Promise<number> {
  let count = 0;
  for (const sel of selections) {
    if (!sel.include) continue;

    const [source] = await db
      .select({
        name: categories.name,
        color: categories.color,
        sortOrder: categories.sortOrder,
        budgetedAmount: categories.budgetedAmount,
        spent: sql<string>`COALESCE((SELECT SUM(${expenses.amount}) FROM ${expenses} WHERE ${expenses.categoryId} = ${categories.id}), 0)`,
      })
      .from(categories)
      .where(and(eq(categories.userId, userId), eq(categories.id, sel.categoryId)))
      .limit(1);

    if (!source) continue;

    let finalBudget = sel.newBudget;
    if (sel.rollover === "rollover") {
      const unspent = n(source.budgetedAmount) - n(source.spent);
      finalBudget = Math.max(0, sel.newBudget + unspent);
    }

    // Duplicate-name guard (idempotent re-run): skip silently if a category with the same name exists in the target month
    const [exists] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(
        and(
          eq(categories.userId, userId),
          eq(categories.monthId, targetMonthId),
          eq(categories.name, source.name)
        )
      )
      .limit(1);

    if (exists) continue;

    await db.insert(categories).values({
      userId,
      monthId: targetMonthId,
      name: source.name,
      budgetedAmount: finalBudget.toFixed(2),
      color: source.color,
      sortOrder: source.sortOrder,
    });
    count++;
  }
  return count;
}

export async function listMonths(userId: string) {
  return db
    .select({ id: months.id, yearMonth: months.yearMonth, label: months.label })
    .from(months)
    .where(eq(months.userId, userId))
    .orderBy(desc(months.yearMonth));
}
