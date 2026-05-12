import { Plus, Copy, Tags, Pencil, AlertTriangle, Coins, Tag as TagIcon, CheckCircle2, PiggyBank } from "lucide-react";
import { ButtonLink } from "@/components/button-link";
import { PageShell } from "@/components/page-shell";
import { SummaryCard } from "@/components/summary-card";
import { ColorDot } from "@/components/color-dot";
import { EmptyState } from "@/components/empty-state";
import { ConfirmDelete } from "@/components/confirm-delete";
import { getCurrentMonth, requireUserId } from "@/lib/session";
import { formatMoney, monthLabel } from "@/lib/format";
import { getCategoryBreakdown, getMonthSummary } from "@/lib/budget-service";
import { cn } from "@/lib/utils";
import { deleteCategoryAction } from "@/actions/category";

function progressTone(pct: number) {
  if (pct <= 75) return "bg-emerald-500";
  if (pct <= 90) return "bg-amber-500";
  return "bg-rose-500";
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

  return (
    <PageShell title="Categories" currentYearMonth={current.yearMonth}>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <SummaryCard label="Income" value={formatMoney(summary.totalIncome)} icon={Coins} />
        <SummaryCard label="Budgeted" value={formatMoney(summary.totalBudgeted)} icon={TagIcon} />
        <SummaryCard label="Spent" value={formatMoney(summary.totalSpent)} icon={CheckCircle2} />
        <SummaryCard
          label="Unallocated"
          value={formatMoney(summary.unallocated)}
          icon={PiggyBank}
          tone={summary.unallocated < 0 ? "danger" : "neutral"}
        />
      </div>

      {summary.unallocated < 0 && (
        <div className="mb-6 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertTriangle className="size-4 shrink-0" />
          <span>
            Over-allocated by <strong>{formatMoney(Math.abs(summary.unallocated))}</strong>. Your budgets exceed your income.
          </span>
        </div>
      )}

      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {cats.length} {cats.length === 1 ? "category" : "categories"} · {monthLabel(current.yearMonth)}
        </span>
        <div className="flex gap-2">
          <ButtonLink href="/categories/copy" variant="outline" size="sm">
            <Copy className="size-3.5" /> Copy to next month
          </ButtonLink>
          <ButtonLink href="/categories/new" size="sm">
            <Plus className="size-3.5" /> Add category
          </ButtonLink>
        </div>
      </div>

      {cats.length === 0 ? (
        <EmptyState
          icon={Tags}
          title="No categories yet"
          description="Create budget categories or copy from a previous month."
          action={
            <div className="flex gap-2 justify-center">
              <ButtonLink href="/categories/new" size="sm">
                <Plus className="size-3.5" /> Add category
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
            return (
              <div key={c.id} className="rounded-xl border bg-card p-5">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <ColorDot color={c.color} />
                    <h3 className="text-sm font-medium truncate">{c.name}</h3>
                  </div>
                  <div className="flex shrink-0 -mr-2">
                    <ButtonLink href={`/categories/${c.id}`} variant="ghost" size="icon" className="size-7">
                      <Pencil className="size-3.5" />
                    </ButtonLink>
                    <ConfirmDelete
                      onConfirm={async () => {
                        "use server";
                        return deleteCategoryAction(c.id);
                      }}
                    />
                  </div>
                </div>

                <div className="mb-3 flex items-baseline justify-between">
                  <span className="text-2xl font-semibold tracking-tight font-mono tabular-nums">
                    {formatMoney(c.spent)}
                  </span>
                  <span className="text-xs text-muted-foreground font-mono">
                    / {formatMoney(c.budgetedAmount)}
                  </span>
                </div>

                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn("h-full transition-all", progressTone(pct))}
                    style={{ width: `${pct}%` }}
                  />
                </div>

                <div className="mt-3 flex items-center justify-between text-xs">
                  <span
                    className={cn(
                      "font-mono tabular-nums",
                      overBudget ? "text-rose-600 font-medium" : "text-muted-foreground"
                    )}
                  >
                    {overBudget ? "Over " : "Left "}
                    {formatMoney(Math.abs(remaining))}
                  </span>
                  <span className="text-muted-foreground">{Math.round(pct)}%</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </PageShell>
  );
}
