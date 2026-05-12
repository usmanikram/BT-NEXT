"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ButtonLink } from "@/components/button-link";
import { CURRENCY_SYMBOL } from "@/lib/constants";

type Initial = {
  source: string;
  amount: string;
  notes: string;
};

export function IncomeForm({
  monthId,
  initial,
  action,
  submitLabel,
}: {
  monthId: number;
  initial: Initial;
  action: (formData: FormData) => Promise<{ ok: boolean; error?: string } | void>;
  submitLabel: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const data = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await action(data);
      if (result && "ok" in result && !result.ok) {
        setError(result.error ?? "Save failed");
        toast.error(result.error ?? "Save failed");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <input type="hidden" name="monthId" value={monthId} />
      <div className="space-y-1.5">
        <Label htmlFor="source" className="text-xs uppercase tracking-wider text-ink-soft">Source</Label>
        <Input
          id="source"
          name="source"
          defaultValue={initial.source}
          placeholder="Salary, Freelance, Rental…"
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="amount" className="text-xs uppercase tracking-wider text-ink-soft">Amount</Label>
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-ink-soft">
            {CURRENCY_SYMBOL.trim()}
          </span>
          <Input
            id="amount"
            name="amount"
            type="number"
            step="0.01"
            min="0.01"
            defaultValue={initial.amount}
            placeholder="0.00"
            required
            className="pl-10"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="notes" className="text-xs uppercase tracking-wider text-ink-soft">
          Notes <span className="normal-case text-ink-soft/70">· optional</span>
        </Label>
        <Input id="notes" name="notes" defaultValue={initial.notes} placeholder="Anything to remember?" />
      </div>
      {error && <p className="text-sm text-coral">{error}</p>}
      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
        <ButtonLink href="/income" variant="outline">Cancel</ButtonLink>
      </div>
    </form>
  );
}
