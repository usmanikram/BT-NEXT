"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { income } from "@/db/schema";
import { requireUserId } from "@/lib/session";

const schema = z.object({
  monthId: z.coerce.number().int().positive(),
  source: z.string().trim().min(1, "Source is required").max(100),
  amount: z.coerce.number().positive("Amount must be a positive number"),
  notes: z
    .string()
    .trim()
    .max(255)
    .optional()
    .transform((v) => (v === "" ? null : (v ?? null))),
});

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function createIncomeAction(formData: FormData): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = schema.safeParse({
    monthId: formData.get("monthId"),
    source: formData.get("source"),
    amount: formData.get("amount"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { monthId, source, amount, notes } = parsed.data;
  await db.insert(income).values({
    userId,
    monthId,
    source,
    amount: amount.toFixed(2),
    notes,
  });
  revalidatePath("/income");
  redirect("/income");
}

export async function updateIncomeAction(id: number, formData: FormData): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = schema.safeParse({
    monthId: formData.get("monthId"),
    source: formData.get("source"),
    amount: formData.get("amount"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { source, amount, notes } = parsed.data;
  await db
    .update(income)
    .set({ source, amount: amount.toFixed(2), notes, updatedAt: new Date() })
    .where(and(eq(income.id, id), eq(income.userId, userId)));
  revalidatePath("/income");
  redirect("/income");
}

export async function deleteIncomeAction(id: number): Promise<ActionResult> {
  const userId = await requireUserId();
  await db.delete(income).where(and(eq(income.id, id), eq(income.userId, userId)));
  revalidatePath("/income");
  return { ok: true };
}
