"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { transactions, sources, categoriesV2, expenseParticipants } from "@/db/schema";
import { requireUserId } from "@/lib/session";

const baseSchema = z.object({
  kind: z.enum(["income", "expense", "transfer"]),
  sourceId: z.coerce.number().int().positive(),
  destSourceId: z
    .union([z.coerce.number().int().positive(), z.literal("").transform(() => null)])
    .nullable()
    .optional(),
  categoryId: z
    .union([z.coerce.number().int().positive(), z.literal("").transform(() => null)])
    .nullable()
    .optional(),
  amount: z.coerce.number().positive("Amount must be positive"),
  currency: z.string().trim().length(3).toUpperCase(),
  occurredAt: z.string().min(1, "Date is required"),
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
});

export type ActionResult = { ok: true } | { ok: false; error: string };

async function validateRefs(
  userId: string,
  data: z.infer<typeof baseSchema>
): Promise<string | null> {
  // Source must belong to user.
  const [src] = await db
    .select({ id: sources.id, currency: sources.currency })
    .from(sources)
    .where(and(eq(sources.id, data.sourceId), eq(sources.userId, userId)))
    .limit(1);
  if (!src) return "Source not found";

  if (data.kind === "transfer") {
    if (!data.destSourceId) return "Destination source is required for transfers";
    if (data.destSourceId === data.sourceId) return "Source and destination must differ";
    const [dst] = await db
      .select({ id: sources.id, currency: sources.currency })
      .from(sources)
      .where(and(eq(sources.id, data.destSourceId), eq(sources.userId, userId)))
      .limit(1);
    if (!dst) return "Destination source not found";
    if (dst.currency !== src.currency) {
      return "Transfers across different currencies aren't supported yet — coming soon.";
    }
  }

  if (data.kind === "expense" && !data.categoryId) {
    return "Expenses need a category";
  }

  if (data.categoryId) {
    const [cat] = await db
      .select({ id: categoriesV2.id })
      .from(categoriesV2)
      .where(and(eq(categoriesV2.id, data.categoryId), eq(categoriesV2.userId, userId)))
      .limit(1);
    if (!cat) return "Category not found";
  }

  return null;
}

function parseDate(s: string): Date {
  // Accept "YYYY-MM-DD" (from <input type="date">) — store as noon UTC.
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(`${s}T12:00:00Z`);
  return new Date(s);
}

export async function createTransactionAction(formData: FormData): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = baseSchema.safeParse({
    kind: formData.get("kind"),
    sourceId: formData.get("sourceId"),
    destSourceId: formData.get("destSourceId") ?? "",
    categoryId: formData.get("categoryId") ?? "",
    amount: formData.get("amount"),
    currency: formData.get("currency"),
    occurredAt: formData.get("occurredAt"),
    description: formData.get("description") ?? "",
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const refError = await validateRefs(userId, parsed.data);
  if (refError) return { ok: false, error: refError };

  const { kind, sourceId, destSourceId, categoryId, amount, currency, occurredAt, description, notes } = parsed.data;

  const [inserted] = await db
    .insert(transactions)
    .values({
      userId,
      sourceId,
      destSourceId: kind === "transfer" ? destSourceId! : null,
      kind,
      categoryId: kind === "transfer" ? null : (categoryId ?? null),
      amount: amount.toFixed(2),
      currency,
      occurredAt: parseDate(occurredAt),
      description,
      notes,
    })
    .returning({ id: transactions.id });

  // Personal expense: also record the payer as the sole participant so user_expense_shares stays in sync.
  if (kind === "expense" && inserted) {
    await db.insert(expenseParticipants).values({
      transactionId: inserted.id,
      userId,
      shareAmount: amount.toFixed(2),
    });
  }

  revalidatePath("/transactions");
  revalidatePath("/sources");
  revalidatePath("/");
  redirect("/transactions");
}

export async function updateTransactionAction(id: number, formData: FormData): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = baseSchema.safeParse({
    kind: formData.get("kind"),
    sourceId: formData.get("sourceId"),
    destSourceId: formData.get("destSourceId") ?? "",
    categoryId: formData.get("categoryId") ?? "",
    amount: formData.get("amount"),
    currency: formData.get("currency"),
    occurredAt: formData.get("occurredAt"),
    description: formData.get("description") ?? "",
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const refError = await validateRefs(userId, parsed.data);
  if (refError) return { ok: false, error: refError };

  const { kind, sourceId, destSourceId, categoryId, amount, currency, occurredAt, description, notes } = parsed.data;

  // Refuse to edit a shared expense through the personal flow — that has its own UI.
  const [existing] = await db
    .select({ isShared: transactions.isShared })
    .from(transactions)
    .where(and(eq(transactions.id, id), eq(transactions.userId, userId)))
    .limit(1);
  if (!existing) return { ok: false, error: "Transaction not found" };
  if (existing.isShared) {
    return { ok: false, error: "Edit shared expenses from the group page." };
  }

  await db
    .update(transactions)
    .set({
      sourceId,
      destSourceId: kind === "transfer" ? destSourceId! : null,
      kind,
      categoryId: kind === "transfer" ? null : (categoryId ?? null),
      amount: amount.toFixed(2),
      currency,
      occurredAt: parseDate(occurredAt),
      description,
      notes,
      updatedAt: new Date(),
    })
    .where(and(eq(transactions.id, id), eq(transactions.userId, userId)));

  // Keep the personal-expense participant row in sync (or remove it if kind changed).
  await db
    .delete(expenseParticipants)
    .where(eq(expenseParticipants.transactionId, id));
  if (kind === "expense") {
    await db.insert(expenseParticipants).values({
      transactionId: id,
      userId,
      shareAmount: amount.toFixed(2),
    });
  }

  revalidatePath("/transactions");
  revalidatePath(`/transactions/${id}`);
  revalidatePath("/sources");
  revalidatePath("/");
  redirect("/transactions");
}

export async function deleteTransactionAction(id: number): Promise<ActionResult> {
  const userId = await requireUserId();
  await db.delete(transactions).where(and(eq(transactions.id, id), eq(transactions.userId, userId)));
  revalidatePath("/transactions");
  revalidatePath("/sources");
  revalidatePath("/");
  return { ok: true };
}
