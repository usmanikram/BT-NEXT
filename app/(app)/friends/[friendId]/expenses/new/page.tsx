import { redirect } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { format } from "date-fns";
import { PageShell } from "@/components/page-shell";
import { SplitEditor } from "@/components/groups/split-editor";
import { createSharedExpenseAction } from "@/actions/shared-expense";
import { getCurrentMonth, requireUserId } from "@/lib/session";
import { areFriends, getFriendUser } from "@/lib/friend-service";
import { db } from "@/lib/db";
import { sources, categoriesV2, users } from "@/db/schema";

export default async function NewFriendExpensePage({
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

  const [srcRows, catRows, me] = await Promise.all([
    db
      .select({ id: sources.id, name: sources.name, currency: sources.currency })
      .from(sources)
      .where(and(eq(sources.userId, userId), eq(sources.archived, false)))
      .orderBy(asc(sources.createdAt)),
    db
      .select({ id: categoriesV2.id, name: categoriesV2.name })
      .from(categoriesV2)
      .where(and(eq(categoriesV2.userId, userId), eq(categoriesV2.archived, false)))
      .orderBy(asc(categoriesV2.sortOrder), asc(categoriesV2.name)),
    db.select({ defaultCurrency: users.defaultCurrency, fullName: users.fullName, email: users.email })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
      .then((r) => r[0]),
  ]);

  const participants = [
    { userId, name: "You", email: me?.email ?? "" },
    { userId: friendId, name: friend.fullName || friend.email.split("@")[0], email: friend.email },
  ];

  const defaultSource = srcRows[0];

  return (
    <PageShell title="Split with friend" currentYearMonth={current.yearMonth} eyebrow={friend.fullName ?? friend.email}>
      <div className="max-w-xl rounded-2xl bg-card p-6">
        <SplitEditor
          groupId={null}
          payerName="You"
          members={participants}
          sources={srcRows}
          categories={catRows}
          initial={{
            amount: "",
            currency: defaultSource?.currency ?? me?.defaultCurrency ?? "PKR",
            sourceId: defaultSource?.id ?? "",
            categoryId: "",
            occurredAt: format(new Date(), "yyyy-MM-dd"),
            description: "",
            notes: "",
            splitType: "equal",
            defaultParticipants: participants,
          }}
          action={createSharedExpenseAction}
          submitLabel="Add expense"
          cancelHref={`/friends/${friendId}`}
        />
      </div>
    </PageShell>
  );
}
