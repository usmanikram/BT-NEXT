"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { sources } from "@/db/schema";
import { requireUserId } from "@/lib/session";
import { sourceHasTransactions } from "@/lib/source-service";

const SOURCE_TYPES = [
  "wallet",
  "bank",
  "credit_card",
  "debit_card",
  "easypaisa",
  "jazzcash",
  "payoneer",
  "wise",
  "savings",
] as const;

const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  type: z.enum(SOURCE_TYPES),
  currency: z.string().trim().length(3, "Currency must be a 3-letter ISO code").toUpperCase(),
  openingBalance: z.coerce.number().finite(),
  color: z.string().trim().min(1).max(20),
  icon: z
    .string()
    .trim()
    .max(50)
    .optional()
    .transform((v) => (v === "" ? null : (v ?? null))),
});

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function createSourceAction(formData: FormData): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = schema.safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
    currency: formData.get("currency"),
    openingBalance: formData.get("openingBalance"),
    color: formData.get("color"),
    icon: formData.get("icon"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { name, type, currency, openingBalance, color, icon } = parsed.data;
  await db.insert(sources).values({
    userId,
    name,
    type,
    currency,
    openingBalance: openingBalance.toFixed(2),
    color,
    icon,
  });
  revalidatePath("/sources");
  revalidatePath("/");
  redirect("/sources");
}

export async function updateSourceAction(id: number, formData: FormData): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = schema.safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
    currency: formData.get("currency"),
    openingBalance: formData.get("openingBalance"),
    color: formData.get("color"),
    icon: formData.get("icon"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { name, type, currency, openingBalance, color, icon } = parsed.data;
  await db
    .update(sources)
    .set({ name, type, currency, openingBalance: openingBalance.toFixed(2), color, icon })
    .where(and(eq(sources.id, id), eq(sources.userId, userId)));
  revalidatePath("/sources");
  revalidatePath(`/sources/${id}`);
  revalidatePath("/");
  redirect("/sources");
}

export async function deleteSourceAction(id: number): Promise<ActionResult> {
  const userId = await requireUserId();
  if (await sourceHasTransactions(userId, id)) {
    return {
      ok: false,
      error: "This source has transactions. Archive it instead of deleting.",
    };
  }
  await db.delete(sources).where(and(eq(sources.id, id), eq(sources.userId, userId)));
  revalidatePath("/sources");
  revalidatePath("/");
  return { ok: true };
}

export async function archiveSourceAction(id: number, archived: boolean): Promise<ActionResult> {
  const userId = await requireUserId();
  await db
    .update(sources)
    .set({ archived })
    .where(and(eq(sources.id, id), eq(sources.userId, userId)));
  revalidatePath("/sources");
  revalidatePath(`/sources/${id}`);
  return { ok: true };
}
