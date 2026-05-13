import { eq } from "drizzle-orm";
import { PageShell } from "@/components/page-shell";
import { GroupCreateForm } from "./create-form";
import { createGroupAction } from "@/actions/group";
import { getCurrentMonth, requireUserId } from "@/lib/session";
import { db } from "@/lib/db";
import { users } from "@/db/schema";

export default async function NewGroupPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const userId = await requireUserId();
  const { month } = await searchParams;
  const current = await getCurrentMonth(month);
  const [u] = await db.select({ defaultCurrency: users.defaultCurrency }).from(users).where(eq(users.id, userId)).limit(1);

  return (
    <PageShell title="New group" currentYearMonth={current.yearMonth} eyebrow="Who are you splitting with?">
      <div className="max-w-lg rounded-2xl bg-card p-6">
        <GroupCreateForm
          defaultCurrency={u?.defaultCurrency ?? "PKR"}
          action={createGroupAction}
        />
      </div>
    </PageShell>
  );
}
