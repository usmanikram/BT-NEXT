import { redirect } from "next/navigation";
import { format } from "date-fns";
import { PageShell } from "@/components/page-shell";
import { SettleUpForm } from "./settle-form";
import { recordSettlementAction } from "@/actions/settlement";
import { getCurrentMonth, requireUserId } from "@/lib/session";
import { getGroup, listGroupMembers, getGroupBalances } from "@/lib/group-service";

export default async function GroupSettlePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ month?: string; to?: string; currency?: string }>;
}) {
  const userId = await requireUserId();
  const { id } = await params;
  const { month, to: prefilledTo, currency: prefilledCurrency } = await searchParams;
  const current = await getCurrentMonth(month);
  const groupId = Number(id);

  const group = await getGroup(userId, groupId);
  if (!group) redirect("/groups");

  const [members, balances] = await Promise.all([
    listGroupMembers(groupId),
    getGroupBalances(groupId),
  ]);

  // Suggested settlement: find a row in balances where the user is the debtor in simplified plan.
  let suggestedTo: string | null = null;
  let suggestedAmount = 0;
  let suggestedCurrency = group.defaultCurrency;
  for (const bv of balances) {
    const list = group.simplifyDebts ? bv.simplified : bv.pairs;
    const mine = list.find((p) => p.fromUserId === userId);
    if (mine) {
      suggestedTo = mine.toUserId;
      suggestedAmount = mine.amount;
      suggestedCurrency = bv.currency;
      break;
    }
  }
  if (prefilledTo) suggestedTo = prefilledTo;
  if (prefilledCurrency) suggestedCurrency = prefilledCurrency;

  const others = members.filter((m) => m.userId !== userId);

  return (
    <PageShell title="Settle up" currentYearMonth={current.yearMonth} eyebrow={group.name}>
      <div className="max-w-md rounded-2xl bg-card p-6">
        <SettleUpForm
          groupId={groupId}
          fromUserId={userId}
          others={others.map((m) => ({
            userId: m.userId,
            name: m.fullName || m.email.split("@")[0],
            email: m.email,
          }))}
          initial={{
            toUserId: suggestedTo ?? others[0]?.userId ?? "",
            amount: suggestedAmount > 0 ? suggestedAmount.toFixed(2) : "",
            currency: suggestedCurrency,
            occurredAt: format(new Date(), "yyyy-MM-dd"),
            note: "",
          }}
          action={recordSettlementAction}
          cancelHref={`/groups/${groupId}`}
        />
      </div>
    </PageShell>
  );
}
