"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ButtonLink } from "@/components/button-link";
import { CATEGORY_COLORS } from "@/lib/constants";
import { SOURCE_TYPE_OPTIONS } from "@/components/source-icon";

type Initial = {
  name: string;
  type: string;
  currency: string;
  openingBalance: string;
  color: string;
};

export function SourceForm({
  initial,
  action,
  submitLabel,
  lockCurrency = false,
}: {
  initial: Initial;
  action: (formData: FormData) => Promise<{ ok: boolean; error?: string } | void>;
  submitLabel: string;
  /** Currency immutable on existing source — only the type/name/color/opening editable. */
  lockCurrency?: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [color, setColor] = useState(initial.color);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const data = new FormData(e.currentTarget);
    if (lockCurrency) data.set("currency", initial.currency);
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
      <div className="space-y-1.5">
        <Label htmlFor="name" className="text-xs uppercase tracking-wider text-ink-soft">Name</Label>
        <Input id="name" name="name" defaultValue={initial.name} placeholder="HBL Main, Cash Wallet, Wise USD…" required maxLength={100} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="type" className="text-xs uppercase tracking-wider text-ink-soft">Type</Label>
          <select
            id="type"
            name="type"
            defaultValue={initial.type}
            required
            className="flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
          >
            {SOURCE_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="currency" className="text-xs uppercase tracking-wider text-ink-soft">
            Currency {lockCurrency && <span className="normal-case text-ink-soft/70">· locked</span>}
          </Label>
          <Input
            id="currency"
            name="currency"
            defaultValue={initial.currency}
            placeholder="PKR"
            maxLength={3}
            required
            disabled={lockCurrency}
            className="uppercase"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="openingBalance" className="text-xs uppercase tracking-wider text-ink-soft">
          Opening balance
        </Label>
        <Input
          id="openingBalance"
          name="openingBalance"
          type="number"
          step="0.01"
          defaultValue={initial.openingBalance}
          placeholder="0.00"
        />
        <p className="text-xs text-ink-soft/70">Starting amount in this source before tracking begins.</p>
      </div>

      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-wider text-ink-soft">Color</Label>
        <div className="flex flex-wrap gap-2">
          {CATEGORY_COLORS.map((c) => (
            <button
              type="button"
              key={c}
              onClick={() => setColor(c)}
              className="size-7 rounded-full border-2 transition-transform"
              style={{ background: c, borderColor: color === c ? "#1F1A14" : "transparent", transform: color === c ? "scale(1.1)" : "scale(1)" }}
              aria-label={`Pick color ${c}`}
            />
          ))}
        </div>
        <input type="hidden" name="color" value={color} />
      </div>

      <input type="hidden" name="icon" value="" />

      {error && <p className="text-sm text-coral">{error}</p>}
      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
        <ButtonLink href="/sources" variant="outline">Cancel</ButtonLink>
      </div>
    </form>
  );
}
