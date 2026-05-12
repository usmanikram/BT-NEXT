import Link from "next/link";
import { ArrowRight, PieChart as PieIcon, BarChart3, Receipt, TrendingUp } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { SummaryCard } from "@/components/summary-card";
import { Money } from "@/components/money";
import { CategoryIcon } from "@/components/category-icon";
import { EmptyState } from "@/components/empty-state";
import { HeroMascot } from "@/components/hero-mascot";
import { CategoryPie } from "@/components/charts/category-pie";
import { MonthlyTrend } from "@/components/charts/monthly-trend";
import { getCurrentMonth, getCurrentUser, requireUserId } from "@/lib/session";
import { formatDate } from "@/lib/format";
import {
  getCategoryBreakdown,
  getCategoryTotals,
  getMonthlyTrend,
  getMonthSummary,
  getRecentExpenses,
} from "@/lib/budget-service";
import { monthLabel as fmtMonth } from "@/lib/format";

function firstName(name: string) {
  return name.trim().split(/\s+/)[0];
}

function daysToPayday(yearMonth: string) {
  const [y, m] = yearMonth.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  const today = new Date();
  if (today.getFullYear() !== y || today.getMonth() + 1 !== m) return last;
  return Math.max(0, last - today.getDate());
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const userId = await requireUserId();
  const user = await getCurrentUser();
  const { month } = await searchParams;
  const current = await getCurrentMonth(month);

  const [summary, breakdown, recent, trend, pie] = await Promise.all([
    getMonthSummary(userId, current.monthId),
    getCategoryBreakdown(userId, current.monthId),
    getRecentExpenses(userId, current.monthId, 6),
    getMonthlyTrend(userId, 6),
    getCategoryTotals(userId, current.monthId),
  ]);

  const trendForChart = [...trend].reverse().map((t) => ({
    label: t.label,
    income: t.income,
    expenses: t.expenses,
  }));

  const incomeUsedPct =
    summary.totalIncome > 0 ? Math.round((summary.totalSpent / summary.totalIncome) * 100) : 0;

  const prev = trend.length > 1 ? trend[1] : null;
  const spentDelta = prev ? summary.totalSpent - prev.expenses : 0;
  const spentDeltaPretty = prev
    ? `${spentDelta >= 0 ? "↑" : "↓"} Rs ${Math.round(Math.abs(spentDelta) / 1000)}k vs last month`
    : "First month tracked";

  const topPockets = [...breakdown]
    .filter((c) => c.spent > 0)
    .sort((a, b) => b.spent - a.spent)
    .slice(0, 5);
  const topTotal = topPockets.reduce((s, c) => s + c.spent, 0) || 1;

  const monthOnly = fmtMonth(current.yearMonth).split(" ")[0];
  const heading = (
    <span>
      Your {monthOnly} looks{" "}
      <em className="not-italic text-coral font-display italic">cozy</em>.
    </span>
  );

  return (
    <PageShell
      title={heading}
      currentYearMonth={current.yearMonth}
      eyebrow={`Hey ${firstName(user.name ?? user.email)} 👋`}
    >
      {/* Coral hero with pill chips + mascot */}
      <section className="relative rounded-3xl bg-coral text-white overflow-hidden mb-6 shadow-[0_18px_40px_rgba(255,107,92,0.25)]">
        <div className="flex flex-col-reverse md:flex-row items-stretch">
          <div className="flex-1 px-8 py-8 md:py-10">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/85">
              Available to spend
            </p>
            <div className="mt-3">
              <Money value={summary.remaining} size="hero" className="text-white" />
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              <Chip>● {incomeUsedPct}% of income spent</Chip>
              <Chip>● {daysToPayday(current.yearMonth)} days to payday</Chip>
              <Chip>● 14-day streak</Chip>
            </div>
          </div>
          <div className="relative shrink-0 px-8 py-6 md:py-8 flex items-center justify-center">
            <HeroMascot />
          </div>
        </div>
      </section>

      {/* Summary trio */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <SummaryCard
          label="Income"
          value={summary.totalIncome}
          meta="3 sources · steady"
          blobColor="#7BCFA9"
        />
        <SummaryCard
          label="Budgeted"
          value={summary.totalBudgeted}
          meta={`${breakdown.length} pockets · ${
            summary.totalIncome > 0
              ? Math.round((summary.totalBudgeted / summary.totalIncome) * 100)
              : 0
          }% of income`}
          blobColor="#A98AD6"
        />
        <SummaryCard
          label="Spent"
          value={summary.totalSpent}
          meta={spentDeltaPretty}
          blobColor="#FFB199"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-6">
        <section className="lg:col-span-7 rounded-3xl bg-card p-7 shadow-[0_4px_14px_rgba(31,26,20,0.04)]">
          <h2 className="font-display text-2xl font-semibold tracking-tight">How {monthOnly} is going</h2>
          <p className="text-sm text-ink-soft">Daily spend pace</p>
          <div className="mt-5">
            {trendForChart.length < 2 ? (
              <EmptyState icon={TrendingUp} title="Need a couple of months to compare" />
            ) : (
              <MonthlyTrend data={trendForChart} />
            )}
          </div>
        </section>

        <section className="lg:col-span-5 rounded-3xl bg-card p-7 shadow-[0_4px_14px_rgba(31,26,20,0.04)]">
          <h2 className="font-display text-2xl font-semibold tracking-tight">Top pockets</h2>
          <p className="text-sm text-ink-soft">Where it goes</p>
          <ul className="mt-5 space-y-5">
            {topPockets.length === 0 ? (
              <EmptyState icon={PieIcon} title="Nothing spent yet" />
            ) : (
              topPockets.map((c) => {
                const pct = Math.round((c.spent / topTotal) * 100);
                return (
                  <li key={c.id}>
                    <div className="flex items-center gap-3">
                      <CategoryIcon name={c.name} color={c.color} size="md" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-medium truncate">{c.name}</span>
                          <span className="font-mono tabular-nums text-sm">{pct}%</span>
                        </div>
                        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-cream-soft">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${pct}%`, background: c.color }}
                          />
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })
            )}
          </ul>
        </section>
      </div>

      {/* Recent moves — grid of cards */}
      <section className="rounded-3xl bg-card p-7 shadow-[0_4px_14px_rgba(31,26,20,0.04)]">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="font-display text-2xl font-semibold tracking-tight">Recent moves</h2>
            <p className="text-sm text-ink-soft">Latest in your pockets</p>
          </div>
          <Link
            href="/expenses"
            className="inline-flex items-center gap-1 text-sm text-coral font-medium hover:underline"
          >
            See all <ArrowRight className="size-3.5" />
          </Link>
        </div>
        {recent.length === 0 ? (
          <EmptyState icon={Receipt} title="No spends yet" />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {recent.map((r) => (
              <div
                key={r.id}
                className="flex items-center gap-3 rounded-2xl bg-cream-soft px-3 py-2.5"
              >
                <CategoryIcon name={r.categoryName} color={r.categoryColor} size="md" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{r.description}</p>
                  <p className="text-xs text-ink-soft truncate">
                    {r.categoryName} · {formatDate(r.expenseDate)}
                  </p>
                </div>
                <span className="font-display text-base font-semibold tabular-nums">
                  <span className="text-xs text-ink-soft font-medium">Rs </span>
                  {new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(r.amount)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </PageShell>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs text-white">
      {children}
    </span>
  );
}
