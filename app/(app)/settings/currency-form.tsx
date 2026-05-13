"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateDefaultCurrencyAction } from "@/actions/user";

const COMMON = ["PKR", "USD", "EUR", "GBP", "AED", "SAR", "INR", "CAD", "AUD"];

export function CurrencyForm({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startTransition(async () => {
      const r = await updateDefaultCurrencyAction(data);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success("Default currency updated");
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="defaultCurrency" className="text-xs uppercase tracking-wider text-ink-soft">
          Default currency
        </Label>
        <Input
          id="defaultCurrency"
          name="defaultCurrency"
          value={value}
          onChange={(e) => setValue(e.target.value.toUpperCase())}
          maxLength={3}
          className="uppercase"
          required
        />
        <p className="text-[11px] text-ink-soft/70">
          Used for the Total Balance rollup on the dashboard. New sources default to this currency.
        </p>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {COMMON.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setValue(c)}
              className={`rounded-full px-2.5 py-1 text-xs ${
                value === c ? "bg-ink text-cream" : "bg-cream-soft text-ink-soft hover:text-ink"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>
      <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save currency"}</Button>
    </form>
  );
}
