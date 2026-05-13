"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { settlements, users } from "@/db/schema";
import { requireUserId } from "@/lib/session";
import { isGroupMember } from "@/lib/group-service";

export type ActionResult = { ok: true } | { ok: false; error: string };

const schema = z.object({
  groupId: z
    .union([z.coerce.number().int().positive(), z.literal("").transform(() => null)])
    .nullable()
    .optional(),
  fromUserId: z.string().uuid(),
  toUserId: z.string().uuid(),
  amount: z.coerce.number().positive("Amount must be positive"),
  currency: z.string().trim().length(3).toUpperCase(),
  occurredAt: z.string().min(1),
  note: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => (v === "" ? null : (v ?? null))),
});

function parseDate(s: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(`${s}T12:00:00Z`);
  return new Date(s);
}

export async function recordSettlementAction(formData: FormData): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = schema.safeParse({
    groupId: formData.get("groupId") ?? "",
    fromUserId: formData.get("fromUserId"),
    toUserId: formData.get("toUserId"),
    amount: formData.get("amount"),
    currency: formData.get("currency"),
    occurredAt: formData.get("occurredAt"),
    note: formData.get("note") ?? "",
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { groupId, fromUserId, toUserId, amount, currency, occurredAt, note } = parsed.data;

  if (fromUserId === toUserId) return { ok: false, error: "Payer and receiver must differ" };
  if (userId !== fromUserId && userId !== toUserId) {
    return { ok: false, error: "You must be the payer or the receiver" };
  }

  // Validate both users exist (and, if group context, are members).
  const [fromU] = await db.select({ id: users.id }).from(users).where(eq(users.id, fromUserId)).limit(1);
  const [toU] = await db.select({ id: users.id }).from(users).where(eq(users.id, toUserId)).limit(1);
  if (!fromU || !toU) return { ok: false, error: "User not found" };

  if (groupId) {
    if (!(await isGroupMember(userId, groupId))) return { ok: false, error: "Not a group member" };
  }

  await db.insert(settlements).values({
    fromUserId,
    toUserId,
    amount: amount.toFixed(2),
    currency,
    groupId: groupId ?? null,
    occurredAt: parseDate(occurredAt),
    note,
  });

  revalidatePath("/groups");
  revalidatePath("/balances");
  if (groupId) revalidatePath(`/groups/${groupId}`);
  redirect(groupId ? `/groups/${groupId}` : "/balances");
}

export async function deleteSettlementAction(id: number): Promise<ActionResult> {
  const userId = await requireUserId();
  const [s] = await db.select().from(settlements).where(eq(settlements.id, id)).limit(1);
  if (!s) return { ok: false, error: "Settlement not found" };
  if (s.fromUserId !== userId && s.toUserId !== userId) {
    return { ok: false, error: "You can only delete settlements you're part of" };
  }
  await db.delete(settlements).where(eq(settlements.id, id));
  revalidatePath("/groups");
  revalidatePath("/balances");
  if (s.groupId) revalidatePath(`/groups/${s.groupId}`);
  return { ok: true };
}
