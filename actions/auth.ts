"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, passwordResets } from "@/db/schema";

const schema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  fullName: z.string().min(1, "Name is required").max(100),
});

export type SignupResult = { ok: true } | { ok: false; error: string };

export async function signupAction(formData: FormData): Promise<SignupResult> {
  const parsed = schema.safeParse({
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    password: String(formData.get("password") ?? ""),
    fullName: String(formData.get("fullName") ?? "").trim(),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { email, password, fullName } = parsed.data;

  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing) {
    return { ok: false, error: "An account with this email already exists." };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await db.insert(users).values({ email, passwordHash, fullName });

  return { ok: true };
}

// ============================================================
// Password reset
// ============================================================

const forgotSchema = z.object({ email: z.string().email("Invalid email") });

export type ForgotResult = { ok: true };

/**
 * Always returns { ok: true } so we don't leak which emails are registered.
 * If a matching user exists, generates a token, persists its hash, and emails it via Resend.
 */
export async function requestPasswordResetAction(formData: FormData): Promise<ForgotResult> {
  const parsed = forgotSchema.safeParse({
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
  });
  if (!parsed.success) return { ok: true };

  const [user] = await db.select({ id: users.id, email: users.email }).from(users).where(eq(users.email, parsed.data.email)).limit(1);
  if (!user) return { ok: true };

  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await db.insert(passwordResets).values({ userId: user.id, tokenHash, expiresAt });

  const baseUrl = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const resetUrl = `${baseUrl}/reset/${rawToken}`;

  if (process.env.RESEND_API_KEY) {
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL ?? "Pocket <noreply@pocket.app>",
        to: user.email,
        subject: "Reset your Pocket password",
        text: `Hey,\n\nClick the link below to reset your password. It expires in 1 hour.\n\n${resetUrl}\n\nIf you didn't request this, ignore this email.\n\n— Pocket`,
      });
    } catch (err) {
      console.error("Resend send error:", err);
    }
  } else {
    // Dev fallback — log the link to the server console.
    console.log(`[password reset] ${user.email} → ${resetUrl}`);
  }

  return { ok: true };
}

const resetSchema = z
  .object({
    token: z.string().min(1),
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { message: "Passwords don't match", path: ["confirm"] });

export type ResetResult = { ok: true } | { ok: false; error: string };

export async function resetPasswordAction(formData: FormData): Promise<ResetResult> {
  const parsed = resetSchema.safeParse({
    token: String(formData.get("token") ?? ""),
    password: String(formData.get("password") ?? ""),
    confirm: String(formData.get("confirm") ?? ""),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const tokenHash = crypto.createHash("sha256").update(parsed.data.token).digest("hex");

  const [reset] = await db
    .select()
    .from(passwordResets)
    .where(
      and(
        eq(passwordResets.tokenHash, tokenHash),
        gt(passwordResets.expiresAt, new Date()),
        isNull(passwordResets.usedAt)
      )
    )
    .limit(1);
  if (!reset) return { ok: false, error: "Link is invalid or expired. Request a new one." };

  const hash = await bcrypt.hash(parsed.data.password, 10);
  await db.update(users).set({ passwordHash: hash }).where(eq(users.id, reset.userId));
  await db.update(passwordResets).set({ usedAt: new Date() }).where(eq(passwordResets.id, reset.id));

  return { ok: true };
}
