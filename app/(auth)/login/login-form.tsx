"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm({ callbackUrl }: { callbackUrl: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");

    startTransition(async () => {
      const res = await signIn("credentials", { email, password, redirect: false });
      if (res?.error) {
        setError("Hmm, those don't match. Try again?");
        return;
      }
      router.push(callbackUrl);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="email" className="text-sm font-medium text-ink">
          Email
        </Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          autoFocus
          placeholder="you@example.com"
          className="h-12 bg-white border-ink/10 rounded-xl text-base"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password" className="text-sm font-medium text-ink">
          Password
        </Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="••••••••"
          className="h-12 bg-white border-ink/10 rounded-xl text-base focus:border-coral focus:ring-coral/20"
        />
      </div>
      {error && <p className="text-sm text-coral">{error}</p>}
      <Button
        type="submit"
        disabled={pending}
        className="w-full h-12 text-base rounded-xl bg-coral text-white hover:bg-coral/90 shadow-[0_8px_20px_rgba(255,107,92,0.3)]"
      >
        {pending ? "Opening…" : (
          <>Let&apos;s go <ArrowRight className="size-4 ml-1" /></>
        )}
      </Button>
    </form>
  );
}
