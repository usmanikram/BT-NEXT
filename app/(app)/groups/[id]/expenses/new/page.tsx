import { redirect } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { format } from "date-fns";
import { PageShell } from "@/components/page-shell";
import { SplitEditor } from "@/components/groups/split-editor";
import { createSharedExpenseAction } from "@/actions/shared-expense";
import { getCurrentMonth, requireUserId } from "@/lib/session";
import { getGroup, listGroupMembers } from "@/lib/group-service";
import { db } from "@/lib/db";
import { sources, categoriesV2, users } from "@/db/schema";

export default async function NewGroupExpensePage({
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

  const [members, srcRows, catRows, userRow] = await Promise.all([
    listGroupMembers(groupId),
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

  const participants = members.map((m) => ({
    userId: m.userId,
    name: m.userId === userId ? "You" : (m.fullName || m.email.split("@")[0]),
    email: m.email,
  }));

  const defaultSource = srcRows[0];

  return (
    <PageShell title="New expense" currentYearMonth={current.yearMonth} eyebrow={group.name}>
      <div className="max-w-xl rounded-2xl bg-card p-6">
        <SplitEditor
          groupId={groupId}
          payerName={userRow?.fullName ?? userRow?.email ?? "You"}
          members={participants}
          sources={srcRows}
          categories={catRows}
          initial={{
            amount: "",
            currency: defaultSource?.currency ?? group.defaultCurrency ?? "PKR",
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
          cancelHref={`/groups/${groupId}`}
        />
      </div>
    </PageShell>
  );
}
