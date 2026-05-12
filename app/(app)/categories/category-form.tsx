"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/button-link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CATEGORY_COLORS, CURRENCY_SYMBOL } from "@/lib/constants";
import { cn } from "@/lib/utils";

type Initial = {
  name: string;
  budgetedAmount: string;
  color: string;
  sortOrder: string;
};

export function CategoryForm({
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
  const [color, setColor] = useState(initial.color || CATEGORY_COLORS[0]);
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
      <input type="hidden" name="color" value={color} />

      <div className="space-y-1.5">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          name="name"
          defaultValue={initial.name}
          placeholder="Groceries, Rent, Transport…"
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="budgetedAmount">Budget</Label>
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">
            {CURRENCY_SYMBOL.trim()}
          </span>
          <Input
            id="budgetedAmount"
            name="budgetedAmount"
            type="number"
            step="0.01"
            min="0"
            defaultValue={initial.budgetedAmount}
            placeholder="0.00"
            required
            className="pl-10"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Color</Label>
        <div className="flex flex-wrap gap-2">
          {CATEGORY_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Select color ${c}`}
              onClick={() => setColor(c)}
              className={cn(
                "size-7 rounded-full transition-all ring-offset-background",
                color === c
                  ? "ring-2 ring-foreground ring-offset-2"
                  : "ring-1 ring-inset ring-black/10 hover:scale-110"
              )}
              style={{ background: c }}
            />
          ))}
        </div>
      </div>

      <div className="space-y-1.5 max-w-32">
        <Label htmlFor="sortOrder">Sort order</Label>
        <Input id="sortOrder" name="sortOrder" type="number" min="0" defaultValue={initial.sortOrder} />
      </div>

      {error && <p className="text-xs text-rose-600">{error}</p>}

      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
        <ButtonLink href="/categories" variant="outline">Cancel</ButtonLink>
      </div>
    </form>
  );
}
