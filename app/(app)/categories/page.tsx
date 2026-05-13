import { Plus, Copy, Wallet, Pencil, AlertTriangle } from "lucide-react";
import { ButtonLink } from "@/components/button-link";
import { PageShell } from "@/components/page-shell";
import { Money } from "@/components/money";
import { CategoryIcon } from "@/components/category-icon";
import { EmptyState } from "@/components/empty-state";
import { ConfirmDelete } from "@/components/confirm-delete";
import { getCurrentMonth, requireUserId } from "@/lib/session";
import { getCategoryBreakdown, getMonthSummary } from "@/lib/budget-service";
import { cn } from "@/lib/utils";
import { deleteCategoryAction } from "@/actions/category";

function progressTone(pct: number) {
  if (pct <= 75) return "bg-green";
  if (pct <= 90) return "bg-yellow";
  return "bg-coral";
}

function daysLeftInMonth(yearMonth: string) {
  const [y, m] = yearMonth.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  const today = new Date();
  if (today.getFullYear() !== y || today.getMonth() + 1 !== m) return last;
  return Math.max(0, last - today.getDate());
}

function MiniStat({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-card px-4 py-3 shadow-[0_4px_14px_rgba(31,26,20,0.04)]">
      <span
        className="inline-block size-9 shrink-0 rounded-xl"
        style={{ background: color, boxShadow: `0 4px 10px ${color}40` }}
      />
      <div className="min-w-0">
        <p className="text-xs text-ink-soft">{label}</p>
        <Money value={value} size="md" />
      </div>
    </div>
  );
}

export default async function CategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const userId = await requireUserId();
  const { month } = await searchParams;
  const current = await getCurrentMonth(month);

  const [summary, cats] = await Promise.all([
    getMonthSummary(userId, current.monthId),
    getCategoryBreakdown(userId, current.monthId),
  ]);

  const daysLeft = daysLeftInMonth(current.yearMonth);
  const saved = summary.totalIncome - summary.totalSpent;

  return (
    <PageShell title="Your pockets" currentYearMonth={current.yearMonth}>
      {/* Top action row */}
      <div className="mb-6 flex flex-wrap items-center justify-end gap-2">
        <ButtonLink href="/categories/copy" variant="outline" size="sm" className="bg-card border-0 shadow-sm">
          <Copy className="size-3.5" /> Copy from last month
        </ButtonLink>
        <ButtonLink href="/categories/new" size="sm" className="rounded-full px-4">
          <Plus className="size-3.5" /> New pocket
        </ButtonLink>
      </div>

      {/* Mini stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <MiniStat label="Budgeted" value={summary.totalBudgeted} color="#A98AD6" />
        <MiniStat label="Spent" value={summary.totalSpent} color="#FF6B5C" />
        <MiniStat label="Saved this month" value={Math.max(0, saved)} color="#7BCFA9" />
        <MiniStat label="Unallocated" value={Math.abs(summary.unallocated)} color="#FFD86B" />
      </div>

      {summary.unallocated < 0 && (
        <div className="mb-6 flex items-center gap-2 rounded-2xl bg-coral-soft px-4 py-3 text-sm text-ink">
          <AlertTriangle className="size-4 shrink-0 text-coral" />
          <span>
            You&apos;ve over-allocated by{" "}
            <strong>
              <Money value={Math.abs(summary.unallocated)} size="sm" />
            </strong>
            . Time to trim or earn more.
          </span>
        </div>
      )}

      {cats.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="No pockets yet"
          description="Bills, savings, treats — whatever you save up for."
          action={
            <div className="flex gap-2 justify-center">
              <ButtonLink href="/categories/new" size="sm" className="rounded-full px-4">
                <Plus className="size-3.5" /> New pocket
              </ButtonLink>
              <ButtonLink href="/categories/copy" variant="outline" size="sm">
                <Copy className="size-3.5" /> Copy from previous
              </ButtonLink>
            </div>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {cats.map((c) => {
            const remaining = c.budgetedAmount - c.spent;
            const pct = c.budgetedAmount > 0 ? Math.min((c.spent / c.budgetedAmount) * 100, 100) : 0;
            const overBudget = c.spent > c.budgetedAmount;
            const allUsed = pct >= 100 && !overBudget;
            return (
              <div
                key={c.id}
                className="relative rounded-3xl bg-card p-6 overflow-hidden shadow-[0_4px_14px_rgba(31,26,20,0.04)]"
              >
                {/* Decorative tinted blob (top-right) */}
                <div
                  className="pointer-events-none absolute -top-8 -right-8 size-32 rounded-full opacity-25"
                  style={{ background: c.color, filter: "blur(4px)" }}
                  aria-hidden
                />

                <div className="relative flex items-start justify-between gap-2">
                  <div className="flex items-start gap-3 min-w-0">
                    <CategoryIcon name={c.name} color={c.color} size="md" />
                    <div className="min-w-0">
                      <h3 className="font-display text-lg font-semibold tracking-tight truncate">
                        {c.name}
                      </h3>
                      <p
                        className={cn(
                          "text-xs mt-0.5",
                          overBudget ? "text-coral font-medium" : "text-ink-soft"
                        )}
                      >
                        {overBudget ? (
                          <>
                            Over by <Money value={Math.abs(remaining)} size="sm" />
                          </>
                        ) : allUsed ? (
                          "All used up"
                        ) : (
                          <>
                            <Money value={remaining} size="sm" /> left
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 -mr-1 -mt-1">
                    <ButtonLink href={`/categories/${c.id}`} variant="ghost" size="icon" className="size-7">
                      <Pencil className="size-3.5" />
                    </ButtonLink>
                    <ConfirmDelete
                      title="Remove from this month?"
                      description="The pocket stays in your list — only this month's budget cap is removed."
                      onConfirm={async () => {
                        "use server";
                        return deleteCategoryAction(c.id, current.monthId);
                      }}
                    />
                  </div>
                </div>

                <div className="relative mt-5 flex items-baseline gap-2">
                  <Money value={c.spent} size="xl" />
                  <span className="text-xs text-ink-soft">
                    of <Money value={c.budgetedAmount} size="sm" />
                  </span>
                </div>

                <div className="relative mt-4 h-2 w-full overflow-hidden rounded-full bg-cream-soft">
                  <div
                    className={cn("h-full transition-all", progressTone(pct))}
                    style={{ width: `${pct}%` }}
                  />
                </div>

                <div className="relative mt-3 flex items-center justify-between text-xs text-ink-soft">
                  <span className="font-mono tabular-nums">{Math.round(pct)}% used</span>
                  <span>{daysLeft} days left</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </PageShell>
  );
}
