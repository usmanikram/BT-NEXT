import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  categoriesV2,
  budgets,
  transactions,
  userExpenseShares,
  months,
  users,
  groups,
} from "@/db/schema";

const n = (v: string | number | null | undefined) =>
  typeof v === "number" ? v : parseFloat((v as string) ?? "0") || 0;

/** YYYY-MM extracted from the spending view's occurred_at. */
const shareYearMonth = sql<string>`to_char(${userExpenseShares.occurredAt}, 'YYYY-MM')`;

async function getYearMonth(userId: string, monthId: number): Promise<string | null> {
  const [row] = await db
    .select({ yearMonth: months.yearMonth })
    .from(months)
    .where(and(eq(months.id, monthId), eq(months.userId, userId)))
    .limit(1);
  return row?.yearMonth ?? null;
}

export type MonthSummary = {
  totalIncome: number;
  totalBudgeted: number;
  totalSpent: number;
  remaining: number;
  unallocated: number;
  savingsRate: number;
};

export async function getMonthSummary(userId: string, monthId: number): Promise<MonthSummary> {
  const yearMonth = await getYearMonth(userId, monthId);

  const [incRow] = await db
    .select({ total: sql<string>`COALESCE(SUM(${transactions.amount}), 0)` })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.kind, "income"),
        yearMonth ? sql`to_char(${transactions.occurredAt}, 'YYYY-MM') = ${yearMonth}` : sql`FALSE`
      )
    );

  const [budRow] = await db
    .select({ total: sql<string>`COALESCE(SUM(${budgets.amount}), 0)` })
    .from(budgets)
    .where(and(eq(budgets.userId, userId), eq(budgets.monthId, monthId)));

  const [spentRow] = await db
    .select({ total: sql<string>`COALESCE(SUM(${userExpenseShares.amount}), 0)` })
    .from(userExpenseShares)
    .where(
      and(
        eq(userExpenseShares.userId, userId),
        yearMonth ? sql`to_char(${userExpenseShares.occurredAt}, 'YYYY-MM') = ${yearMonth}` : sql`FALSE`
      )
    );

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

/**
 * For a given month, return every category that either has a budget for that month
 * OR has expense transactions in that month. Ordered by sort_order, name.
 */
export async function getCategoryBreakdown(
  userId: string,
  monthId: number
): Promise<CategoryBreakdownRow[]> {
  const yearMonth = await getYearMonth(userId, monthId);
  if (!yearMonth) return [];

  // Subquery: spend per category for this month — per-participant share from the view.
  const spend = db
    .select({
      categoryId: userExpenseShares.categoryId,
      total: sql<string>`SUM(${userExpenseShares.amount})`.as("total"),
    })
    .from(userExpenseShares)
    .where(
      and(
        eq(userExpenseShares.userId, userId),
        sql`to_char(${userExpenseShares.occurredAt}, 'YYYY-MM') = ${yearMonth}`,
        sql`${userExpenseShares.categoryId} IS NOT NULL`
      )
    )
    .groupBy(userExpenseShares.categoryId)
    .as("spend");

  const rows = await db
    .select({
      id: categoriesV2.id,
      name: categoriesV2.name,
      color: categoriesV2.color,
      sortOrder: categoriesV2.sortOrder,
      budgetedAmount: sql<string>`COALESCE(${budgets.amount}, 0)`,
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
        eq(categoriesV2.archived, false),
        sql`(${budgets.id} IS NOT NULL OR ${spend.total} IS NOT NULL)`
      )
    )
    .orderBy(categoriesV2.sortOrder, categoriesV2.name);

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
  /** The user's *share* of the expense (not necessarily the full transaction amount). */
  amount: number;
  description: string;
  categoryName: string;
  categoryColor: string;
  /** True if this row is a participant share in a shared expense (group or 1-to-1 friend). */
  isShared: boolean;
  /** Non-null only when isShared and the payer is someone other than the viewing user. */
  payerName: string | null;
  /** Group name when the shared expense is group-scoped; null for 1-to-1 splits and personal expenses. */
  groupName: string | null;
};

export async function getRecentExpenses(
  userId: string,
  monthId: number,
  limit = 5
): Promise<RecentExpenseRow[]> {
  const yearMonth = await getYearMonth(userId, monthId);
  if (!yearMonth) return [];

  // Source from the view (user's share) but JOIN transactions for description + payer/group
  // metadata so the dashboard can label shared-expense participation clearly.
  const rows = await db
    .select({
      id: userExpenseShares.transactionId,
      occurredAt: userExpenseShares.occurredAt,
      amount: userExpenseShares.amount,
      description: transactions.description,
      createdAt: transactions.createdAt,
      categoryName: categoriesV2.name,
      categoryColor: categoriesV2.color,
      isShared: transactions.isShared,
      payerId: transactions.userId,
      payerFullName: users.fullName,
      payerEmail: users.email,
      groupName: groups.name,
    })
    .from(userExpenseShares)
    .innerJoin(transactions, eq(userExpenseShares.transactionId, transactions.id))
    .leftJoin(categoriesV2, eq(userExpenseShares.categoryId, categoriesV2.id))
    .leftJoin(users, eq(transactions.userId, users.id))
    .leftJoin(groups, eq(transactions.groupId, groups.id))
    .where(
      and(
        eq(userExpenseShares.userId, userId),
        sql`to_char(${userExpenseShares.occurredAt}, 'YYYY-MM') = ${yearMonth}`
      )
    )
    .orderBy(desc(userExpenseShares.occurredAt), desc(transactions.createdAt))
    .limit(limit);

  return rows.map((r) => {
    const payerIsOther = r.isShared && r.payerId !== userId;
    return {
      id: r.id,
      expenseDate: r.occurredAt.toISOString().slice(0, 10),
      amount: n(r.amount),
      description: r.description ?? "",
      categoryName: r.categoryName ?? "Uncategorized",
      categoryColor: r.categoryColor ?? "#A98AD6",
      isShared: r.isShared,
      payerName: payerIsOther
        ? (r.payerFullName ?? r.payerEmail?.split("@")[0] ?? "Someone")
        : null,
      groupName: r.groupName ?? null,
    };
  });
}

export type CategoryTotalRow = { name: string; color: string; total: number };

export async function getCategoryTotals(
  userId: string,
  monthId: number
): Promise<CategoryTotalRow[]> {
  const yearMonth = await getYearMonth(userId, monthId);
  if (!yearMonth) return [];

  const rows = await db
    .select({
      name: categoriesV2.name,
      color: categoriesV2.color,
      total: sql<string>`SUM(${userExpenseShares.amount})`,
    })
    .from(userExpenseShares)
    .innerJoin(categoriesV2, eq(userExpenseShares.categoryId, categoriesV2.id))
    .where(
      and(
        eq(userExpenseShares.userId, userId),
        sql`to_char(${userExpenseShares.occurredAt}, 'YYYY-MM') = ${yearMonth}`
      )
    )
    .groupBy(categoriesV2.id, categoriesV2.name, categoriesV2.color)
    .orderBy(desc(sql`SUM(${userExpenseShares.amount})`));

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
  // Anchor on `months` so we always have at least the right list of months even if no txns.
  const rows = await db
    .select({
      yearMonth: months.yearMonth,
      label: months.label,
      income: sql<string>`COALESCE((
        SELECT SUM(${transactions.amount})
        FROM ${transactions}
        WHERE ${transactions.userId} = ${userId}
          AND ${transactions.kind} = 'income'
          AND to_char(${transactions.occurredAt}, 'YYYY-MM') = ${months.yearMonth}
      ), 0)`,
      expenses: sql<string>`COALESCE((
        SELECT SUM(${userExpenseShares.amount})
        FROM ${userExpenseShares}
        WHERE ${userExpenseShares.userId} = ${userId}
          AND to_char(${userExpenseShares.occurredAt}, 'YYYY-MM') = ${months.yearMonth}
      ), 0)`,
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

export type SavingsTrendRow = MonthlyTrendRow;

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

  const yearMonths = ordered.map((m) => m.yearMonth);
  const byYearMonth = new Map(ordered.map((m) => [m.yearMonth, m.id]));

  const rows = await db
    .select({
      yearMonth: shareYearMonth,
      name: categoriesV2.name,
      color: categoriesV2.color,
      total: sql<string>`SUM(${userExpenseShares.amount})`,
    })
    .from(userExpenseShares)
    .innerJoin(categoriesV2, eq(userExpenseShares.categoryId, categoriesV2.id))
    .where(
      and(
        eq(userExpenseShares.userId, userId),
        inArray(shareYearMonth, yearMonths)
      )
    )
    .groupBy(categoriesV2.id, categoriesV2.name, categoriesV2.color, shareYearMonth)
    .orderBy(categoriesV2.name);

  const catNames = new Set<string>();
  const colors: Record<string, string> = {};
  const data: Record<number, Record<string, number>> = {};
  for (const r of rows) {
    const monthId = byYearMonth.get(r.yearMonth);
    if (!monthId) continue;
    catNames.add(r.name);
    colors[r.name] = r.color;
    if (!data[monthId]) data[monthId] = {};
    data[monthId][r.name] = n(r.total);
  }

  return {
    months: ordered.map((m) => ({ monthId: m.id, yearMonth: m.yearMonth, label: m.label })),
    categories: Array.from(catNames),
    colors,
    data,
  };
}

/**
 * Copy budget allocations from sourceMonth to targetMonth. Categories are global
 * now, so we just create/update budget rows for the target month.
 *
 * - `rollover === 'rollover'`: finalBudget = max(0, newBudget + (sourceBudget − sourceSpent))
 * - `rollover === 'fresh'`: finalBudget = newBudget
 *
 * Idempotent: an existing budget for (target_month, category) is updated, not duplicated.
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
  const sourceYearMonth = await getYearMonth(userId, sourceMonthId);
  if (!sourceYearMonth) return 0;

  let count = 0;
  for (const sel of selections) {
    if (!sel.include) continue;

    // Compute rollover from source budget + source spent
    let finalBudget = sel.newBudget;
    if (sel.rollover === "rollover") {
      const [srcBudget] = await db
        .select({ amount: budgets.amount })
        .from(budgets)
        .where(
          and(
            eq(budgets.userId, userId),
            eq(budgets.monthId, sourceMonthId),
            eq(budgets.categoryId, sel.categoryId)
          )
        )
        .limit(1);
      const [srcSpent] = await db
        .select({ total: sql<string>`COALESCE(SUM(${userExpenseShares.amount}), 0)` })
        .from(userExpenseShares)
        .where(
          and(
            eq(userExpenseShares.userId, userId),
            eq(userExpenseShares.categoryId, sel.categoryId),
            sql`to_char(${userExpenseShares.occurredAt}, 'YYYY-MM') = ${sourceYearMonth}`
          )
        );
      const unspent = n(srcBudget?.amount ?? "0") - n(srcSpent?.total ?? "0");
      finalBudget = Math.max(0, sel.newBudget + unspent);
    }

    // Upsert budget for target month
    await db
      .insert(budgets)
      .values({
        userId,
        monthId: targetMonthId,
        categoryId: sel.categoryId,
        amount: finalBudget.toFixed(2),
      })
      .onConflictDoUpdate({
        target: [budgets.userId, budgets.monthId, budgets.categoryId],
        set: { amount: finalBudget.toFixed(2), updatedAt: new Date() },
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

/**
 * Categories that have either a budget for the source month or a recent expense for it.
 * Used by the copy-month page to populate selections.
 */
export type CopyableCategory = {
  categoryId: number;
  name: string;
  color: string;
  sortOrder: number;
  budgetedAmount: number;
  spent: number;
};

export async function getCopyableCategoriesForMonth(
  userId: string,
  monthId: number
): Promise<CopyableCategory[]> {
  const rows = await getCategoryBreakdown(userId, monthId);
  return rows.map((r) => ({
    categoryId: r.id,
    name: r.name,
    color: r.color,
    sortOrder: 0,
    budgetedAmount: r.budgetedAmount,
    spent: r.spent,
  }));
}

/**
 * Alerts: categories at/above 75% (warn), 90% (danger), 100% (over).
 * Returns the worst-severity rows first.
 */
export type BudgetAlert = {
  categoryId: number;
  name: string;
  color: string;
  budgetedAmount: number;
  spent: number;
  percent: number;
  severity: "warn" | "danger" | "over";
};

export async function getBudgetAlerts(userId: string, monthId: number): Promise<BudgetAlert[]> {
  const rows = await getCategoryBreakdown(userId, monthId);
  const alerts: BudgetAlert[] = [];
  for (const r of rows) {
    if (r.budgetedAmount <= 0) continue;
    const pct = (r.spent / r.budgetedAmount) * 100;
    let severity: BudgetAlert["severity"] | null = null;
    if (pct >= 100) severity = "over";
    else if (pct >= 90) severity = "danger";
    else if (pct >= 75) severity = "warn";
    if (!severity) continue;
    alerts.push({
      categoryId: r.id,
      name: r.name,
      color: r.color,
      budgetedAmount: r.budgetedAmount,
      spent: r.spent,
      percent: pct,
      severity,
    });
  }
  return alerts.sort((a, b) => {
    const order = { over: 0, danger: 1, warn: 2 };
    return order[a.severity] - order[b.severity];
  });
}
