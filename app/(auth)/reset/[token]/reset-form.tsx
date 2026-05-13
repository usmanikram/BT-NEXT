"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resetPasswordAction } from "@/actions/auth";

export function ResetForm({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const data = new FormData(e.currentTarget);
    data.set("token", token);
    startTransition(async () => {
      const r = await resetPasswordAction(data);
      if (!r.ok) {
        setError(r.error);
        toast.error(r.error);
        return;
      }
      toast.success("Password updated. Log in with your new password.");
      router.push("/login");
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="password" className="text-xs uppercase tracking-wider text-ink-soft">New password</Label>
        <Input id="password" name="password" type="password" minLength={6} required placeholder="•••••••" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirm" className="text-xs uppercase tracking-wider text-ink-soft">Confirm</Label>
        <Input id="confirm" name="confirm" type="password" minLength={6} required placeholder="•••••••" />
      </div>
      {error && <p className="text-sm text-coral">{error}</p>}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Saving…" : "Set new password"}
      </Button>
    </form>
  );
}
