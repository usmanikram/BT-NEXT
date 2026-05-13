import { redirect } from "next/navigation";
import { Plus, Receipt, ArrowRight, UserRound } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { ButtonLink } from "@/components/button-link";
import { Money } from "@/components/money";
import { EmptyState } from "@/components/empty-state";
import { ConfirmDelete } from "@/components/confirm-delete";
import { getCurrentMonth, requireUserId } from "@/lib/session";
import {
  areFriends,
  getFriendBalances,
  getFriendUser,
  listFriendExpenses,
} from "@/lib/friend-service";
import { removeFriendAction } from "@/actions/friend";
import { formatDate } from "@/lib/format";

function displayName(name: string | null, email: string): string {
  return name?.trim() || email.split("@")[0];
}

export default async function FriendDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ friendId: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const userId = await requireUserId();
  const { friendId } = await params;
  const { month } = await searchParams;
  const current = await getCurrentMonth(month);

  if (!(await areFriends(userId, friendId))) redirect("/friends");
  const friend = await getFriendUser(friendId);
  if (!friend) redirect("/friends");

  const [balances, expenses] = await Promise.all([
    getFriendBalances(userId, friendId),
    listFriendExpenses(userId, friendId),
  ]);

  const friendName = displayName(friend.fullName, friend.email);

  return (
    <PageShell title={friendName} currentYearMonth={current.yearMonth} eyebrow={friend.email}>
      <div className="flex flex-wrap items-center justify-end gap-2 mb-6">
        <ButtonLink href={`/friends/${friendId}/expenses/new`}>
          <Plus className="size-3.5" /> Add expense
        </ButtonLink>
        <ButtonLink href={`/friends/${friendId}/settle`} variant="outline">
          <ArrowRight className="size-3.5" /> Settle up
        </ButtonLink>
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-6">
        <section>
          <h2 className="font-display text-lg font-semibold mb-3">Shared expenses</h2>
          {expenses.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="No shared expenses"
              description={`Log expenses you and ${friendName} split.`}
              action={
                <ButtonLink href={`/friends/${friendId}/expenses/new`}>
                  <Plus className="size-3.5" /> Add expense
                </ButtonLink>
              }
            />
          ) : (
            <ul className="rounded-2xl bg-card divide-y divide-ink/5 overflow-hidden">
              {expenses.map((e) => {
                const youPaid = e.payerId === userId;
                return (
                  <li key={e.transactionId} className="flex items-center gap-3 px-4 py-3">
                    <span className="inline-flex size-9 items-center justify-center rounded-xl bg-yellow/30 text-ink">
                      <Receipt className="size-4" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{e.description ?? "Expense"}</p>
                      <p className="text-xs text-ink-soft">
                        {youPaid ? "You paid" : `${friendName} paid`}
                        {e.categoryName ? ` · ${e.categoryName}` : ""} · {formatDate(e.occurredAt)}
                      </p>
                    </div>
                    <div className="text-right">
                      <Money value={e.amount} prefix={e.currency} size="sm" />
                      <p className="text-[11px] text-ink-soft">
                        {youPaid
                          ? `you lent ${(e.amount - e.yourShare).toFixed(2)}`
                          : `you owe ${e.yourShare.toFixed(2)}`}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <aside className="space-y-6">
          <div className="rounded-2xl bg-card p-5">
            <h3 className="font-display text-base font-semibold mb-3">Balance</h3>
            {Object.keys(balances).length === 0 ? (
              <p className="text-sm text-ink-soft">Settled up</p>
            ) : (
              <ul className="space-y-1.5">
                {Object.entries(balances).map(([cur, amt]) => (
                  <li key={cur} className="text-sm flex items-center justify-between">
                    {amt > 0 ? (
                      <>
                        <span className="text-green">{friendName} owes you</span>
                        <Money value={amt} prefix={cur} size="sm" />
                      </>
                    ) : (
                      <>
                        <span className="text-coral">You owe</span>
                        <Money value={Math.abs(amt)} prefix={cur} size="sm" />
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-2xl bg-card p-5">
            <h3 className="font-display text-base font-semibold mb-3">
              <UserRound className="inline size-3.5 mr-1" /> Manage
            </h3>
            <ConfirmDelete
              title="Remove friend?"
              description="Past shared expenses stay; you just won't see this person in your friend list."
              onConfirm={async () => {
                "use server";
                return removeFriendAction(friendId);
              }}
            />
          </div>
        </aside>
      </div>
    </PageShell>
  );
}
