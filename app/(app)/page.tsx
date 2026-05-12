import {
  Coins,
  Tag as TagIcon,
  Receipt,
  PiggyBank,
  PieChart as PieIcon,
  BarChart3,
  TrendingUp,
} from "lucide-react";
import { ButtonLink } from "@/components/button-link";
import { PageShell } from "@/components/page-shell";
import { SummaryCard } from "@/components/summary-card";
import { ColorDot } from "@/components/color-dot";
import { EmptyState } from "@/components/empty-state";
import { CategoryPie } from "@/components/charts/category-pie";
import { BudgetBar } from "@/components/charts/budget-bar";
import { MonthlyTrend } from "@/components/charts/monthly-trend";
import { getCurrentMonth, requireUserId } from "@/lib/session";
import { formatDate, formatMoney } from "@/lib/format";
import {
  getCategoryBreakdown,
  getCategoryTotals,
  getMonthlyTrend,
  getMonthSummary,
  getRecentExpenses,
} from "@/lib/budget-service";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const userId = await requireUserId();
  const { month } = await searchParams;
  const current = await getCurrentMonth(month);

  const [summary, breakdown, recent, trend, pie] = await Promise.all([
    getMonthSummary(userId, current.monthId),
    getCategoryBreakdown(userId, current.monthId),
    getRecentExpenses(userId, current.monthId, 5),
    getMonthlyTrend(userId, 6),
    getCategoryTotals(userId, current.monthId),
  ]);

  const trendForChart = [...trend].reverse().map((t) => ({
    label: t.label,
    income: t.income,
    expenses: t.expenses,
  }));

  return (
    <PageShell title="Dashboard" currentYearMonth={current.yearMonth}>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <SummaryCard label="Income" value={formatMoney(summary.totalIncome)} icon={Coins} />
        <SummaryCard label="Budgeted" value={formatMoney(summary.totalBudgeted)} icon={TagIcon} />
        <SummaryCard label="Spent" value={formatMoney(summary.totalSpent)} icon={Receipt} />
        <SummaryCard
          label="Remaining"
          value={formatMoney(summary.remaining)}
          icon={PiggyBank}
          tone={summary.remaining >= 0 ? "success" : "danger"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-8">
        <section className="lg:col-span-5 rounded-xl border bg-card p-5">
          <h2 className="text-sm font-medium mb-4">By category</h2>
          {pie.length === 0 ? (
            <EmptyState icon={PieIcon} title="No expenses yet" />
          ) : (
            <CategoryPie data={pie.map((p) => ({ name: p.name, total: p.total, color: p.color }))} />
          )}
        </section>
        <section className="lg:col-span-7 rounded-xl border bg-card p-5">
          <h2 className="text-sm font-medium mb-4">Budget vs spent</h2>
          {breakdown.length === 0 ? (
            <EmptyState icon={BarChart3} title="No categories yet" />
          ) : (
            <BudgetBar
              data={breakdown.map((c) => ({
                name: c.name,
                budgeted: c.budgetedAmount,
                spent: c.spent,
              }))}
            />
          )}
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <section className="lg:col-span-7 rounded-xl border bg-card p-5">
          <h2 className="text-sm font-medium mb-4">Last 6 months</h2>
          {trendForChart.length < 2 ? (
            <EmptyState icon={TrendingUp} title="Need at least 2 months of data" />
          ) : (
            <MonthlyTrend data={trendForChart} />
          )}
        </section>
        <section className="lg:col-span-5 rounded-xl border bg-card">
          <div className="flex items-center justify-between px-5 py-4 border-b">
            <h2 className="text-sm font-medium">Recent expenses</h2>
            <ButtonLink href="/expenses" size="sm" variant="ghost">
              View all
            </ButtonLink>
          </div>
          {recent.length === 0 ? (
            <div className="p-5">
              <EmptyState icon={Receipt} title="No expenses yet" />
            </div>
          ) : (
            <ul className="divide-y">
              {recent.map((r) => (
                <li key={r.id} className="flex items-center justify-between px-5 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm font-medium truncate">
                      <ColorDot color={r.categoryColor} />
                      <span className="truncate">{r.description}</span>
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {r.categoryName} · {formatDate(r.expenseDate)}
                    </div>
                  </div>
                  <span className="ml-3 font-mono tabular-nums text-sm">{formatMoney(r.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </PageShell>
  );
}
