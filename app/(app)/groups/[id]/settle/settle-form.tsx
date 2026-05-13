"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ButtonLink } from "@/components/button-link";

type Other = { userId: string; name: string; email: string };

export function SettleUpForm({
  groupId,
  fromUserId,
  others,
  initial,
  action,
  cancelHref,
}: {
  groupId?: number | null;
  fromUserId: string;
  others: Other[];
  initial: {
    toUserId: string;
    amount: string;
    currency: string;
    occurredAt: string;
    note: string;
  };
  action: (formData: FormData) => Promise<{ ok: boolean; error?: string } | void>;
  cancelHref: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const data = new FormData(e.currentTarget);
    data.set("fromUserId", fromUserId);
    if (groupId) data.set("groupId", String(groupId));
    startTransition(async () => {
      const r = await action(data);
      if (r && "ok" in r && !r.ok) {
        setError(r.error ?? "Save failed");
        toast.error(r.error ?? "Save failed");
      }
    });
  }

  if (others.length === 0) {
    return <p className="text-sm text-ink-soft">No one to settle with.</p>;
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <p className="text-sm text-ink-soft">Record a payment you made or received. Doesn&apos;t move actual money — just updates the balance.</p>

      <div className="space-y-1.5">
        <Label htmlFor="toUserId" className="text-xs uppercase tracking-wider text-ink-soft">Paid to</Label>
        <select
          id="toUserId"
          name="toUserId"
          defaultValue={initial.toUserId}
          required
          className="flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
        >
          {others.map((o) => (
            <option key={o.userId} value={o.userId}>{o.name} ({o.email})</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-[1fr_120px] gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="amount" className="text-xs uppercase tracking-wider text-ink-soft">Amount</Label>
          <Input id="amount" name="amount" type="number" step="0.01" min="0.01" defaultValue={initial.amount} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="currency" className="text-xs uppercase tracking-wider text-ink-soft">Currency</Label>
          <Input id="currency" name="currency" defaultValue={initial.currency} maxLength={3} className="uppercase" required />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="occurredAt" className="text-xs uppercase tracking-wider text-ink-soft">Date</Label>
        <Input id="occurredAt" name="occurredAt" type="date" defaultValue={initial.occurredAt} required />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="note" className="text-xs uppercase tracking-wider text-ink-soft">
          Note <span className="normal-case text-ink-soft/70">· optional</span>
        </Label>
        <Input id="note" name="note" defaultValue={initial.note} maxLength={500} />
      </div>

      {error && <p className="text-sm text-coral">{error}</p>}
      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Record settlement"}</Button>
        <ButtonLink href={cancelHref} variant="outline">Cancel</ButtonLink>
      </div>
    </form>
  );
}
