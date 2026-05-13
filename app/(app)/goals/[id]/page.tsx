import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { PageShell } from "@/components/page-shell";
import { GoalForm } from "../goal-form";
import { updateGoalAction } from "@/actions/goal";
import { getCurrentMonth, requireUserId } from "@/lib/session";
import { getGoal } from "@/lib/goal-service";
import { db } from "@/lib/db";
import { sources } from "@/db/schema";

export default async function EditGoalPage({
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

  const goalId = Number(id);
  const goal = await getGoal(userId, goalId);
  if (!goal) notFound();

  const sourceOptions = await db
    .select({ id: sources.id, name: sources.name, currency: sources.currency })
    .from(sources)
    .where(and(eq(sources.userId, userId), eq(sources.archived, false)))
    .orderBy(asc(sources.createdAt));

  async function update(formData: FormData) {
    "use server";
    return updateGoalAction(goalId, formData);
  }

  return (
    <PageShell title="Edit goal" currentYearMonth={current.yearMonth}>
      <div className="max-w-lg rounded-2xl bg-card p-6">
        <GoalForm
          initial={{
            name: goal.name,
            targetAmount: goal.targetAmount.toFixed(2),
            currentAmount: goal.currentAmount.toFixed(2),
            currency: goal.currency,
            deadline: goal.deadline ?? "",
            sourceId: goal.sourceId ?? "",
            color: goal.color,
          }}
          sources={sourceOptions}
          action={update}
          submitLabel="Save"
        />
      </div>
    </PageShell>
  );
}
