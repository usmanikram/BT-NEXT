import { Copy, Plus } from "lucide-react";
import { ButtonLink } from "@/components/button-link";
import { PageShell } from "@/components/page-shell";
import { EmptyState } from "@/components/empty-state";
import { getCurrentMonth, requireUserId } from "@/lib/session";
import { getCategoryBreakdown } from "@/lib/budget-service";
import { getNextYearMonth } from "@/lib/month";
import { monthLabel } from "@/lib/format";
import { CopyMonthForm } from "./copy-form";

export default async function CopyMonthPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const userId = await requireUserId();
  const { month } = await searchParams;
  const current = await getCurrentMonth(month);
  const cats = await getCategoryBreakdown(userId, current.monthId);
  const defaultTarget = getNextYearMonth(current.yearMonth);

  return (
    <PageShell title="Copy categories" currentYearMonth={current.yearMonth}>
      <p className="text-sm text-muted-foreground mb-6">
        Copying from <span className="text-foreground font-medium">{monthLabel(current.yearMonth)}</span> ·{" "}
        {cats.length} {cats.length === 1 ? "category" : "categories"}
      </p>
      {cats.length === 0 ? (
        <EmptyState
          icon={Copy}
          title="No categories to copy"
          description="Create categories for the current month first."
          action={
            <ButtonLink href="/categories/new" size="sm">
              <Plus className="size-3.5" /> Add category
            </ButtonLink>
          }
        />
      ) : (
        <CopyMonthForm
          sourceMonthId={current.monthId}
          defaultTarget={defaultTarget}
          categories={cats}
        />
      )}
    </PageShell>
  );
}
