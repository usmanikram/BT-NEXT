"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ButtonLink } from "@/components/button-link";
import { CATEGORY_COLORS } from "@/lib/constants";

type SourceOption = { id: number; name: string; currency: string };

type Initial = {
  name: string;
  targetAmount: string;
  currentAmount: string;
  currency: string;
  deadline: string;
  sourceId: number | "";
  color: string;
};

export function GoalForm({
  initial,
  sources,
  action,
  submitLabel,
}: {
  initial: Initial;
  sources: SourceOption[];
  action: (formData: FormData) => Promise<{ ok: boolean; error?: string } | void>;
  submitLabel: string;
}) {
  const [color, setColor] = useState(initial.color);
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
      <div className="space-y-1.5">
        <Label htmlFor="name" className="text-xs uppercase tracking-wider text-ink-soft">
          Goal name
        </Label>
        <Input id="name" name="name" defaultValue={initial.name} placeholder="Laptop, Emergency fund, Umrah…" required maxLength={100} />
      </div>

      <div className="grid grid-cols-[1fr_120px] gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="targetAmount" className="text-xs uppercase tracking-wider text-ink-soft">Target</Label>
          <Input id="targetAmount" name="targetAmount" type="number" step="0.01" min="0.01" defaultValue={initial.targetAmount} placeholder="0.00" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="currency" className="text-xs uppercase tracking-wider text-ink-soft">Currency</Label>
          <Input id="currency" name="currency" defaultValue={initial.currency} maxLength={3} required className="uppercase" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="currentAmount" className="text-xs uppercase tracking-wider text-ink-soft">
          Already saved
        </Label>
        <Input id="currentAmount" name="currentAmount" type="number" step="0.01" min="0" defaultValue={initial.currentAmount} placeholder="0.00" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="deadline" className="text-xs uppercase tracking-wider text-ink-soft">
            Deadline <span className="normal-case text-ink-soft/70">· optional</span>
          </Label>
          <Input id="deadline" name="deadline" type="date" defaultValue={initial.deadline} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sourceId" className="text-xs uppercase tracking-wider text-ink-soft">
            Source <span className="normal-case text-ink-soft/70">· optional</span>
          </Label>
          <select
            id="sourceId"
            name="sourceId"
            defaultValue={initial.sourceId === "" ? "" : String(initial.sourceId)}
            className="flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
          >
            <option value="">— none —</option>
            {sources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.currency})
              </option>
            ))}
          </select>
        </div>
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
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : submitLabel}</Button>
        <ButtonLink href="/goals" variant="outline">Cancel</ButtonLink>
      </div>
    </form>
  );
}
