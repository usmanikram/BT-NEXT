"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ButtonLink } from "@/components/button-link";

export function AddFriendForm({
  action,
}: {
  action: (formData: FormData) => Promise<{ ok: boolean; error?: string } | void>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const data = new FormData(e.currentTarget);
    startTransition(async () => {
      const r = await action(data);
      if (r && "ok" in r && !r.ok) {
        setError(r.error ?? "Could not add");
        toast.error(r.error ?? "Could not add");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="email" className="text-xs uppercase tracking-wider text-ink-soft">Friend&apos;s email</Label>
        <Input id="email" name="email" type="email" required placeholder="friend@example.com" />
        <p className="text-[11px] text-ink-soft/70">Must be a registered Pocket user. (Invites coming in a future release.)</p>
      </div>
      {error && <p className="text-sm text-coral">{error}</p>}
      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={pending}>{pending ? "Adding…" : "Add friend"}</Button>
        <ButtonLink href="/friends" variant="outline">Cancel</ButtonLink>
      </div>
    </form>
  );
}
