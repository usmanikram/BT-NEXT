"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { groups, groupMembers, users } from "@/db/schema";
import { requireUserId } from "@/lib/session";
import { isGroupMember } from "@/lib/group-service";

export type ActionResult<T = unknown> = { ok: true; data?: T } | { ok: false; error: string };

const createSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  description: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => (v === "" ? null : (v ?? null))),
  defaultCurrency: z.string().trim().length(3).toUpperCase(),
});

export async function createGroupAction(formData: FormData): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = createSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    defaultCurrency: formData.get("defaultCurrency"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { name, description, defaultCurrency } = parsed.data;

  const [g] = await db
    .insert(groups)
    .values({ name, description, defaultCurrency, createdBy: userId })
    .returning({ id: groups.id });
  await db.insert(groupMembers).values({ groupId: g.id, userId });

  revalidatePath("/groups");
  redirect(`/groups/${g.id}`);
}

const addMemberSchema = z.object({ email: z.string().email() });

export async function addMemberByEmailAction(groupId: number, formData: FormData): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!(await isGroupMember(userId, groupId))) return { ok: false, error: "Not a member" };

  const parsed = addMemberSchema.safeParse({
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid email" };

  const [target] = await db.select({ id: users.id }).from(users).where(eq(users.email, parsed.data.email)).limit(1);
  if (!target) return { ok: false, error: "No user with that email. Ask them to sign up first." };

  // Already an active member?
  const [existing] = await db
    .select()
    .from(groupMembers)
    .where(
      and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, target.id), isNull(groupMembers.leftAt))
    )
    .limit(1);
  if (existing) return { ok: false, error: "Already a member" };

  await db.insert(groupMembers).values({ groupId, userId: target.id });
  revalidatePath(`/groups/${groupId}`);
  return { ok: true };
}

export async function removeMemberAction(groupId: number, targetUserId: string): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!(await isGroupMember(userId, groupId))) return { ok: false, error: "Not a member" };
  // Soft-leave (set leftAt).
  await db
    .update(groupMembers)
    .set({ leftAt: new Date() })
    .where(
      and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, targetUserId), isNull(groupMembers.leftAt))
    );
  revalidatePath(`/groups/${groupId}`);
  return { ok: true };
}

export async function leaveGroupAction(groupId: number): Promise<ActionResult> {
  const userId = await requireUserId();
  // Refuse if the user has any non-zero balance in this group (any currency).
  const { getGroupBalances } = await import("@/lib/group-service");
  const views = await getGroupBalances(groupId);
  for (const v of views) {
    const my = v.netByUser.find((n) => n.userId === userId);
    if (my && Math.round(my.net * 100) !== 0) {
      return { ok: false, error: "Settle up your balance in this group before leaving." };
    }
  }
  await db
    .update(groupMembers)
    .set({ leftAt: new Date() })
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId), isNull(groupMembers.leftAt)));
  revalidatePath("/groups");
  redirect("/groups");
}

export async function archiveGroupAction(groupId: number, archived: boolean): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!(await isGroupMember(userId, groupId))) return { ok: false, error: "Not a member" };
  await db
    .update(groups)
    .set({ archivedAt: archived ? new Date() : null, updatedAt: new Date() })
    .where(eq(groups.id, groupId));
  revalidatePath("/groups");
  revalidatePath(`/groups/${groupId}`);
  return { ok: true };
}

export async function toggleSimplifyDebtsAction(groupId: number, on: boolean): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!(await isGroupMember(userId, groupId))) return { ok: false, error: "Not a member" };
  await db.update(groups).set({ simplifyDebts: on, updatedAt: new Date() }).where(eq(groups.id, groupId));
  revalidatePath(`/groups/${groupId}`);
  return { ok: true };
}
