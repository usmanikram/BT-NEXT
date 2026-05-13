"use server";

import { revalidatePath } from "next/cache";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/db/schema";
import { auth } from "@/lib/auth";

export type ActionResult = { ok: true } | { ok: false; error: string };

async function requireAdmin(): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  if (session.user.role !== "admin") return null;
  return session.user.id;
}

export async function toggleAdminAction(targetUserId: string, makeAdmin: boolean): Promise<ActionResult> {
  const adminId = await requireAdmin();
  if (!adminId) return { ok: false, error: "Not authorized" };
  if (targetUserId === adminId && !makeAdmin) return { ok: false, error: "You can't remove your own admin role" };
  await db
    .update(users)
    .set({ role: makeAdmin ? "admin" : "user" })
    .where(eq(users.id, targetUserId));
  revalidatePath("/admin/users");
  return { ok: true };
}

export async function toggleDisabledAction(targetUserId: string, disabled: boolean): Promise<ActionResult> {
  const adminId = await requireAdmin();
  if (!adminId) return { ok: false, error: "Not authorized" };
  if (targetUserId === adminId) return { ok: false, error: "You can't disable your own account" };
  await db
    .update(users)
    .set({ disabled })
    .where(and(eq(users.id, targetUserId), ne(users.id, adminId)));
  revalidatePath("/admin/users");
  return { ok: true };
}
