import Link from "next/link";
import { eq } from "drizzle-orm";
import { ArrowRight, PieChart as PieIcon, Receipt, TrendingUp } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { SummaryCard } from "@/components/summary-card";
import { Money } from "@/components/money";
import { CategoryIcon } from "@/components/category-icon";
import { EmptyState } from "@/components/empty-state";
import { HeroMascot } from "@/components/hero-mascot";
import { MonthlyTrend } from "@/components/charts/monthly-trend";
import { getCurrentMonth, getCurrentUser, requireUserId } from "@/lib/session";
import { formatDate } from "@/lib/format";
import { db } from "@/lib/db";
import { users } from "@/db/schema";
import { listSources } from "@/lib/source-service";
import { sumInCurrency } from "@/lib/fx";
import {
  getBudgetAlerts,
  getCategoryBreakdown,
  getMonthlyTrend,
  getMonthSummary,
  getRecentExpenses,
} from "@/lib/budget-service";
import { listGoals } from "@/lib/goal-service";
import { getOverallBalances, summarizeBalances } from "@/lib/settlement-service";
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

  const [summary, breakdown, recent, trend, sources, userRow, alerts, goals, balances] = await Promise.all([
    getMonthSummary(userId, current.monthId),
    getCategoryBreakdown(userId, current.monthId),
    getRecentExpenses(userId, current.monthId, 6),
    getMonthlyTrend(userId, 6),
    listSources(userId, false),
    db.select({ defaultCurrency: users.defaultCurrency }).from(users).where(eq(users.id, userId)).limit(1).then((r) => r[0]),
    getBudgetAlerts(userId, current.monthId),
    listGoals(userId),
    getOverallBalances(userId),
  ]);
  const activeGoals = goals.filter((g) => !g.completedAt).slice(0, 3);
  const balanceTotals = summarizeBalances(balances);

  // Total balance summed by currency, then rolled up to default via FX.
  const balanceByCurrency = sources.reduce<Record<string, number>>((acc, s) => {
    acc[s.currency] = (acc[s.currency] ?? 0) + s.balance;
    return acc;
  }, {});
  const defaultCurrency = userRow?.defaultCurrency ?? "PKR";
  const totalBalanceInDefault = await sumInCurrency(
    Object.entries(balanceByCurrency).map(([currency, amount]) => ({ currency, amount })),
    defaultCurrency
  );
  const otherCurrencies = Object.entries(balanceByCurrency).filter(([cur]) => cur !== defaultCurrency);

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

      {/* Budget alerts banner */}
      {alerts.length > 0 && (
        <div className="mb-6 rounded-2xl bg-coral-soft px-4 py-3 text-sm text-ink">
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-block size-2 rounded-full bg-coral" />
            <strong className="font-medium">
              {alerts.length} pocket{alerts.length === 1 ? "" : "s"} need{alerts.length === 1 ? "s" : ""} attention
            </strong>
          </div>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-soft">
            {alerts.slice(0, 4).map((a) => (
              <li key={a.categoryId}>
                <span className="font-medium text-ink">{a.name}</span>{" "}
                <span className={a.severity === "over" ? "text-coral font-medium" : a.severity === "danger" ? "text-coral" : ""}>
                  {Math.round(a.percent)}% used{a.severity === "over" ? " · over" : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Summary quartet — Total Balance + Income + Budgeted + Spent */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <SummaryCard
          label="Total balance"
          value={totalBalanceInDefault}
          prefix={defaultCurrency}
          meta={
            otherCurrencies.length > 0
              ? `+ ${otherCurrencies.map(([c, v]) => `${c} ${v.toFixed(0)}`).join(", ")}`
              : `${sources.length} source${sources.length === 1 ? "" : "s"}`
          }
          blobColor="#FFD86B"
        />
        <SummaryCard
          label="Income"
          value={summary.totalIncome}
          meta={`This month · ${summary.totalIncome > 0 ? "steady" : "none yet"}`}
          blobColor="#7BCFA9"
        />
        <SummaryCard
          label="Budgeted"
          value={summary.totalBudgeted}
          meta={`${breakdown.length} pocket${breakdown.length === 1 ? "" : "s"} · ${
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

      {/* Shared balances tile */}
      {Object.keys(balanceTotals).length > 0 && (
        <section className="rounded-3xl bg-card p-7 mb-6 shadow-[0_4px_14px_rgba(31,26,20,0.04)]">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="font-display text-2xl font-semibold tracking-tight">Shared balances</h2>
              <p className="text-sm text-ink-soft">Who owes whom across groups and friends</p>
            </div>
            <Link href="/balances" className="inline-flex items-center gap-1 text-sm text-coral font-medium hover:underline">
              See all <ArrowRight className="size-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Object.entries(balanceTotals).map(([cur, t]) => (
              <div key={cur} className="rounded-2xl bg-cream-soft p-4">
                <p className="text-[10px] uppercase tracking-wider text-ink-soft">{cur}</p>
                <div className="mt-1 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-[11px] text-ink-soft">You&apos;re owed</p>
                    <Money value={t.owed} prefix={cur} size="sm" className="text-green" />
                  </div>
                  <div>
                    <p className="text-[11px] text-ink-soft">You owe</p>
                    <Money value={t.owe} prefix={cur} size="sm" className="text-coral" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Goals widget */}
      {activeGoals.length > 0 && (
        <section className="rounded-3xl bg-card p-7 mb-6 shadow-[0_4px_14px_rgba(31,26,20,0.04)]">
          <div className="flex items-start justify-between mb-5">
            <div>
              <h2 className="font-display text-2xl font-semibold tracking-tight">Goals</h2>
              <p className="text-sm text-ink-soft">What you&apos;re saving toward</p>
            </div>
            <Link href="/goals" className="inline-flex items-center gap-1 text-sm text-coral font-medium hover:underline">
              See all <ArrowRight className="size-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {activeGoals.map((g) => (
              <Link key={g.id} href={`/goals/${g.id}`} className="block rounded-2xl bg-cream-soft p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium truncate">{g.name}</span>
                  <span className="text-xs text-ink-soft font-mono tabular-nums">
                    {Math.round(g.percent)}%
                  </span>
                </div>
                <div className="mt-2 flex items-baseline gap-1">
                  <Money value={g.currentAmount} prefix={g.currency} size="sm" />
                  <span className="text-xs text-ink-soft">
                    / <Money value={g.targetAmount} prefix={g.currency} size="sm" />
                  </span>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-card">
                  <div className="h-full" style={{ width: `${g.percent}%`, background: g.color }} />
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Recent moves — grid of cards */}
      <section className="rounded-3xl bg-card p-7 shadow-[0_4px_14px_rgba(31,26,20,0.04)]">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="font-display text-2xl font-semibold tracking-tight">Recent moves</h2>
            <p className="text-sm text-ink-soft">Latest in your pockets</p>
          </div>
          <Link
            href="/transactions"
            className="inline-flex items-center gap-1 text-sm text-coral font-medium hover:underline"
          >
            See all <ArrowRight className="size-3.5" />
          </Link>
        </div>
        {recent.length === 0 ? (
          <EmptyState icon={Receipt} title="No spends yet" />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {recent.map((r) => {
              const sharedLabel = r.isShared
                ? r.payerName
                  ? `Paid by ${r.payerName}${r.groupName ? ` · ${r.groupName}` : ""}`
                  : `Shared${r.groupName ? ` · ${r.groupName}` : ""}`
                : null;
              return (
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
                    {sharedLabel && (
                      <p className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-coral">
                        <span className="inline-block size-1.5 rounded-full bg-coral" />
                        {sharedLabel}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="font-display text-base font-semibold tabular-nums">
                      <span className="text-xs text-ink-soft font-medium">Rs </span>
                      {new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(r.amount)}
                    </span>
                    {r.isShared && r.payerName && (
                      <p className="text-[10px] text-ink-soft">your share</p>
                    )}
                  </div>
                </div>
              );
            })}
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
