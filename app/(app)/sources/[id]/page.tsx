import { notFound } from "next/navigation";
import { and, desc, eq, sql } from "drizzle-orm";
import { Pencil, ArrowLeftRight, ArrowDown, ArrowUp } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Money } from "@/components/money";
import { ButtonLink } from "@/components/button-link";
import { SourceIcon, sourceTypeLabel } from "@/components/source-icon";
import { ConfirmDelete } from "@/components/confirm-delete";
import { SourceForm } from "../source-form";
import { db } from "@/lib/db";
import { transactions, categoriesV2 } from "@/db/schema";
import { getSource } from "@/lib/source-service";
import { getCurrentMonth, requireUserId } from "@/lib/session";
import { updateSourceAction, deleteSourceAction, archiveSourceAction } from "@/actions/source";
import { formatDate } from "@/lib/format";

export default async function SourceDetailPage({
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

  const sourceId = Number(idStr);
  const source = await getSource(userId, sourceId);
  if (!source) notFound();

  // Recent transactions touching this source (income IN, expense OUT, transfer either side).
  const history = await db
    .select({
      id: transactions.id,
      kind: transactions.kind,
      amount: transactions.amount,
      currency: transactions.currency,
      occurredAt: transactions.occurredAt,
      description: transactions.description,
      sourceId: transactions.sourceId,
      destSourceId: transactions.destSourceId,
      categoryName: categoriesV2.name,
    })
    .from(transactions)
    .leftJoin(categoriesV2, eq(transactions.categoryId, categoriesV2.id))
    .where(
      and(
        eq(transactions.userId, userId),
        sql`(${transactions.sourceId} = ${sourceId} OR ${transactions.destSourceId} = ${sourceId})`
      )
    )
    .orderBy(desc(transactions.occurredAt))
    .limit(50);

  async function update(formData: FormData) {
    "use server";
    return updateSourceAction(sourceId, formData);
  }

  return (
    <PageShell title={source.name} currentYearMonth={current.yearMonth} eyebrow={sourceTypeLabel(source.type)}>
      <section className="rounded-3xl bg-card px-7 py-7 mb-6 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <SourceIcon type={source.type} color={source.color} size="lg" />
          <div>
            <p className="text-xs uppercase tracking-wider text-ink-soft mb-1">Current balance</p>
            <Money value={source.balance} prefix={source.currency} size="xl" />
            <p className="mt-1 text-xs text-ink-soft">
              Opening {source.currency} {parseFloat(source.openingBalance).toFixed(2)} · created {formatDate(source.createdAt)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/transactions/new" variant="outline">
            <Pencil className="size-3.5" /> New transaction
          </ButtonLink>
        </div>
      </section>

      <div className="grid lg:grid-cols-[1fr_360px] gap-6">
        <section>
          <h2 className="font-display text-lg font-semibold mb-3">Recent activity</h2>
          {history.length === 0 ? (
            <div className="rounded-2xl bg-card p-6 text-sm text-ink-soft text-center">
              No transactions yet for this source.
            </div>
          ) : (
            <ul className="rounded-2xl bg-card divide-y divide-ink/5 overflow-hidden">
              {history.map((t) => {
                const isOut = (t.kind === "expense" && t.sourceId === sourceId) ||
                              (t.kind === "transfer" && t.sourceId === sourceId);
                const isIn = (t.kind === "income") ||
                             (t.kind === "transfer" && t.destSourceId === sourceId);
                const Icon = t.kind === "transfer" ? ArrowLeftRight : isOut ? ArrowUp : ArrowDown;
                return (
                  <li key={t.id} className="flex items-center gap-3 px-4 py-3">
                    <span
                      className={`inline-flex size-9 items-center justify-center rounded-xl ${
                        isOut ? "bg-coral/10 text-coral" : isIn ? "bg-green/15 text-green" : "bg-ink/5 text-ink-soft"
                      }`}
                    >
                      <Icon className="size-4" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {t.description ?? (t.kind === "transfer" ? "Transfer" : t.kind === "income" ? "Income" : "Expense")}
                      </p>
                      <p className="text-xs text-ink-soft">
                        {t.categoryName ?? t.kind} · {formatDate(t.occurredAt)}
                      </p>
                    </div>
                    <Money
                      value={parseFloat(t.amount) || 0}
                      prefix={t.currency}
                      size="sm"
                      className={isOut ? "text-coral" : isIn ? "text-green" : ""}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <aside>
          <h2 className="font-display text-lg font-semibold mb-3">Edit source</h2>
          <div className="rounded-2xl bg-card p-5">
            <SourceForm
              initial={{
                name: source.name,
                type: source.type,
                currency: source.currency,
                openingBalance: source.openingBalance,
                color: source.color,
              }}
              action={update}
              submitLabel="Save"
              lockCurrency
            />
          </div>

          <div className="mt-4 flex items-center justify-between rounded-2xl bg-card p-4">
            <div className="text-sm">
              <p className="font-medium">{source.archived ? "Archived" : "Active"}</p>
              <p className="text-xs text-ink-soft">
                {source.archived ? "Hidden from default lists" : "Hide if you no longer use this source"}
              </p>
            </div>
            <form
              action={async () => {
                "use server";
                await archiveSourceAction(sourceId, !source.archived);
              }}
            >
              <button
                type="submit"
                className="text-xs underline text-ink-soft hover:text-ink"
              >
                {source.archived ? "Unarchive" : "Archive"}
              </button>
            </form>
          </div>

          <div className="mt-4 flex items-center justify-between rounded-2xl bg-card p-4">
            <div className="text-sm">
              <p className="font-medium">Delete source</p>
              <p className="text-xs text-ink-soft">
                Only allowed if there are no transactions referencing it.
              </p>
            </div>
            <ConfirmDelete
              title="Delete source?"
              description="This is permanent. Archive it instead if you might use it again."
              onConfirm={async () => {
                "use server";
                return deleteSourceAction(sourceId);
              }}
            />
          </div>
        </aside>
      </div>
    </PageShell>
  );
}
