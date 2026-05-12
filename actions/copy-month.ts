"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { months } from "@/db/schema";
import { requireUserId } from "@/lib/session";
import { copyCategoriesToMonth, type CopySelection } from "@/lib/budget-service";
import { monthLabel } from "@/lib/format";
import { isValidYearMonth } from "@/lib/month";

export type CopyMonthInput = {
  sourceMonthId: number;
  targetYearMonth: string;
  selections: CopySelection[];
};

export type ActionResult = { ok: true; count: number; targetYearMonth: string } | { ok: false; error: string };

export async function copyMonthAction(input: CopyMonthInput): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!isValidYearMonth(input.targetYearMonth)) return { ok: false, error: "Invalid target month." };

  const [existing] = await db
    .select()
    .from(months)
    .where(and(eq(months.userId, userId), eq(months.yearMonth, input.targetYearMonth)))
    .limit(1);

  let targetMonthId: number;
  if (existing) {
    targetMonthId = existing.id;
  } else {
    const [inserted] = await db
      .insert(months)
      .values({
        userId,
        yearMonth: input.targetYearMonth,
        label: monthLabel(input.targetYearMonth),
      })
      .returning({ id: months.id });
    targetMonthId = inserted.id;
  }

  const count = await copyCategoriesToMonth(userId, input.sourceMonthId, targetMonthId, input.selections);
  revalidatePath("/categories");
  return { ok: true, count, targetYearMonth: input.targetYearMonth };
}

export async function copyMonthAndRedirect(input: CopyMonthInput) {
  const result = await copyMonthAction(input);
  if (result.ok) {
    redirect("/categories");
  }
  return result;
}
