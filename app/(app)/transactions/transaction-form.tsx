"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ButtonLink } from "@/components/button-link";

type SourceOption = { id: number; name: string; currency: string; type: string };
type CategoryOption = { id: number; name: string };

type Initial = {
  kind: "income" | "expense" | "transfer";
  sourceId: number | "";
  destSourceId: number | "";
  categoryId: number | "";
  amount: string;
  currency: string;
  occurredAt: string; // YYYY-MM-DD
  description: string;
  notes: string;
};

const KIND_TABS: Array<{ value: Initial["kind"]; label: string }> = [
  { value: "expense", label: "Expense" },
  { value: "income", label: "Income" },
  { value: "transfer", label: "Transfer" },
];

export function TransactionForm({
  initial,
  sources,
  categories,
  action,
  submitLabel,
}: {
  initial: Initial;
  sources: SourceOption[];
  categories: CategoryOption[];
  action: (formData: FormData) => Promise<{ ok: boolean; error?: string } | void>;
  submitLabel: string;
}) {
  const [kind, setKind] = useState<Initial["kind"]>(initial.kind);
  const [sourceId, setSourceId] = useState<number | "">(initial.sourceId);
  const [currency, setCurrency] = useState(initial.currency);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const selectedSource = sources.find((s) => s.id === Number(sourceId));

  function onSourceChange(v: string) {
    const id = v ? Number(v) : "";
    setSourceId(id);
    const found = sources.find((s) => s.id === id);
    if (found) setCurrency(found.currency);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const data = new FormData(e.currentTarget);
    data.set("kind", kind);
    data.set("currency", currency);
    startTransition(async () => {
      const result = await action(data);
      if (result && "ok" in result && !result.ok) {
        setError(result.error ?? "Save failed");
        toast.error(result.error ?? "Save failed");
      }
    });
  }

  if (sources.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-ink/10 bg-card p-6 text-center">
        <p className="text-sm text-ink-soft">
          You need at least one source before adding transactions.
        </p>
        <div className="mt-4">
          <ButtonLink href="/sources/new">Add a source</ButtonLink>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="grid grid-cols-3 gap-2 rounded-xl bg-ink/5 p-1">
        {KIND_TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setKind(t.value)}
            className={`rounded-lg py-2 text-sm font-medium transition-colors ${
              kind === t.value ? "bg-card shadow-sm" : "text-ink-soft hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="sourceId" className="text-xs uppercase tracking-wider text-ink-soft">
            {kind === "transfer" ? "From source" : "Source"}
          </Label>
          <select
            id="sourceId"
            name="sourceId"
            value={sourceId === "" ? "" : String(sourceId)}
            onChange={(e) => onSourceChange(e.target.value)}
            required
            className="flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
          >
            <option value="" disabled>Choose…</option>
            {sources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.currency})
              </option>
            ))}
          </select>
        </div>

        {kind === "transfer" ? (
          <div className="space-y-1.5">
            <Label htmlFor="destSourceId" className="text-xs uppercase tracking-wider text-ink-soft">
              To source
            </Label>
            <select
              id="destSourceId"
              name="destSourceId"
              defaultValue={initial.destSourceId === "" ? "" : String(initial.destSourceId)}
              required
              className="flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
            >
              <option value="" disabled>Choose…</option>
              {sources
                .filter((s) => s.id !== Number(sourceId) && (!selectedSource || s.currency === selectedSource.currency))
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.currency})
                  </option>
                ))}
            </select>
            <p className="text-[11px] text-ink-soft/70">Same currency only — cross-currency transfers coming soon.</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor="categoryId" className="text-xs uppercase tracking-wider text-ink-soft">
              Category {kind === "expense" && <span className="normal-case text-coral">·</span>}
            </Label>
            <select
              id="categoryId"
              name="categoryId"
              defaultValue={initial.categoryId === "" ? "" : String(initial.categoryId)}
              required={kind === "expense"}
              className="flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
            >
              <option value="">{kind === "expense" ? "Pick a pocket…" : "— none —"}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="grid grid-cols-[1fr_120px] gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="amount" className="text-xs uppercase tracking-wider text-ink-soft">Amount</Label>
          <Input
            id="amount"
            name="amount"
            type="number"
            step="0.01"
            min="0.01"
            defaultValue={initial.amount}
            placeholder="0.00"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="currency" className="text-xs uppercase tracking-wider text-ink-soft">Currency</Label>
          <Input
            id="currency"
            name="currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value.toUpperCase())}
            maxLength={3}
            required
            className="uppercase"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="occurredAt" className="text-xs uppercase tracking-wider text-ink-soft">Date</Label>
        <Input id="occurredAt" name="occurredAt" type="date" defaultValue={initial.occurredAt} required />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description" className="text-xs uppercase tracking-wider text-ink-soft">
          Description <span className="normal-case text-ink-soft/70">· optional</span>
        </Label>
        <Input id="description" name="description" defaultValue={initial.description} placeholder="What was it for?" maxLength={255} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes" className="text-xs uppercase tracking-wider text-ink-soft">
          Notes <span className="normal-case text-ink-soft/70">· optional</span>
        </Label>
        <Textarea id="notes" name="notes" defaultValue={initial.notes} placeholder="Anything else to remember?" rows={3} />
      </div>

      {error && <p className="text-sm text-coral">{error}</p>}
      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
        <ButtonLink href="/transactions" variant="outline">Cancel</ButtonLink>
      </div>
    </form>
  );
}
