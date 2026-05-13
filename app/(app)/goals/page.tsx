import { Plus, Target, CheckCircle2 } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Money } from "@/components/money";
import { ButtonLink } from "@/components/button-link";
import { EmptyState } from "@/components/empty-state";
import { ConfirmDelete } from "@/components/confirm-delete";
import { listGoals } from "@/lib/goal-service";
import { getCurrentMonth, requireUserId } from "@/lib/session";
import { deleteGoalAction, bumpGoalAction } from "@/actions/goal";
import { cn } from "@/lib/utils";

export default async function GoalsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const userId = await requireUserId();
  const { month } = await searchParams;
  const current = await getCurrentMonth(month);

  const goals = await listGoals(userId);
  const active = goals.filter((g) => !g.completedAt);
  const done = goals.filter((g) => g.completedAt);

  return (
    <PageShell title="Goals" currentYearMonth={current.yearMonth} eyebrow="What you're saving for">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-soft">
          {active.length} active · {done.length} achieved
        </p>
        <ButtonLink href="/goals/new">
          <Plus className="size-3.5" /> New goal
        </ButtonLink>
      </div>

      {goals.length === 0 ? (
        <EmptyState
          icon={Target}
          title="No goals yet"
          description="Car, laptop, emergency fund, Umrah — whatever you're working toward."
          action={
            <ButtonLink href="/goals/new">
              <Plus className="size-3.5" /> Set a goal
            </ButtonLink>
          }
        />
      ) : (
        <>
          {active.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {active.map((g) => (
                <GoalCard key={g.id} goal={g} />
              ))}
            </div>
          )}

          {done.length > 0 && (
            <>
              <h2 className="mt-10 mb-3 font-display text-sm uppercase tracking-wider text-ink-soft">Achieved</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {done.map((g) => (
                  <GoalCard key={g.id} goal={g} />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </PageShell>
  );

  // Inline component below uses parent's actions via closures
  function GoalCard({ goal }: { goal: Awaited<ReturnType<typeof listGoals>>[number] }) {
    const isDone = !!goal.completedAt;
    return (
      <div
        className={cn(
          "relative rounded-3xl bg-card p-6 overflow-hidden shadow-[0_4px_14px_rgba(31,26,20,0.04)]",
          isDone && "opacity-80"
        )}
      >
        <div
          className="pointer-events-none absolute -top-8 -right-8 size-32 rounded-full opacity-25"
          style={{ background: goal.color, filter: "blur(4px)" }}
          aria-hidden
        />

        <div className="relative flex items-start justify-between">
          <span
            className="inline-flex size-10 items-center justify-center rounded-xl text-white shadow-sm"
            style={{ background: goal.color, boxShadow: `0 6px 14px ${goal.color}40` }}
          >
            {isDone ? <CheckCircle2 className="size-5" /> : <Target className="size-5" />}
          </span>
          <div className="flex gap-1">
            <a href={`/goals/${goal.id}`} className="rounded-md p-1.5 text-ink-soft hover:bg-ink/5 hover:text-ink">
              <span className="sr-only">Edit</span>
              <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4Z" /></svg>
            </a>
            <ConfirmDelete
              title="Delete goal?"
              description="This is permanent."
              onConfirm={async () => {
                "use server";
                return deleteGoalAction(goal.id);
              }}
            />
          </div>
        </div>

        <h3 className="relative mt-4 font-display text-lg font-semibold tracking-tight truncate">{goal.name}</h3>

        <div className="relative mt-3 flex items-baseline gap-2">
          <Money value={goal.currentAmount} prefix={goal.currency} size="lg" />
          <span className="text-xs text-ink-soft">
            of <Money value={goal.targetAmount} prefix={goal.currency} size="sm" />
          </span>
        </div>

        <div className="relative mt-3 h-2 w-full overflow-hidden rounded-full bg-cream-soft">
          <div
            className="h-full transition-all"
            style={{ width: `${goal.percent}%`, background: goal.color }}
          />
        </div>

        <div className="relative mt-3 flex items-center justify-between text-xs text-ink-soft">
          <span className="font-mono tabular-nums">{Math.round(goal.percent)}%</span>
          {isDone ? (
            <span className="font-medium text-green">Achieved 🎉</span>
          ) : goal.etaMonths ? (
            <span>~{goal.etaMonths} mo to go</span>
          ) : goal.deadline ? (
            <span>by {goal.deadline}</span>
          ) : (
            <span>set a deadline</span>
          )}
        </div>

        {!isDone && (
          <div className="relative mt-4 flex gap-1.5">
            <form
              action={async () => {
                "use server";
                await bumpGoalAction(goal.id, 1000);
              }}
            >
              <button type="submit" className="rounded-full bg-cream-soft px-2.5 py-1 text-[11px] hover:bg-ink/5">
                +1k
              </button>
            </form>
            <form
              action={async () => {
                "use server";
                await bumpGoalAction(goal.id, 5000);
              }}
            >
              <button type="submit" className="rounded-full bg-cream-soft px-2.5 py-1 text-[11px] hover:bg-ink/5">
                +5k
              </button>
            </form>
            <form
              action={async () => {
                "use server";
                await bumpGoalAction(goal.id, 10000);
              }}
            >
              <button type="submit" className="rounded-full bg-cream-soft px-2.5 py-1 text-[11px] hover:bg-ink/5">
                +10k
              </button>
            </form>
          </div>
        )}
      </div>
    );
  }
}
