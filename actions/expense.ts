"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { categories, expenses } from "@/db/schema";
import { requireUserId } from "@/lib/session";
import { getMonthEnd, getMonthStart } from "@/lib/month";

const schema = z.object({
  monthId: z.coerce.number().int().positive(),
  yearMonth: z.string().regex(/^\d{4}-\d{2}$/),
  categoryId: z.coerce.number().int().positive(),
  expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date is required"),
  amount: z.coerce.number().positive("Amount must be a positive number"),
  description: z.string().trim().min(1, "Description is required").max(255),
});

export type ActionResult = { ok: true } | { ok: false; error: string };

async function validateBounds(
  userId: string,
  monthId: number,
  yearMonth: string,
  categoryId: number,
  expenseDate: string
): Promise<string | null> {
  if (expenseDate < getMonthStart(yearMonth) || expenseDate > getMonthEnd(yearMonth)) {
    return `Date must be within ${yearMonth}.`;
  }
  const [cat] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(
      and(
        eq(categories.userId, userId),
        eq(categories.id, categoryId),
        eq(categories.monthId, monthId)
      )
    )
    .limit(1);
  if (!cat) return "Invalid category for this month.";
  return null;
}

export async function createExpenseAction(formData: FormData): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = schema.safeParse({
    monthId: formData.get("monthId"),
    yearMonth: formData.get("yearMonth"),
    categoryId: formData.get("categoryId"),
    expenseDate: formData.get("expenseDate"),
    amount: formData.get("amount"),
    description: formData.get("description"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { monthId, yearMonth, categoryId, expenseDate, amount, description } = parsed.data;

  const boundErr = await validateBounds(userId, monthId, yearMonth, categoryId, expenseDate);
  if (boundErr) return { ok: false, error: boundErr };

  await db.insert(expenses).values({
    userId,
    monthId,
    categoryId,
    expenseDate,
    amount: amount.toFixed(2),
    description,
  });
  revalidatePath("/expenses");
  redirect("/expenses");
}

export async function updateExpenseAction(id: number, formData: FormData): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = schema.safeParse({
    monthId: formData.get("monthId"),
    yearMonth: formData.get("yearMonth"),
    categoryId: formData.get("categoryId"),
    expenseDate: formData.get("expenseDate"),
    amount: formData.get("amount"),
    description: formData.get("description"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { monthId, yearMonth, categoryId, expenseDate, amount, description } = parsed.data;

  const boundErr = await validateBounds(userId, monthId, yearMonth, categoryId, expenseDate);
  if (boundErr) return { ok: false, error: boundErr };

  await db
    .update(expenses)
    .set({
      categoryId,
      expenseDate,
      amount: amount.toFixed(2),
      description,
      updatedAt: new Date(),
    })
    .where(and(eq(expenses.id, id), eq(expenses.userId, userId)));
  revalidatePath("/expenses");
  redirect("/expenses");
}

export async function deleteExpenseAction(id: number): Promise<ActionResult> {
  const userId = await requireUserId();
  await db.delete(expenses).where(and(eq(expenses.id, id), eq(expenses.userId, userId)));
  revalidatePath("/expenses");
  return { ok: true };
}
