"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { friendships, users } from "@/db/schema";
import { requireUserId } from "@/lib/session";
import { canonicalPair } from "@/lib/friend-service";

export type ActionResult = { ok: true } | { ok: false; error: string };

const addSchema = z.object({ email: z.string().email() });

export async function addFriendByEmailAction(formData: FormData): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = addSchema.safeParse({
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
  });
  if (!parsed.success) return { ok: false, error: "Invalid email" };

  const [target] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.email, parsed.data.email))
    .limit(1);
  if (!target) return { ok: false, error: "No user with that email. Ask them to sign up first." };
  if (target.id === userId) return { ok: false, error: "You can't add yourself" };

  const { lo, hi } = canonicalPair(userId, target.id);

  const [existing] = await db
    .select({ id: friendships.id })
    .from(friendships)
    .where(and(eq(friendships.userAId, lo), eq(friendships.userBId, hi)))
    .limit(1);
  if (existing) return { ok: false, error: "Already friends" };

  await db.insert(friendships).values({ userAId: lo, userBId: hi });
  revalidatePath("/friends");
  redirect(`/friends/${target.id}`);
}

export async function removeFriendAction(friendId: string): Promise<ActionResult> {
  const userId = await requireUserId();
  const { lo, hi } = canonicalPair(userId, friendId);
  await db
    .delete(friendships)
    .where(and(eq(friendships.userAId, lo), eq(friendships.userBId, hi)));
  revalidatePath("/friends");
  return { ok: true };
}
