import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { PageShell } from "@/components/page-shell";
import { IncomeForm } from "../income-form";
import { updateIncomeAction } from "@/actions/income";
import { db } from "@/lib/db";
import { income } from "@/db/schema";
import { getCurrentMonth, requireUserId } from "@/lib/session";

export default async function EditIncomePage({
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
    .from(income)
    .where(and(eq(income.id, Number(id)), eq(income.userId, userId)))
    .limit(1);

  if (!row) notFound();

  const incomeId = row.id;
  async function action(formData: FormData) {
    "use server";
    return updateIncomeAction(incomeId, formData);
  }

  return (
    <PageShell title="Edit income" currentYearMonth={current.yearMonth}>
      <div className="max-w-lg rounded-2xl bg-card p-6">
        <IncomeForm
          monthId={row.monthId}
          initial={{
            source: row.source,
            amount: row.amount,
            notes: row.notes ?? "",
          }}
          action={action}
          submitLabel="Save"
        />
      </div>
    </PageShell>
  );
}
