"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ButtonLink } from "@/components/button-link";
import { computeSplit, type Split } from "@/lib/split-engine";
import { cn } from "@/lib/utils";

export type Participant = { userId: string; name: string; email: string };
export type SourceOption = { id: number; name: string; currency: string };
export type CategoryOption = { id: number; name: string };

const TYPES: Array<{ value: "equal" | "exact" | "percent" | "shares"; label: string }> = [
  { value: "equal", label: "Equal" },
  { value: "exact", label: "Exact" },
  { value: "percent", label: "%" },
  { value: "shares", label: "Shares" },
];

export type SplitEditorInitial = {
  amount: string;
  currency: string;
  sourceId: number | "";
  categoryId: number | "";
  occurredAt: string;
  description: string;
  notes: string;
  splitType: "equal" | "exact" | "percent" | "shares";
  /** Pre-populated participants (e.g. group members or a friend pair). */
  defaultParticipants: Participant[];
  /** Pre-loaded existing splits keyed by userId, only used when editing. */
  initialShares?: Record<string, { share?: number; input?: number }>;
};

export function SplitEditor({
  members,
  sources,
  categories,
  initial,
  action,
  submitLabel,
  cancelHref,
  groupId,
  payerName,
}: {
  /** All people who could be participants (group members, or [you, friend] for friend splits). */
  members: Participant[];
  sources: SourceOption[];
  categories: CategoryOption[];
  initial: SplitEditorInitial;
  action: (formData: FormData) => Promise<{ ok: boolean; error?: string } | void>;
  submitLabel: string;
  cancelHref: string;
  groupId?: number | null;
  payerName?: string;
}) {
  const [amount, setAmount] = useState(initial.amount);
  const [currency, setCurrency] = useState(initial.currency);
  const [sourceId, setSourceId] = useState<number | "">(initial.sourceId);
  const [categoryId, setCategoryId] = useState<number | "">(initial.categoryId);
  const [occurredAt, setOccurredAt] = useState(initial.occurredAt);
  const [description, setDescription] = useState(initial.description);
  const [notes, setNotes] = useState(initial.notes);
  const [splitType, setSplitType] = useState(initial.splitType);
  const [included, setIncluded] = useState<Record<string, boolean>>(
    Object.fromEntries(initial.defaultParticipants.map((p) => [p.userId, true]))
  );
  const [exactInputs, setExactInputs] = useState<Record<string, string>>({});
  const [percentInputs, setPercentInputs] = useState<Record<string, string>>({});
  const [shareInputs, setShareInputs] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const amt = parseFloat(amount) || 0;
  const included_userIds = members.filter((m) => included[m.userId]).map((m) => m.userId);

  const split: Split = useMemo(() => {
    if (splitType === "equal") return { type: "equal", userIds: included_userIds };
    if (splitType === "exact") {
      return {
        type: "exact",
        entries: included_userIds.map((uid) => ({
          userId: uid,
          amount: parseFloat(exactInputs[uid] ?? "0") || 0,
        })),
      };
    }
    if (splitType === "percent") {
      return {
        type: "percent",
        entries: included_userIds.map((uid) => ({
          userId: uid,
          percent: parseFloat(percentInputs[uid] ?? "0") || 0,
        })),
      };
    }
    return {
      type: "shares",
      entries: included_userIds.map((uid) => ({
        userId: uid,
        shares: parseInt(shareInputs[uid] ?? "1", 10) || 0,
      })),
    };
  }, [splitType, included_userIds, exactInputs, percentInputs, shareInputs]);

  const preview = useMemo(() => {
    if (amt <= 0 || included_userIds.length === 0) return null;
    return computeSplit(amt, split);
  }, [amt, split, included_userIds]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (amt <= 0) {
      setError("Enter a positive amount");
      return;
    }
    if (included_userIds.length === 0) {
      setError("Pick at least one participant");
      return;
    }
    if (!preview || !preview.ok) {
      setError(preview && !preview.ok ? preview.error : "Invalid split");
      return;
    }

    // Build participants JSON in the shape the action expects
    const participantsJson = JSON.stringify(
      (() => {
        if (split.type === "equal") return split.userIds.map((userId) => ({ userId }));
        return split.entries;
      })()
    );

    const data = new FormData();
    if (groupId) data.set("groupId", String(groupId));
    data.set("sourceId", String(sourceId));
    data.set("categoryId", categoryId === "" ? "" : String(categoryId));
    data.set("amount", String(amt));
    data.set("currency", currency);
    data.set("occurredAt", occurredAt);
    data.set("description", description);
    data.set("notes", notes);
    data.set("splitType", splitType);
    data.set("participants", participantsJson);

    startTransition(async () => {
      const r = await action(data);
      if (r && "ok" in r && !r.ok) {
        setError(r.error ?? "Save failed");
        toast.error(r.error ?? "Save failed");
      }
    });
  }

  const previewByUser: Record<string, number> = {};
  if (preview && preview.ok) {
    for (const s of preview.shares) previewByUser[s.userId] = s.shareAmount;
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {payerName && (
        <p className="text-xs text-ink-soft">
          Paid by <strong className="font-medium text-ink">{payerName}</strong>
        </p>
      )}

      <div className="grid grid-cols-[1fr_120px] gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="amount" className="text-xs uppercase tracking-wider text-ink-soft">Amount</Label>
          <Input
            id="amount"
            name="amount"
            type="number"
            step="0.01"
            min="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
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
            className="uppercase"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="sourceId" className="text-xs uppercase tracking-wider text-ink-soft">Paid from</Label>
          <select
            id="sourceId"
            name="sourceId"
            value={sourceId === "" ? "" : String(sourceId)}
            onChange={(e) => setSourceId(e.target.value ? Number(e.target.value) : "")}
            required
            className="flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
          >
            <option value="" disabled>Pick…</option>
            {sources.map((s) => (
              <option key={s.id} value={s.id}>{s.name} ({s.currency})</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="categoryId" className="text-xs uppercase tracking-wider text-ink-soft">
            Category <span className="normal-case text-ink-soft/70">· optional</span>
          </Label>
          <select
            id="categoryId"
            name="categoryId"
            value={categoryId === "" ? "" : String(categoryId)}
            onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : "")}
            className="flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
          >
            <option value="">— none —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="occurredAt" className="text-xs uppercase tracking-wider text-ink-soft">Date</Label>
        <Input id="occurredAt" type="date" value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)} required />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description" className="text-xs uppercase tracking-wider text-ink-soft">Description</Label>
        <Input
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What was it for?"
          maxLength={255}
        />
      </div>

      {/* Split type tabs */}
      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-wider text-ink-soft">Split</Label>
        <div className="grid grid-cols-4 gap-1 rounded-xl bg-ink/5 p-1">
          {TYPES.map((t) => (
            <button
              type="button"
              key={t.value}
              onClick={() => setSplitType(t.value)}
              className={cn(
                "rounded-lg py-1.5 text-xs font-medium transition-colors",
                splitType === t.value ? "bg-card shadow-sm" : "text-ink-soft hover:text-ink"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Participants list */}
      <div className="rounded-2xl bg-cream-soft p-3 space-y-2">
        {members.map((m) => {
          const isIncluded = !!included[m.userId];
          const share = previewByUser[m.userId];
          return (
            <div key={m.userId} className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={isIncluded}
                onChange={(e) =>
                  setIncluded((prev) => ({ ...prev, [m.userId]: e.target.checked }))
                }
                className="size-4 accent-coral"
              />
              <span className="flex-1 text-sm font-medium truncate">{m.name}</span>
              {isIncluded && splitType === "exact" && (
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={exactInputs[m.userId] ?? ""}
                  onChange={(e) =>
                    setExactInputs((prev) => ({ ...prev, [m.userId]: e.target.value }))
                  }
                  placeholder="0.00"
                  className="h-8 w-24 rounded-md border border-input bg-card px-2 text-sm"
                />
              )}
              {isIncluded && splitType === "percent" && (
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={percentInputs[m.userId] ?? ""}
                  onChange={(e) =>
                    setPercentInputs((prev) => ({ ...prev, [m.userId]: e.target.value }))
                  }
                  placeholder="0"
                  className="h-8 w-20 rounded-md border border-input bg-card px-2 text-sm"
                />
              )}
              {isIncluded && splitType === "shares" && (
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={shareInputs[m.userId] ?? "1"}
                  onChange={(e) =>
                    setShareInputs((prev) => ({ ...prev, [m.userId]: e.target.value }))
                  }
                  placeholder="1"
                  className="h-8 w-16 rounded-md border border-input bg-card px-2 text-sm"
                />
              )}
              {isIncluded && (
                <span
                  className={cn(
                    "text-xs tabular-nums w-20 text-right",
                    share == null ? "text-ink-soft/60" : "text-ink-soft"
                  )}
                >
                  {share == null ? "—" : share.toFixed(2)}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {preview && !preview.ok && (
        <p className="text-sm text-coral">{preview.error}</p>
      )}
      {preview && preview.ok && (
        <p className="text-xs text-ink-soft">
          Total split: {currency} {preview.shares.reduce((s, sh) => s + sh.shareAmount, 0).toFixed(2)}{" "}
          across {preview.shares.length} {preview.shares.length === 1 ? "person" : "people"}
        </p>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="notes" className="text-xs uppercase tracking-wider text-ink-soft">
          Notes <span className="normal-case text-ink-soft/70">· optional</span>
        </Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          maxLength={2000}
        />
      </div>

      {error && <p className="text-sm text-coral">{error}</p>}
      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : submitLabel}</Button>
        <ButtonLink href={cancelHref} variant="outline">Cancel</ButtonLink>
      </div>
    </form>
  );
}
