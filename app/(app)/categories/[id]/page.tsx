import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { PageShell } from "@/components/page-shell";
import { CategoryForm } from "../category-form";
import { updateCategoryAction } from "@/actions/category";
import { db } from "@/lib/db";
import { categoriesV2, budgets } from "@/db/schema";
import { getCurrentMonth, requireUserId } from "@/lib/session";

export default async function EditCategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const userId = await requireUserId();
  const { id } = await params;
  const { month } = await searchParams;
  const current = await getCurrentMonth(month);

  const [row] = await db
    .select()
    .from(categoriesV2)
    .where(and(eq(categoriesV2.id, Number(id)), eq(categoriesV2.userId, userId)))
    .limit(1);

  if (!row) notFound();

  const [budget] = await db
    .select({ amount: budgets.amount })
    .from(budgets)
    .where(
      and(
        eq(budgets.userId, userId),
        eq(budgets.categoryId, row.id),
        eq(budgets.monthId, current.monthId)
      )
    )
    .limit(1);

  const categoryId = row.id;
  async function action(formData: FormData) {
    "use server";
    return updateCategoryAction(categoryId, formData);
  }

  return (
    <PageShell title="Edit pocket" currentYearMonth={current.yearMonth}>
      <div className="max-w-lg rounded-2xl bg-card p-6">
        <CategoryForm
          monthId={current.monthId}
          initial={{
            name: row.name,
            budgetedAmount: budget?.amount ?? "0",
            color: row.color,
            sortOrder: String(row.sortOrder),
          }}
          action={action}
          submitLabel="Save"
        />
      </div>
    </PageShell>
  );
}
