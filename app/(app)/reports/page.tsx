import { FileSpreadsheet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/button-link";
import { Money } from "@/components/money";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageShell } from "@/components/page-shell";
import { ColorDot } from "@/components/color-dot";
import { MonthlyTrend } from "@/components/charts/monthly-trend";
import { SavingsLine } from "@/components/charts/savings-line";
import { CategoryStack } from "@/components/charts/category-stack";
import { getCurrentMonth, requireUserId } from "@/lib/session";
import { monthLabel } from "@/lib/format";
import {
  getCategoryBreakdown,
  getCategoryComparisonAcrossMonths,
  getMonthlyTrend,
  getMonthSummary,
  getSavingsRateTrend,
} from "@/lib/budget-service";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const userId = await requireUserId();
  const { month } = await searchParams;
  const current = await getCurrentMonth(month);
  const year = current.yearMonth.slice(0, 4);

  const [summary, cats, trend, savings, comp] = await Promise.all([
    getMonthSummary(userId, current.monthId),
    getCategoryBreakdown(userId, current.monthId),
    getMonthlyTrend(userId, 12),
    getSavingsRateTrend(userId, 12),
    getCategoryComparisonAcrossMonths(userId, 6),
  ]);

  const trendForChart = [...trend].reverse().map((t) => ({
    label: t.label,
    income: t.income,
    expenses: t.expenses,
  }));

  const savingsData = savings.map((s) => ({
    label: s.label,
    rate: s.income > 0 ? Math.round(((s.income - s.expenses) / s.income) * 1000) / 10 : 0,
  }));

  const stackData = comp.months.map((m) => {
    const row: Record<string, string | number> = { label: m.label };
    for (const catName of comp.categories) {
      row[catName] = comp.data[m.monthId]?.[catName] ?? 0;
    }
    return row;
  });

  const stackSeries = comp.categories.map((name) => ({
    name,
    color: comp.colors[name] ?? "#1F1A14",
  }));

  return (
    <PageShell title="Reports" currentYearMonth={current.yearMonth}>
      <div className="mb-6 flex flex-wrap items-center justify-end gap-2">
        <ButtonLink href={`/api/export?type=monthly&monthId=${current.monthId}`} size="sm" variant="outline">
          <FileSpreadsheet className="size-3.5" /> Export spends
        </ButtonLink>
        <ButtonLink href={`/api/export?type=categories&monthId=${current.monthId}`} size="sm" variant="outline">
          <FileSpreadsheet className="size-3.5" /> Export pockets
        </ButtonLink>
        <ButtonLink href={`/api/export?type=yearly&year=${year}`} size="sm" variant="outline">
          <FileSpreadsheet className="size-3.5" /> Export {year}
        </ButtonLink>
      </div>

      <section className="mb-8 rounded-2xl bg-card overflow-hidden">
        <div className="px-6 pt-5 pb-4">
          <h2 className="font-display text-lg font-semibold">{monthLabel(current.yearMonth)} summary</h2>
          <p className="text-xs text-ink-soft mt-0.5">How each pocket is doing</p>
        </div>
        {cats.length === 0 ? (
          <div className="px-6 pb-8 pt-2 text-center text-sm text-ink-soft">No pockets for this month.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-ink/5 hover:bg-transparent">
                <TableHead>Pocket</TableHead>
                <TableHead className="text-right">Budgeted</TableHead>
                <TableHead className="text-right">Spent</TableHead>
                <TableHead className="text-right">Left</TableHead>
                <TableHead className="text-right">% used</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cats.map((c) => {
                const remaining = c.budgetedAmount - c.spent;
                const pct =
                  c.budgetedAmount > 0
                    ? Math.round(((c.spent / c.budgetedAmount) * 100) * 10) / 10
                    : 0;
                const badgeTone = pct > 100 ? "destructive" : pct > 75 ? "secondary" : "default";
                return (
                  <TableRow key={c.id} className="border-ink/5">
                    <TableCell>
                      <span className="inline-flex items-center gap-2">
                        <ColorDot color={c.color} />
                        <span>{c.name}</span>
                      </span>
                    </TableCell>
                    <TableCell className="text-right"><Money value={c.budgetedAmount} size="sm" /></TableCell>
                    <TableCell className="text-right"><Money value={c.spent} size="sm" /></TableCell>
                    <TableCell className={`text-right ${remaining < 0 ? "text-coral" : ""}`}>
                      <Money value={remaining} size="sm" />
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant={badgeTone}>{pct}%</Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            <TableFooter>
              <TableRow className="border-ink/5">
                <TableCell className="font-medium text-ink-soft">Total</TableCell>
                <TableCell className="text-right"><Money value={summary.totalBudgeted} size="sm" /></TableCell>
                <TableCell className="text-right"><Money value={summary.totalSpent} size="sm" /></TableCell>
                <TableCell className="text-right"><Money value={summary.totalBudgeted - summary.totalSpent} size="sm" /></TableCell>
                <TableCell />
              </TableRow>
            </TableFooter>
          </Table>
        )}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <section className="rounded-2xl bg-card p-6">
          <h2 className="font-display text-lg font-semibold">Income vs spending</h2>
          <p className="text-xs text-ink-soft mt-0.5 mb-4">Last 12 months</p>
          {trendForChart.length < 2 ? (
            <div className="py-10 text-center text-sm text-ink-soft">Need more data</div>
          ) : (
            <MonthlyTrend data={trendForChart} />
          )}
        </section>
        <section className="rounded-2xl bg-card p-6">
          <h2 className="font-display text-lg font-semibold">Savings rate</h2>
          <p className="text-xs text-ink-soft mt-0.5 mb-4">Percent saved each month</p>
          {savingsData.length < 2 ? (
            <div className="py-10 text-center text-sm text-ink-soft">Need more data</div>
          ) : (
            <SavingsLine data={savingsData} />
          )}
        </section>
      </div>

      <section className="rounded-2xl bg-card p-6">
        <h2 className="font-display text-lg font-semibold">Pocket comparison</h2>
        <p className="text-xs text-ink-soft mt-0.5 mb-4">Last 6 months stacked</p>
        {comp.months.length < 2 ? (
          <div className="py-10 text-center text-sm text-ink-soft">Need at least 2 months of data</div>
        ) : (
          <CategoryStack data={stackData} series={stackSeries} />
        )}
      </section>
    </PageShell>
  );
}
