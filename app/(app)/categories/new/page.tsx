import { PageShell } from "@/components/page-shell";
import { CategoryForm } from "../category-form";
import { createCategoryAction } from "@/actions/category";
import { getCurrentMonth } from "@/lib/session";
import { CATEGORY_COLORS } from "@/lib/constants";

export default async function NewCategoryPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month } = await searchParams;
  const current = await getCurrentMonth(month);

  return (
    <PageShell title="Add category" currentYearMonth={current.yearMonth}>
      <div className="max-w-lg rounded-xl border bg-card p-6">
        <CategoryForm
          monthId={current.monthId}
          initial={{
            name: "",
            budgetedAmount: "",
            color: CATEGORY_COLORS[0],
            sortOrder: "0",
          }}
          action={createCategoryAction}
          submitLabel="Save"
        />
      </div>
    </PageShell>
  );
}
