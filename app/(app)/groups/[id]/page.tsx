import { redirect } from "next/navigation";
import { Plus, Receipt, Archive, LogOut, Settings, ArrowRight } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { ButtonLink } from "@/components/button-link";
import { Money } from "@/components/money";
import { EmptyState } from "@/components/empty-state";
import { ConfirmDelete } from "@/components/confirm-delete";
import { getCurrentMonth, requireUserId } from "@/lib/session";
import {
  getGroup,
  listGroupMembers,
  listGroupExpenses,
  getGroupBalances,
} from "@/lib/group-service";
import {
  addMemberByEmailAction,
  removeMemberAction,
  leaveGroupAction,
  archiveGroupAction,
  toggleSimplifyDebtsAction,
} from "@/actions/group";
import { formatDate } from "@/lib/format";
import { AddMemberForm } from "./add-member-form";

function displayName(name: string | null, email: string): string {
  return name?.trim() || email.split("@")[0];
}

export default async function GroupDetailPage({
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
  const groupId = Number(id);

  const group = await getGroup(userId, groupId);
  if (!group) redirect("/groups");

  const [members, expenses, balanceViews] = await Promise.all([
    listGroupMembers(groupId),
    listGroupExpenses(groupId),
    getGroupBalances(groupId),
  ]);

  const memberMap = new Map(members.map((m) => [m.userId, m]));

  return (
    <PageShell
      title={group.name}
      currentYearMonth={current.yearMonth}
      eyebrow={`${members.length} ${members.length === 1 ? "member" : "members"}${group.description ? " · " + group.description : ""}`}
    >
      <div className="flex flex-wrap items-center justify-end gap-2 mb-6">
        <ButtonLink href={`/groups/${groupId}/expenses/new`}>
          <Plus className="size-3.5" /> Add expense
        </ButtonLink>
        <ButtonLink href={`/groups/${groupId}/settle`} variant="outline">
          <ArrowRight className="size-3.5" /> Settle up
        </ButtonLink>
      </div>

      <div className="grid lg:grid-cols-[1fr_360px] gap-6">
        {/* Expense list */}
        <section>
          <h2 className="font-display text-lg font-semibold mb-3">Expenses</h2>
          {expenses.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="No shared expenses yet"
              description="Log the first one to start tracking who owes what."
              action={
                <ButtonLink href={`/groups/${groupId}/expenses/new`}>
                  <Plus className="size-3.5" /> Add expense
                </ButtonLink>
              }
            />
          ) : (
            <ul className="rounded-2xl bg-card divide-y divide-ink/5 overflow-hidden">
              {expenses.map((e) => {
                const payer = memberMap.get(e.payerId);
                const yourShare = e.participants.find((p) => p.userId === userId)?.shareAmount ?? 0;
                const youPaid = e.payerId === userId;
                return (
                  <li key={e.transactionId}>
                    <a
                      href={`/groups/${groupId}/expenses/${e.transactionId}`}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-cream-soft transition-colors"
                    >
                      <span className="inline-flex size-9 items-center justify-center rounded-xl bg-yellow/30 text-ink">
                        <Receipt className="size-4" />
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {e.description ?? "Expense"}
                        </p>
                        <p className="text-xs text-ink-soft">
                          {displayName(payer?.fullName ?? null, payer?.email ?? "?")} paid
                          {e.categoryName ? ` · ${e.categoryName}` : ""} · {formatDate(e.occurredAt)}
                        </p>
                      </div>
                      <div className="text-right">
                        <Money value={e.amount} prefix={e.currency} size="sm" />
                        <p className="text-[11px] text-ink-soft">
                          {youPaid
                            ? `you lent ${(e.amount - yourShare).toFixed(2)}`
                            : `you owe ${yourShare.toFixed(2)}`}
                        </p>
                      </div>
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Right rail: balances, members, settings */}
        <aside className="space-y-6">
          {/* Balances */}
          <div className="rounded-2xl bg-card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display text-base font-semibold">Balances</h3>
              <form
                action={async () => {
                  "use server";
                  await toggleSimplifyDebtsAction(groupId, !group.simplifyDebts);
                }}
              >
                <button
                  type="submit"
                  className="text-[11px] text-ink-soft hover:text-ink underline"
                >
                  {group.simplifyDebts ? "Show raw" : "Simplify"}
                </button>
              </form>
            </div>

            {balanceViews.length === 0 ? (
              <p className="text-sm text-ink-soft">Settled up 🎉</p>
            ) : (
              balanceViews.map((bv) => {
                const list = group.simplifyDebts ? bv.simplified : bv.pairs;
                return (
                  <div key={bv.currency} className="space-y-2">
                    {balanceViews.length > 1 && (
                      <p className="text-[11px] uppercase tracking-wider text-ink-soft">{bv.currency}</p>
                    )}
                    {list.length === 0 ? (
                      <p className="text-sm text-ink-soft">Settled in {bv.currency}</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {list.map((p, i) => {
                          const debtor = memberMap.get(p.fromUserId);
                          const creditor = memberMap.get(p.toUserId);
                          return (
                            <li key={i} className="text-sm flex items-center justify-between gap-2">
                              <span className="truncate">
                                <span className={p.fromUserId === userId ? "font-medium text-coral" : ""}>
                                  {p.fromUserId === userId ? "You" : displayName(debtor?.fullName ?? null, debtor?.email ?? "?")}
                                </span>
                                {" → "}
                                <span className={p.toUserId === userId ? "font-medium text-green" : ""}>
                                  {p.toUserId === userId ? "You" : displayName(creditor?.fullName ?? null, creditor?.email ?? "?")}
                                </span>
                              </span>
                              <Money value={p.amount} prefix={bv.currency} size="sm" />
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Members */}
          <div className="rounded-2xl bg-card p-5">
            <h3 className="font-display text-base font-semibold mb-3">Members</h3>
            <ul className="space-y-2">
              {members.map((m) => (
                <li key={m.userId} className="flex items-center justify-between gap-2">
                  <div className="text-sm min-w-0">
                    <p className="font-medium truncate">
                      {displayName(m.fullName, m.email)}
                      {m.userId === userId && <span className="ml-1 text-[10px] text-ink-soft">(you)</span>}
                    </p>
                    <p className="text-[11px] text-ink-soft truncate">{m.email}</p>
                  </div>
                  {m.userId !== userId && (
                    <ConfirmDelete
                      title="Remove member?"
                      description="They'll stay visible on past expenses but won't appear on new ones."
                      onConfirm={async () => {
                        "use server";
                        return removeMemberAction(groupId, m.userId);
                      }}
                    />
                  )}
                </li>
              ))}
            </ul>
            <div className="mt-4">
              <AddMemberForm
                action={async (fd) => {
                  "use server";
                  return addMemberByEmailAction(groupId, fd);
                }}
              />
            </div>
          </div>

          {/* Settings */}
          <div className="rounded-2xl bg-card p-5">
            <h3 className="font-display text-base font-semibold mb-3">
              <Settings className="inline size-3.5 mr-1" /> Group settings
            </h3>
            <div className="space-y-2 text-sm">
              <form
                action={async () => {
                  "use server";
                  await archiveGroupAction(groupId, !group.archivedAt);
                }}
              >
                <button
                  type="submit"
                  className="w-full text-left text-ink-soft hover:text-ink inline-flex items-center gap-1.5"
                >
                  <Archive className="size-3.5" />
                  {group.archivedAt ? "Unarchive group" : "Archive group"}
                </button>
              </form>
              <form
                action={async () => {
                  "use server";
                  await leaveGroupAction(groupId);
                }}
              >
                <button
                  type="submit"
                  className="w-full text-left text-coral hover:text-coral inline-flex items-center gap-1.5"
                >
                  <LogOut className="size-3.5" /> Leave group
                </button>
              </form>
            </div>
          </div>
        </aside>
      </div>
    </PageShell>
  );
}
