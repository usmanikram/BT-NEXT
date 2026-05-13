"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  transactions,
  expenseParticipants,
  sources,
  groupMembers,
  groups,
  categoriesV2,
} from "@/db/schema";
import { requireUserId } from "@/lib/session";
import { isGroupMember } from "@/lib/group-service";
import { computeSplit, assertSharesSumToTotal, type Split } from "@/lib/split-engine";

export type ActionResult = { ok: true } | { ok: false; error: string };

const splitTypes = ["equal", "exact", "percent", "shares"] as const;

const baseSchema = z.object({
  groupId: z.coerce.number().int().positive().nullable().optional(),
  sourceId: z.coerce.number().int().positive(),
  categoryId: z
    .union([z.coerce.number().int().positive(), z.literal("").transform(() => null)])
    .nullable()
    .optional(),
  amount: z.coerce.number().positive("Amount must be positive"),
  currency: z.string().trim().length(3).toUpperCase(),
  occurredAt: z.string().min(1),
  description: z
    .string()
    .trim()
    .max(255)
    .optional()
    .transform((v) => (v === "" ? null : (v ?? null))),
  notes: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .transform((v) => (v === "" ? null : (v ?? null))),
  splitType: z.enum(splitTypes),
  participantsJson: z.string(),
});

function parseDate(s: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(`${s}T12:00:00Z`);
  return new Date(s);
}

function parseSplit(splitType: string, raw: string): Split | { error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { error: "Invalid participant data" };
  }
  if (!Array.isArray(parsed)) return { error: "Invalid participant data" };

  if (splitType === "equal") {
    const userIds = parsed
      .map((p) => (typeof p === "object" && p && "userId" in p ? String((p as { userId: unknown }).userId) : null))
      .filter((u): u is string => !!u);
    return { type: "equal", userIds };
  }
  if (splitType === "exact") {
    return {
      type: "exact",
      entries: parsed.map((p) => ({
        userId: String((p as { userId: string }).userId),
        amount: Number((p as { amount: number }).amount),
      })),
    };
  }
  if (splitType === "percent") {
    return {
      type: "percent",
      entries: parsed.map((p) => ({
        userId: String((p as { userId: string }).userId),
        percent: Number((p as { percent: number }).percent),
      })),
    };
  }
  return {
    type: "shares",
    entries: parsed.map((p) => ({
      userId: String((p as { userId: string }).userId),
      shares: Number((p as { shares: number }).shares),
    })),
  };
}

async function validateAllMembers(
  groupId: number,
  userIds: string[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (userIds.length === 0) return { ok: false, error: "At least one participant" };
  const rows = await db
    .select({ userId: groupMembers.userId })
    .from(groupMembers)
    .where(
      and(eq(groupMembers.groupId, groupId), inArray(groupMembers.userId, userIds), isNull(groupMembers.leftAt))
    );
  const valid = new Set(rows.map((r) => r.userId));
  for (const u of userIds) if (!valid.has(u)) return { ok: false, error: "Some participants are not group members" };
  return { ok: true };
}

export async function createSharedExpenseAction(formData: FormData): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = baseSchema.safeParse({
    groupId: formData.get("groupId") ? Number(formData.get("groupId")) : null,
    sourceId: formData.get("sourceId"),
    categoryId: formData.get("categoryId") ?? "",
    amount: formData.get("amount"),
    currency: formData.get("currency"),
    occurredAt: formData.get("occurredAt"),
    description: formData.get("description") ?? "",
    notes: formData.get("notes") ?? "",
    splitType: formData.get("splitType"),
    participantsJson: formData.get("participants") ?? "[]",
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const {
    groupId,
    sourceId,
    categoryId,
    amount,
    currency,
    occurredAt,
    description,
    notes,
    splitType,
    participantsJson,
  } = parsed.data;

  // Auth: must be a group member (or, for non-group splits, no extra check beyond requireUserId).
  if (groupId) {
    if (!(await isGroupMember(userId, groupId))) return { ok: false, error: "Not a group member" };
    // Group's default currency check is informational only — we allow any currency per-expense.
    const [g] = await db.select().from(groups).where(eq(groups.id, groupId)).limit(1);
    if (!g) return { ok: false, error: "Group not found" };
  }

  // Source must belong to the payer (= current user).
  const [src] = await db
    .select({ id: sources.id })
    .from(sources)
    .where(and(eq(sources.id, sourceId), eq(sources.userId, userId)))
    .limit(1);
  if (!src) return { ok: false, error: "Source not found" };

  if (categoryId) {
    const [cat] = await db
      .select({ id: categoriesV2.id })
      .from(categoriesV2)
      .where(and(eq(categoriesV2.id, categoryId), eq(categoriesV2.userId, userId)))
      .limit(1);
    if (!cat) return { ok: false, error: "Category not found" };
  }

  const splitInput = parseSplit(splitType, participantsJson);
  if ("error" in splitInput) return { ok: false, error: splitInput.error };

  // Pull userIds from the split spec
  const userIds = (() => {
    if (splitInput.type === "equal") return splitInput.userIds;
    return splitInput.entries.map((e) => e.userId);
  })();

  if (groupId) {
    const v = await validateAllMembers(groupId, userIds);
    if (!v.ok) return v;
  } else {
    // Non-group split: must include current user as a participant.
    if (!userIds.includes(userId)) return { ok: false, error: "You must be one of the participants" };
  }

  const split = computeSplit(amount, splitInput);
  if (!split.ok) return { ok: false, error: split.error };
  assertSharesSumToTotal(amount, split.shares);

  const isShared = userIds.length > 1;

  const [inserted] = await db
    .insert(transactions)
    .values({
      userId,
      sourceId,
      kind: "expense",
      categoryId: categoryId ?? null,
      amount: amount.toFixed(2),
      currency,
      occurredAt: parseDate(occurredAt),
      description,
      notes,
      groupId: groupId ?? null,
      splitType,
      isShared,
    })
    .returning({ id: transactions.id });

  await db.insert(expenseParticipants).values(
    split.shares.map((s) => ({
      transactionId: inserted.id,
      userId: s.userId,
      shareAmount: s.shareAmount.toFixed(2),
      shareInput: s.shareInput != null ? s.shareInput.toFixed(4) : null,
    }))
  );

  revalidatePath("/groups");
  if (groupId) revalidatePath(`/groups/${groupId}`);
  revalidatePath("/transactions");
  revalidatePath("/sources");
  revalidatePath("/");
  redirect(groupId ? `/groups/${groupId}` : "/balances");
}

export async function updateSharedExpenseAction(
  transactionId: number,
  formData: FormData
): Promise<ActionResult> {
  const userId = await requireUserId();
  // Load current txn to know group + ownership
  const [existing] = await db
    .select()
    .from(transactions)
    .where(eq(transactions.id, transactionId))
    .limit(1);
  if (!existing) return { ok: false, error: "Expense not found" };
  if (existing.userId !== userId) return { ok: false, error: "Only the payer can edit." };

  const parsed = baseSchema.safeParse({
    groupId: existing.groupId,
    sourceId: formData.get("sourceId"),
    categoryId: formData.get("categoryId") ?? "",
    amount: formData.get("amount"),
    currency: formData.get("currency"),
    occurredAt: formData.get("occurredAt"),
    description: formData.get("description") ?? "",
    notes: formData.get("notes") ?? "",
    splitType: formData.get("splitType"),
    participantsJson: formData.get("participants") ?? "[]",
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const {
    sourceId,
    categoryId,
    amount,
    currency,
    occurredAt,
    description,
    notes,
    splitType,
    participantsJson,
  } = parsed.data;

  const splitInput = parseSplit(splitType, participantsJson);
  if ("error" in splitInput) return { ok: false, error: splitInput.error };

  const userIds =
    splitInput.type === "equal" ? splitInput.userIds : splitInput.entries.map((e) => e.userId);
  if (existing.groupId) {
    const v = await validateAllMembers(existing.groupId, userIds);
    if (!v.ok) return v;
  }

  const split = computeSplit(amount, splitInput);
  if (!split.ok) return { ok: false, error: split.error };
  assertSharesSumToTotal(amount, split.shares);

  await db
    .update(transactions)
    .set({
      sourceId,
      categoryId: categoryId ?? null,
      amount: amount.toFixed(2),
      currency,
      occurredAt: parseDate(occurredAt),
      description,
      notes,
      splitType,
      isShared: userIds.length > 1,
      updatedAt: new Date(),
    })
    .where(eq(transactions.id, transactionId));

  // Rewrite participant rows: delete old, insert new.
  await db.delete(expenseParticipants).where(eq(expenseParticipants.transactionId, transactionId));
  await db.insert(expenseParticipants).values(
    split.shares.map((s) => ({
      transactionId,
      userId: s.userId,
      shareAmount: s.shareAmount.toFixed(2),
      shareInput: s.shareInput != null ? s.shareInput.toFixed(4) : null,
    }))
  );

  revalidatePath("/groups");
  if (existing.groupId) revalidatePath(`/groups/${existing.groupId}`);
  revalidatePath("/transactions");
  revalidatePath("/sources");
  revalidatePath("/");
  redirect(existing.groupId ? `/groups/${existing.groupId}` : "/balances");
}

export async function deleteSharedExpenseAction(transactionId: number): Promise<ActionResult> {
  const userId = await requireUserId();
  const [existing] = await db
    .select()
    .from(transactions)
    .where(eq(transactions.id, transactionId))
    .limit(1);
  if (!existing) return { ok: false, error: "Expense not found" };
  if (existing.userId !== userId) return { ok: false, error: "Only the payer can delete." };

  await db.delete(transactions).where(eq(transactions.id, transactionId));
  // expense_participants rows cascade-delete via FK.

  revalidatePath("/groups");
  if (existing.groupId) revalidatePath(`/groups/${existing.groupId}`);
  revalidatePath("/transactions");
  revalidatePath("/sources");
  revalidatePath("/");
  return { ok: true };
}
