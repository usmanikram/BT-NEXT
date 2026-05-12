import { PageShell } from "@/components/page-shell";
import { ExpenseForm } from "../expense-form";
import { createExpenseAction } from "@/actions/expense";
import { getCurrentMonth, requireUserId } from "@/lib/session";
import { getCategoryBreakdown } from "@/lib/budget-service";
import { getMonthEnd, getMonthStart } from "@/lib/month";

export default async function NewExpensePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const userId = await requireUserId();
  const { month } = await searchParams;
  const current = await getCurrentMonth(month);
  const cats = await getCategoryBreakdown(userId, current.monthId);

  return (
    <PageShell title="New spend" currentYearMonth={current.yearMonth}>
      <div className="max-w-lg rounded-2xl bg-card p-6">
        <ExpenseForm
          monthId={current.monthId}
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
            categoryId: "",
            expenseDate: new Date().toISOString().slice(0, 10),
            amount: "",
            description: "",
          }}
          action={createExpenseAction}
          submitLabel="Add it"
        />
      </div>
    </PageShell>
  );
}
