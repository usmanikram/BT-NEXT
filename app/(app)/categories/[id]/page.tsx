import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { PageShell } from "@/components/page-shell";
import { CategoryForm } from "../category-form";
import { updateCategoryAction } from "@/actions/category";
import { db } from "@/lib/db";
import { categories } from "@/db/schema";
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
    .from(categories)
    .where(and(eq(categories.id, Number(id)), eq(categories.userId, userId)))
    .limit(1);

  if (!row) notFound();

  const categoryId = row.id;
  async function action(formData: FormData) {
    "use server";
    return updateCategoryAction(categoryId, formData);
  }

  return (
    <PageShell title="Edit category" currentYearMonth={current.yearMonth}>
      <div className="max-w-lg rounded-xl border bg-card p-6">
        <CategoryForm
          monthId={row.monthId}
          initial={{
            name: row.name,
            budgetedAmount: row.budgetedAmount,
            color: row.color,
            sortOrder: String(row.sortOrder),
          }}
          action={action}
          submitLabel="Update"
        />
      </div>
    </PageShell>
  );
}
