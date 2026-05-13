import { redirect } from "next/navigation";
import { format } from "date-fns";
import { eq } from "drizzle-orm";
import { PageShell } from "@/components/page-shell";
import { SettleUpForm } from "../../../groups/[id]/settle/settle-form";
import { recordSettlementAction } from "@/actions/settlement";
import { getCurrentMonth, requireUserId } from "@/lib/session";
import { areFriends, getFriendBalances, getFriendUser } from "@/lib/friend-service";
import { db } from "@/lib/db";
import { users } from "@/db/schema";

export default async function FriendSettlePage({
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

  const balances = await getFriendBalances(userId, friendId);
  const [userRow] = await db.select({ defaultCurrency: users.defaultCurrency }).from(users).where(eq(users.id, userId)).limit(1);

  // Pick first currency where the user is in debt; else first currency at all; else default.
  const entries = Object.entries(balances);
  const debt = entries.find(([, v]) => v < 0);
  const pick = debt ?? entries[0];
  const suggestedAmount = pick ? Math.abs(pick[1]) : 0;
  const suggestedCurrency = pick?.[0] ?? userRow?.defaultCurrency ?? "PKR";

  return (
    <PageShell title="Settle up" currentYearMonth={current.yearMonth} eyebrow={friend.fullName ?? friend.email}>
      <div className="max-w-md rounded-2xl bg-card p-6">
        <SettleUpForm
          groupId={null}
          fromUserId={userId}
          others={[{ userId: friendId, name: friend.fullName || friend.email.split("@")[0], email: friend.email }]}
          initial={{
            toUserId: friendId,
            amount: suggestedAmount > 0 ? suggestedAmount.toFixed(2) : "",
            currency: suggestedCurrency,
            occurredAt: format(new Date(), "yyyy-MM-dd"),
            note: "",
          }}
          action={recordSettlementAction}
          cancelHref={`/friends/${friendId}`}
        />
      </div>
    </PageShell>
  );
}
