"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ButtonLink } from "@/components/button-link";

export function GroupCreateForm({
  defaultCurrency,
  action,
}: {
  defaultCurrency: string;
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
        setError(r.error ?? "Save failed");
        toast.error(r.error ?? "Save failed");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="name" className="text-xs uppercase tracking-wider text-ink-soft">Group name</Label>
        <Input id="name" name="name" placeholder="Roommates, Goa Trip, Office lunch…" required maxLength={100} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="description" className="text-xs uppercase tracking-wider text-ink-soft">
          Description <span className="normal-case text-ink-soft/70">· optional</span>
        </Label>
        <Textarea id="description" name="description" rows={2} placeholder="What this group is for" maxLength={500} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="defaultCurrency" className="text-xs uppercase tracking-wider text-ink-soft">Default currency</Label>
        <Input
          id="defaultCurrency"
          name="defaultCurrency"
          defaultValue={defaultCurrency}
          maxLength={3}
          required
          className="uppercase"
        />
        <p className="text-[11px] text-ink-soft/70">You can still log expenses in other currencies later.</p>
      </div>
      {error && <p className="text-sm text-coral">{error}</p>}
      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={pending}>{pending ? "Creating…" : "Create group"}</Button>
        <ButtonLink href="/groups" variant="outline">Cancel</ButtonLink>
      </div>
    </form>
  );
}
