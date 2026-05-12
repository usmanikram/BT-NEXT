import { FileSpreadsheet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/button-link";
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
import { formatMoney, monthLabel } from "@/lib/format";
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
    color: comp.colors[name] ?? "#6c757d",
  }));

  return (
    <PageShell title="Reports" currentYearMonth={current.yearMonth}>
      <div className="mb-6 flex flex-wrap items-center justify-end gap-2">
        <ButtonLink href={`/api/export?type=monthly&monthId=${current.monthId}`} size="sm" variant="outline">
          <FileSpreadsheet className="size-3.5" /> Export expenses
        </ButtonLink>
        <ButtonLink href={`/api/export?type=categories&monthId=${current.monthId}`} size="sm" variant="outline">
          <FileSpreadsheet className="size-3.5" /> Export categories
        </ButtonLink>
        <ButtonLink href={`/api/export?type=yearly&year=${year}`} size="sm" variant="outline">
          <FileSpreadsheet className="size-3.5" /> Export {year} summary
        </ButtonLink>
      </div>

      <section className="mb-8 rounded-xl border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b">
          <h2 className="text-sm font-medium">{monthLabel(current.yearMonth)} · Category summary</h2>
        </div>
        {cats.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-muted-foreground">No categories for this month.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Budgeted</TableHead>
                <TableHead className="text-right">Spent</TableHead>
                <TableHead className="text-right">Remaining</TableHead>
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
                  <TableRow key={c.id}>
                    <TableCell>
                      <span className="inline-flex items-center gap-2">
                        <ColorDot color={c.color} />
                        <span>{c.name}</span>
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{formatMoney(c.budgetedAmount)}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{formatMoney(c.spent)}</TableCell>
                    <TableCell
                      className={`text-right font-mono tabular-nums ${remaining < 0 ? "text-rose-600" : ""}`}
                    >
                      {formatMoney(remaining)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant={badgeTone}>{pct}%</Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="font-medium text-muted-foreground">Total</TableCell>
                <TableCell className="text-right font-semibold font-mono tabular-nums">{formatMoney(summary.totalBudgeted)}</TableCell>
                <TableCell className="text-right font-semibold font-mono tabular-nums">{formatMoney(summary.totalSpent)}</TableCell>
                <TableCell className="text-right font-semibold font-mono tabular-nums">
                  {formatMoney(summary.totalBudgeted - summary.totalSpent)}
                </TableCell>
                <TableCell />
              </TableRow>
            </TableFooter>
          </Table>
        )}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <section className="rounded-xl border bg-card p-5">
          <h2 className="text-sm font-medium mb-4">Income vs expenses · 12 months</h2>
          {trendForChart.length < 2 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Need more data</div>
          ) : (
            <MonthlyTrend data={trendForChart} />
          )}
        </section>
        <section className="rounded-xl border bg-card p-5">
          <h2 className="text-sm font-medium mb-4">Savings rate trend</h2>
          {savingsData.length < 2 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Need more data</div>
          ) : (
            <SavingsLine data={savingsData} />
          )}
        </section>
      </div>

      <section className="rounded-xl border bg-card p-5">
        <h2 className="text-sm font-medium mb-4">Category spending · last 6 months</h2>
        {comp.months.length < 2 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Need at least 2 months of data</div>
        ) : (
          <CategoryStack data={stackData} series={stackSeries} />
        )}
      </section>
    </PageShell>
  );
}
