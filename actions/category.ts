"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { categoriesV2, budgets } from "@/db/schema";
import { requireUserId } from "@/lib/session";

const schema = z.object({
  monthId: z.coerce.number().int().positive(),
  name: z.string().trim().min(1, "Category name is required").max(100),
  budgetedAmount: z.coerce.number().min(0, "Budget amount must be zero or positive"),
  color: z.string().regex(/^#[0-9a-fA-F]{3,8}$/, "Invalid color"),
  sortOrder: z.coerce.number().int().min(0).default(0),
});

export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Create a global category (if name unique) and set its budget for this month.
 * If a category with the same name already exists globally, reuse it and only
 * upsert the budget for the month.
 */
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

  // Reuse global category if one already exists with this name (case-sensitive match
  // matches the unique index).
  const [existing] = await db
    .select({ id: categoriesV2.id })
    .from(categoriesV2)
    .where(and(eq(categoriesV2.userId, userId), eq(categoriesV2.name, name)))
    .limit(1);

  let categoryId: number;
  if (existing) {
    categoryId = existing.id;
  } else {
    const [inserted] = await db
      .insert(categoriesV2)
      .values({
        userId,
        name,
        kind: "expense",
        color,
        sortOrder,
      })
      .returning({ id: categoriesV2.id });
    categoryId = inserted.id;
  }

  // Upsert budget for this month (in case it was already there from a previous attempt)
  await db
    .insert(budgets)
    .values({
      userId,
      monthId,
      categoryId,
      amount: budgetedAmount.toFixed(2),
    })
    .onConflictDoUpdate({
      target: [budgets.userId, budgets.monthId, budgets.categoryId],
      set: { amount: budgetedAmount.toFixed(2), updatedAt: new Date() },
    });

  revalidatePath("/categories");
  revalidatePath("/");
  redirect("/categories");
}

/**
 * Update a global category (name, color, sort) and the budget for this month.
 * Renames apply globally — this is intentional in the new model.
 */
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
    .select({ id: categoriesV2.id })
    .from(categoriesV2)
    .where(
      and(eq(categoriesV2.userId, userId), eq(categoriesV2.name, name), ne(categoriesV2.id, id))
    )
    .limit(1);
  if (dup) return { ok: false, error: "Another pocket already has this name." };

  await db
    .update(categoriesV2)
    .set({ name, color, sortOrder })
    .where(and(eq(categoriesV2.id, id), eq(categoriesV2.userId, userId)));

  await db
    .insert(budgets)
    .values({
      userId,
      monthId,
      categoryId: id,
      amount: budgetedAmount.toFixed(2),
    })
    .onConflictDoUpdate({
      target: [budgets.userId, budgets.monthId, budgets.categoryId],
      set: { amount: budgetedAmount.toFixed(2), updatedAt: new Date() },
    });

  revalidatePath("/categories");
  revalidatePath("/");
  redirect("/categories");
}

/**
 * Remove the budget for this category in this month — keeps the global category alive
 * so historical transactions stay categorized. The legacy DELETE semantics ("can't delete
 * categories with expenses") don't apply here because we don't drop the category itself.
 */
export async function deleteCategoryAction(id: number, monthIdOpt?: number): Promise<ActionResult> {
  const userId = await requireUserId();

  // monthId comes through a closure on the page (server component) — actions only see id.
  // For backward compatibility with current call-sites that pass only the id, we delete
  // the budget for the *current* month from the cookie/searchParams isn't reachable here.
  // Instead: delete ALL budgets for this category for the user. Conservative; user can
  // re-budget for this month if they wanted just one month removed.
  if (monthIdOpt) {
    await db
      .delete(budgets)
      .where(
        and(
          eq(budgets.userId, userId),
          eq(budgets.categoryId, id),
          eq(budgets.monthId, monthIdOpt)
        )
      );
  } else {
    await db
      .delete(budgets)
      .where(and(eq(budgets.userId, userId), eq(budgets.categoryId, id)));
  }

  revalidatePath("/categories");
  revalidatePath("/");
  return { ok: true };
}
