import { redirect } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { format } from "date-fns";
import { PageShell } from "@/components/page-shell";
import { SplitEditor } from "@/components/groups/split-editor";
import { ConfirmDelete } from "@/components/confirm-delete";
import { updateSharedExpenseAction, deleteSharedExpenseAction } from "@/actions/shared-expense";
import { getCurrentMonth, requireUserId } from "@/lib/session";
import { getGroup, listGroupMembers } from "@/lib/group-service";
import { db } from "@/lib/db";
import { sources, categoriesV2, transactions, expenseParticipants, users } from "@/db/schema";

export default async function EditGroupExpensePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; txId: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const userId = await requireUserId();
  const { id, txId } = await params;
  const { month } = await searchParams;
  const current = await getCurrentMonth(month);
  const groupId = Number(id);
  const transactionId = Number(txId);

  const group = await getGroup(userId, groupId);
  if (!group) redirect("/groups");

  const [txn] = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.id, transactionId), eq(transactions.groupId, groupId)))
    .limit(1);
  if (!txn) redirect(`/groups/${groupId}`);

  const isPayer = txn.userId === userId;

  const [members, srcRows, catRows, partRows, payerRow] = await Promise.all([
    listGroupMembers(groupId),
    isPayer
      ? db
          .select({ id: sources.id, name: sources.name, currency: sources.currency })
          .from(sources)
          .where(and(eq(sources.userId, userId), eq(sources.archived, false)))
          .orderBy(asc(sources.createdAt))
      : Promise.resolve(
          [] as Array<{ id: number; name: string; currency: string }>
        ),
    isPayer
      ? db
          .select({ id: categoriesV2.id, name: categoriesV2.name })
          .from(categoriesV2)
          .where(and(eq(categoriesV2.userId, userId), eq(categoriesV2.archived, false)))
          .orderBy(asc(categoriesV2.sortOrder), asc(categoriesV2.name))
      : Promise.resolve([] as Array<{ id: number; name: string }>),
    db
      .select({
        userId: expenseParticipants.userId,
        shareAmount: expenseParticipants.shareAmount,
        shareInput: expenseParticipants.shareInput,
      })
      .from(expenseParticipants)
      .where(eq(expenseParticipants.transactionId, transactionId)),
    db.select({ fullName: users.fullName, email: users.email }).from(users).where(eq(users.id, txn.userId)).limit(1).then((r) => r[0]),
  ]);

  const participants = members.map((m) => ({
    userId: m.userId,
    name: m.userId === userId ? "You" : (m.fullName || m.email.split("@")[0]),
    email: m.email,
  }));

  const participantIds = new Set(partRows.map((p) => p.userId));
  const filteredParticipants = participants.filter((p) => participantIds.has(p.userId));

  async function update(formData: FormData) {
    "use server";
    return updateSharedExpenseAction(transactionId, formData);
  }

  return (
    <PageShell title="Edit expense" currentYearMonth={current.yearMonth} eyebrow={group.name}>
      <div className="max-w-xl rounded-2xl bg-card p-6">
        {!isPayer && (
          <div className="mb-5 rounded-xl bg-yellow/20 px-4 py-3 text-sm">
            Only the payer ({payerRow?.fullName ?? payerRow?.email}) can edit this expense.
          </div>
        )}
        {isPayer ? (
          <SplitEditor
            groupId={groupId}
            payerName={"You"}
            members={participants}
            sources={srcRows}
            categories={catRows}
            initial={{
              amount: txn.amount,
              currency: txn.currency,
              sourceId: txn.sourceId,
              categoryId: txn.categoryId ?? "",
              occurredAt: format(txn.occurredAt, "yyyy-MM-dd"),
              description: txn.description ?? "",
              notes: txn.notes ?? "",
              splitType: (txn.splitType ?? "equal") as "equal" | "exact" | "percent" | "shares",
              defaultParticipants: filteredParticipants,
            }}
            action={update}
            submitLabel="Save"
            cancelHref={`/groups/${groupId}`}
          />
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-ink-soft">
              <strong>Amount:</strong> {txn.currency} {txn.amount}
            </p>
            {txn.description && <p className="text-sm"><strong>Note:</strong> {txn.description}</p>}
            <p className="text-sm text-ink-soft">Split type: {txn.splitType}</p>
            <ul className="rounded-xl bg-cream-soft p-3 text-sm space-y-1">
              {partRows.map((p) => {
                const m = participants.find((mm) => mm.userId === p.userId);
                return (
                  <li key={p.userId} className="flex justify-between">
                    <span>{m?.name ?? p.userId}</span>
                    <span className="tabular-nums">{parseFloat(p.shareAmount).toFixed(2)}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {isPayer && (
          <div className="mt-6 flex justify-end">
            <ConfirmDelete
              title="Delete this expense?"
              description="Removes it from the group and recomputes everyone's balances."
              onConfirm={async () => {
                "use server";
                return deleteSharedExpenseAction(transactionId);
              }}
            />
          </div>
        )}
      </div>
    </PageShell>
  );
}
