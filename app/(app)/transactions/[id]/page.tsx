import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { format } from "date-fns";
import { PageShell } from "@/components/page-shell";
import { TransactionForm } from "../transaction-form";
import { updateTransactionAction } from "@/actions/transaction";
import { getCurrentMonth, requireUserId } from "@/lib/session";
import { db } from "@/lib/db";
import { categoriesV2, sources, transactions } from "@/db/schema";

export default async function EditTransactionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const userId = await requireUserId();
  const { id: idStr } = await params;
  const { month } = await searchParams;
  const current = await getCurrentMonth(month);

  const txnId = Number(idStr);
  const [row] = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.id, txnId), eq(transactions.userId, userId)))
    .limit(1);
  if (!row) notFound();

  const sourceOptions = await db
    .select({ id: sources.id, name: sources.name, currency: sources.currency, type: sources.type })
    .from(sources)
    .where(eq(sources.userId, userId))
    .orderBy(asc(sources.createdAt));

  const categoryOptions = await db
    .select({ id: categoriesV2.id, name: categoriesV2.name })
    .from(categoriesV2)
    .where(eq(categoriesV2.userId, userId))
    .orderBy(asc(categoriesV2.sortOrder), asc(categoriesV2.name));

  async function update(formData: FormData) {
    "use server";
    return updateTransactionAction(txnId, formData);
  }

  return (
    <PageShell title="Edit transaction" currentYearMonth={current.yearMonth}>
      <div className="max-w-xl rounded-2xl bg-card p-6">
        <TransactionForm
          initial={{
            kind: row.kind,
            sourceId: row.sourceId,
            destSourceId: row.destSourceId ?? "",
            categoryId: row.categoryId ?? "",
            amount: row.amount,
            currency: row.currency,
            occurredAt: format(row.occurredAt, "yyyy-MM-dd"),
            description: row.description ?? "",
            notes: row.notes ?? "",
          }}
          sources={sourceOptions}
          categories={categoryOptions}
          action={update}
          submitLabel="Save"
        />
      </div>
    </PageShell>
  );
}
