"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/db/schema";
import { requireUserId } from "@/lib/session";

const schema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(6, "New password must be at least 6 characters"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "New passwords do not match",
    path: ["confirmPassword"],
  });

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function changePasswordAction(formData: FormData): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = schema.safeParse({
    currentPassword: String(formData.get("currentPassword") ?? ""),
    newPassword: String(formData.get("newPassword") ?? ""),
    confirmPassword: String(formData.get("confirmPassword") ?? ""),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const [user] = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) return { ok: false, error: "User not found." };

  const ok = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
  if (!ok) return { ok: false, error: "Current password is incorrect." };

  const newHash = await bcrypt.hash(parsed.data.newPassword, 10);
  await db.update(users).set({ passwordHash: newHash }).where(eq(users.id, userId));

  return { ok: true };
}
