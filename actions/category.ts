"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { and, count, eq, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { categories, expenses } from "@/db/schema";
import { requireUserId } from "@/lib/session";

const schema = z.object({
  monthId: z.coerce.number().int().positive(),
  name: z.string().trim().min(1, "Category name is required").max(100),
  budgetedAmount: z.coerce.number().min(0, "Budget amount must be zero or positive"),
  color: z.string().regex(/^#[0-9a-fA-F]{3,8}$/, "Invalid color"),
  sortOrder: z.coerce.number().int().min(0).default(0),
});

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function createCategoryAction(formData: FormData): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = schema.safeParse({
    monthId: formData.get("monthId"),
    name: formData.get("name"),
    budgetedAmount: formData.get("budgetedAmount"),
    color: formData.get("color"),
    sortOrder: formData.get("sortOrder") ?? 0,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { monthId, name, budgetedAmount, color, sortOrder } = parsed.data;

  const [dup] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.userId, userId), eq(categories.monthId, monthId), eq(categories.name, name)))
    .limit(1);
  if (dup) return { ok: false, error: "A category with this name already exists for this month." };

  await db.insert(categories).values({
    userId,
    monthId,
    name,
    budgetedAmount: budgetedAmount.toFixed(2),
    color,
    sortOrder,
  });
  revalidatePath("/categories");
  redirect("/categories");
}

export async function updateCategoryAction(
  id: number,
  formData: FormData
): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = schema.safeParse({
    monthId: formData.get("monthId"),
    name: formData.get("name"),
    budgetedAmount: formData.get("budgetedAmount"),
    color: formData.get("color"),
    sortOrder: formData.get("sortOrder") ?? 0,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { monthId, name, budgetedAmount, color, sortOrder } = parsed.data;

  const [dup] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(
      and(
        eq(categories.userId, userId),
        eq(categories.monthId, monthId),
        eq(categories.name, name),
        ne(categories.id, id)
      )
    )
    .limit(1);
  if (dup) return { ok: false, error: "A category with this name already exists for this month." };

  await db
    .update(categories)
    .set({
      name,
      budgetedAmount: budgetedAmount.toFixed(2),
      color,
      sortOrder,
      updatedAt: new Date(),
    })
    .where(and(eq(categories.id, id), eq(categories.userId, userId)));
  revalidatePath("/categories");
  redirect("/categories");
}

export async function deleteCategoryAction(id: number): Promise<ActionResult> {
  const userId = await requireUserId();
  const [c] = await db
    .select({ n: count() })
    .from(expenses)
    .where(and(eq(expenses.categoryId, id), eq(expenses.userId, userId)));
  if (c && Number(c.n) > 0) {
    return {
      ok: false,
      error: `Cannot delete: this category has ${c.n} expense(s). Delete them first.`,
    };
  }
  await db.delete(categories).where(and(eq(categories.id, id), eq(categories.userId, userId)));
  revalidatePath("/categories");
  return { ok: true };
}
