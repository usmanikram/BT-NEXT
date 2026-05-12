import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { PageShell } from "@/components/page-shell";
import { ExpenseForm } from "../expense-form";
import { updateExpenseAction } from "@/actions/expense";
import { db } from "@/lib/db";
import { expenses } from "@/db/schema";
import { getCurrentMonth, requireUserId } from "@/lib/session";
import { getCategoryBreakdown } from "@/lib/budget-service";
import { getMonthEnd, getMonthStart } from "@/lib/month";

export default async function EditExpensePage({
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
    .from(expenses)
    .where(and(eq(expenses.id, Number(id)), eq(expenses.userId, userId)))
    .limit(1);

  if (!row) notFound();

  const cats = await getCategoryBreakdown(userId, row.monthId);
  const expenseId = row.id;
  async function action(formData: FormData) {
    "use server";
    return updateExpenseAction(expenseId, formData);
  }

  return (
    <PageShell title="Edit expense" currentYearMonth={current.yearMonth}>
      <div className="max-w-lg rounded-xl border bg-card p-6">
        <ExpenseForm
          monthId={row.monthId}
          yearMonth={current.yearMonth}
          monthStart={getMonthStart(current.yearMonth)}
          monthEnd={getMonthEnd(current.yearMonth)}
          categories={cats.map((c) => ({
            id: c.id,
            name: c.name,
            budgeted: c.budgetedAmount,
            spent: c.spent,
          }))}
          initial={{
            categoryId: String(row.categoryId),
            expenseDate: row.expenseDate,
            amount: row.amount,
            description: row.description,
          }}
          action={action}
          submitLabel="Update"
        />
      </div>
    </PageShell>
  );
}
