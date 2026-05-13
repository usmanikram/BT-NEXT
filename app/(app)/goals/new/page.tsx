import { and, asc, eq } from "drizzle-orm";
import { PageShell } from "@/components/page-shell";
import { GoalForm } from "../goal-form";
import { createGoalAction } from "@/actions/goal";
import { getCurrentMonth, requireUserId } from "@/lib/session";
import { db } from "@/lib/db";
import { sources, users } from "@/db/schema";

export default async function NewGoalPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const userId = await requireUserId();
  const { month } = await searchParams;
  const current = await getCurrentMonth(month);
  const [user] = await db.select({ defaultCurrency: users.defaultCurrency }).from(users).where(eq(users.id, userId)).limit(1);
  const sourceOptions = await db
    .select({ id: sources.id, name: sources.name, currency: sources.currency })
    .from(sources)
    .where(and(eq(sources.userId, userId), eq(sources.archived, false)))
    .orderBy(asc(sources.createdAt));

  return (
    <PageShell title="New goal" currentYearMonth={current.yearMonth} eyebrow="Save toward something">
      <div className="max-w-lg rounded-2xl bg-card p-6">
        <GoalForm
          initial={{
            name: "",
            targetAmount: "",
            currentAmount: "0",
            currency: user?.defaultCurrency ?? "PKR",
            deadline: "",
            sourceId: "",
            color: "#FFD86B",
          }}
          sources={sourceOptions}
          action={createGoalAction}
          submitLabel="Create goal"
        />
      </div>
    </PageShell>
  );
}
