"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/button-link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CURRENCY_SYMBOL } from "@/lib/constants";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

type CategoryOption = {
  id: number;
  name: string;
  budgeted: number;
  spent: number;
};

type Initial = {
  categoryId: string;
  expenseDate: string;
  amount: string;
  description: string;
};

export function ExpenseForm({
  monthId,
  yearMonth,
  monthStart,
  monthEnd,
  categories,
  initial,
  action,
  submitLabel,
}: {
  monthId: number;
  yearMonth: string;
  monthStart: string;
  monthEnd: string;
  categories: CategoryOption[];
  initial: Initial;
  action: (formData: FormData) => Promise<{ ok: boolean; error?: string } | void>;
  submitLabel: string;
}) {
  const [selectedId, setSelectedId] = useState<string>(initial.categoryId);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const selected = useMemo(
    () => categories.find((c) => String(c.id) === selectedId) ?? null,
    [categories, selectedId]
  );

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

  const hasCats = categories.length > 0;

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <input type="hidden" name="monthId" value={monthId} />
      <input type="hidden" name="yearMonth" value={yearMonth} />

      {!hasCats && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          No categories exist for this month.{" "}
          <Link href="/categories/new" className="underline font-medium">
            Create a category
          </Link>{" "}
          first.
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="categoryId">Category</Label>
        <select
          id="categoryId"
          name="categoryId"
          required
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="flex h-9 w-full rounded-md border bg-background px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
        >
          <option value="">Select category…</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {selected && (
          <p className="text-xs text-muted-foreground">
            Budget <span className="font-mono">{formatMoney(selected.budgeted)}</span> · Spent{" "}
            <span className="font-mono">{formatMoney(selected.spent)}</span> · Left{" "}
            <span
              className={cn(
                "font-mono",
                selected.budgeted - selected.spent < 0 && "text-rose-600"
              )}
            >
              {formatMoney(selected.budgeted - selected.spent)}
            </span>
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="expenseDate">Date</Label>
        <Input
          id="expenseDate"
          name="expenseDate"
          type="date"
          defaultValue={initial.expenseDate}
          min={monthStart}
          max={monthEnd}
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="amount">Amount</Label>
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">
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
        <Label htmlFor="description">Description</Label>
        <Input
          id="description"
          name="description"
          defaultValue={initial.description}
          placeholder="What was this expense for?"
          required
        />
      </div>

      {error && <p className="text-xs text-rose-600">{error}</p>}

      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={pending || !hasCats}>
          {pending ? "Saving…" : submitLabel}
        </Button>
        <ButtonLink href="/expenses" variant="outline">Cancel</ButtonLink>
      </div>
    </form>
  );
}
