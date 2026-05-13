import { and, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { savingsGoals } from "@/db/schema";

export type GoalWithProgress = {
  id: number;
  name: string;
  targetAmount: number;
  currentAmount: number;
  currency: string;
  deadline: string | null;
  sourceId: number | null;
  icon: string | null;
  color: string;
  percent: number;
  remaining: number;
  completedAt: Date | null;
  /** Months remaining at the recent contribution pace, or null if unknowable. */
  etaMonths: number | null;
};

export async function listGoals(userId: string): Promise<GoalWithProgress[]> {
  const rows = await db
    .select()
    .from(savingsGoals)
    .where(eq(savingsGoals.userId, userId))
    .orderBy(asc(savingsGoals.completedAt), asc(savingsGoals.deadline));

  return rows.map((g) => decorate(g));
}

export async function getGoal(userId: string, id: number): Promise<GoalWithProgress | null> {
  const [row] = await db
    .select()
    .from(savingsGoals)
    .where(and(eq(savingsGoals.userId, userId), eq(savingsGoals.id, id)))
    .limit(1);
  return row ? decorate(row) : null;
}

function decorate(g: typeof savingsGoals.$inferSelect): GoalWithProgress {
  const target = parseFloat(g.targetAmount);
  const current = parseFloat(g.currentAmount);
  const remaining = Math.max(0, target - current);
  const percent = target > 0 ? Math.min(100, (current / target) * 100) : 0;

  // ETA: if we know createdAt and current > 0, infer monthly contribution rate.
  const monthsSinceCreated = Math.max(
    1 / 30,
    (Date.now() - g.createdAt.getTime()) / (1000 * 60 * 60 * 24 * 30)
  );
  const rate = current / monthsSinceCreated;
  const etaMonths = remaining > 0 && rate > 1 ? Math.ceil(remaining / rate) : null;

  return {
    id: g.id,
    name: g.name,
    targetAmount: target,
    currentAmount: current,
    currency: g.currency,
    deadline: g.deadline,
    sourceId: g.sourceId,
    icon: g.icon,
    color: g.color,
    percent,
    remaining,
    completedAt: g.completedAt,
    etaMonths,
  };
}
