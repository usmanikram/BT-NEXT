import { eq, and, asc } from "drizzle-orm";
import { format } from "date-fns";
import { PageShell } from "@/components/page-shell";
import { TransactionForm } from "../transaction-form";
import { createTransactionAction } from "@/actions/transaction";
import { getCurrentMonth, requireUserId } from "@/lib/session";
import { db } from "@/lib/db";
import { sources, categoriesV2, users } from "@/db/schema";

export default async function NewTransactionPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; kind?: string; sourceId?: string }>;
}) {
  const userId = await requireUserId();
  const { month, kind, sourceId: prefilledSourceId } = await searchParams;
  const current = await getCurrentMonth(month);

  const [userRow] = await db
    .select({ defaultCurrency: users.defaultCurrency })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const sourceOptions = await db
    .select({ id: sources.id, name: sources.name, currency: sources.currency, type: sources.type })
    .from(sources)
    .where(and(eq(sources.userId, userId), eq(sources.archived, false)))
    .orderBy(asc(sources.createdAt));

  const categoryOptions = await db
    .select({ id: categoriesV2.id, name: categoriesV2.name })
    .from(categoriesV2)
    .where(and(eq(categoriesV2.userId, userId), eq(categoriesV2.archived, false)))
    .orderBy(asc(categoriesV2.sortOrder), asc(categoriesV2.name));

  const defaultSource = prefilledSourceId
    ? sourceOptions.find((s) => s.id === Number(prefilledSourceId))
    : sourceOptions[0];

  const initialKind: "income" | "expense" | "transfer" =
    kind === "income" || kind === "expense" || kind === "transfer" ? kind : "expense";

  return (
    <PageShell title="New transaction" currentYearMonth={current.yearMonth} eyebrow="Income, expense, or transfer">
      <div className="max-w-xl rounded-2xl bg-card p-6">
        <TransactionForm
          initial={{
            kind: initialKind,
            sourceId: defaultSource?.id ?? "",
            destSourceId: "",
            categoryId: "",
            amount: "",
            currency: defaultSource?.currency ?? userRow?.defaultCurrency ?? "PKR",
            occurredAt: format(new Date(), "yyyy-MM-dd"),
            description: "",
            notes: "",
          }}
          sources={sourceOptions}
          categories={categoryOptions}
          action={createTransactionAction}
          submitLabel="Add transaction"
        />
      </div>
    </PageShell>
  );
}
