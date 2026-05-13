"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { savingsGoals } from "@/db/schema";
import { requireUserId } from "@/lib/session";

const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  targetAmount: z.coerce.number().positive("Target must be positive"),
  currentAmount: z.coerce.number().min(0, "Current amount cannot be negative"),
  currency: z.string().trim().length(3).toUpperCase(),
  deadline: z
    .string()
    .optional()
    .transform((v) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null)),
  sourceId: z
    .union([z.coerce.number().int().positive(), z.literal("").transform(() => null)])
    .nullable()
    .optional(),
  color: z.string().trim().min(1).max(20),
  icon: z
    .string()
    .trim()
    .max(50)
    .optional()
    .transform((v) => (v === "" ? null : (v ?? null))),
});

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function createGoalAction(formData: FormData): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = schema.safeParse({
    name: formData.get("name"),
    targetAmount: formData.get("targetAmount"),
    currentAmount: formData.get("currentAmount"),
    currency: formData.get("currency"),
    deadline: formData.get("deadline"),
    sourceId: formData.get("sourceId") ?? "",
    color: formData.get("color"),
    icon: formData.get("icon"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { name, targetAmount, currentAmount, currency, deadline, sourceId, color, icon } = parsed.data;
  const completedAt = currentAmount >= targetAmount ? new Date() : null;
  await db.insert(savingsGoals).values({
    userId,
    name,
    targetAmount: targetAmount.toFixed(2),
    currentAmount: currentAmount.toFixed(2),
    currency,
    deadline: deadline ?? null,
    sourceId: sourceId ?? null,
    color,
    icon,
    completedAt,
  });
  revalidatePath("/goals");
  revalidatePath("/");
  redirect("/goals");
}

export async function updateGoalAction(id: number, formData: FormData): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = schema.safeParse({
    name: formData.get("name"),
    targetAmount: formData.get("targetAmount"),
    currentAmount: formData.get("currentAmount"),
    currency: formData.get("currency"),
    deadline: formData.get("deadline"),
    sourceId: formData.get("sourceId") ?? "",
    color: formData.get("color"),
    icon: formData.get("icon"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { name, targetAmount, currentAmount, currency, deadline, sourceId, color, icon } = parsed.data;
  const completedAt = currentAmount >= targetAmount ? new Date() : null;
  await db
    .update(savingsGoals)
    .set({
      name,
      targetAmount: targetAmount.toFixed(2),
      currentAmount: currentAmount.toFixed(2),
      currency,
      deadline: deadline ?? null,
      sourceId: sourceId ?? null,
      color,
      icon,
      completedAt,
      updatedAt: new Date(),
    })
    .where(and(eq(savingsGoals.id, id), eq(savingsGoals.userId, userId)));
  revalidatePath("/goals");
  revalidatePath(`/goals/${id}`);
  revalidatePath("/");
  redirect("/goals");
}

export async function deleteGoalAction(id: number): Promise<ActionResult> {
  const userId = await requireUserId();
  await db.delete(savingsGoals).where(and(eq(savingsGoals.id, id), eq(savingsGoals.userId, userId)));
  revalidatePath("/goals");
  revalidatePath("/");
  return { ok: true };
}

export async function bumpGoalAction(id: number, delta: number): Promise<ActionResult> {
  const userId = await requireUserId();
  const [g] = await db
    .select()
    .from(savingsGoals)
    .where(and(eq(savingsGoals.id, id), eq(savingsGoals.userId, userId)))
    .limit(1);
  if (!g) return { ok: false, error: "Goal not found" };
  const newCurrent = Math.max(0, parseFloat(g.currentAmount) + delta);
  const completedAt = newCurrent >= parseFloat(g.targetAmount) ? new Date() : null;
  await db
    .update(savingsGoals)
    .set({ currentAmount: newCurrent.toFixed(2), completedAt, updatedAt: new Date() })
    .where(and(eq(savingsGoals.id, id), eq(savingsGoals.userId, userId)));
  revalidatePath("/goals");
  revalidatePath(`/goals/${id}`);
  revalidatePath("/");
  return { ok: true };
}
