import { PageShell } from "@/components/page-shell";
import { IncomeForm } from "../income-form";
import { createIncomeAction } from "@/actions/income";
import { getCurrentMonth } from "@/lib/session";

export default async function NewIncomePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month } = await searchParams;
  const current = await getCurrentMonth(month);

  return (
    <PageShell title="Add income" currentYearMonth={current.yearMonth}>
      <div className="max-w-lg rounded-xl border bg-card p-6">
        <IncomeForm
          monthId={current.monthId}
          initial={{ source: "", amount: "", notes: "" }}
          action={createIncomeAction}
          submitLabel="Save"
        />
      </div>
    </PageShell>
  );
}
