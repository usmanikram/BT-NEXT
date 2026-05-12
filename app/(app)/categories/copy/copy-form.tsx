"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/button-link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ColorDot } from "@/components/color-dot";
import { formatMoney } from "@/lib/format";
import { CURRENCY_SYMBOL } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { copyMonthAction } from "@/actions/copy-month";
import type { CategoryBreakdownRow } from "@/lib/budget-service";

type Row = {
  categoryId: number;
  name: string;
  color: string;
  budgeted: number;
  spent: number;
  remaining: number;
  include: boolean;
  newBudget: string;
  rollover: "fresh" | "rollover";
};

export function CopyMonthForm({
  sourceMonthId,
  defaultTarget,
  categories,
}: {
  sourceMonthId: number;
  defaultTarget: string;
  categories: CategoryBreakdownRow[];
}) {
  const router = useRouter();
  const [target, setTarget] = useState(defaultTarget);
  const [rows, setRows] = useState<Row[]>(() =>
    categories.map((c) => ({
      categoryId: c.id,
      name: c.name,
      color: c.color,
      budgeted: c.budgetedAmount,
      spent: c.spent,
      remaining: c.budgetedAmount - c.spent,
      include: true,
      newBudget: c.budgetedAmount.toFixed(2),
      rollover: "fresh",
    }))
  );
  const [pending, startTransition] = useTransition();

  const allChecked = useMemo(() => rows.every((r) => r.include), [rows]);

  function update(i: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function toggleAll(v: boolean) {
    setRows((prev) => prev.map((r) => ({ ...r, include: v })));
  }

  function finalBudget(r: Row): number {
    const newB = parseFloat(r.newBudget) || 0;
    if (r.rollover === "rollover") {
      return Math.max(0, newB + r.remaining);
    }
    return newB;
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await copyMonthAction({
        sourceMonthId,
        targetYearMonth: target,
        selections: rows.map((r) => ({
          categoryId: r.categoryId,
          include: r.include,
          newBudget: parseFloat(r.newBudget) || 0,
          rollover: r.rollover,
        })),
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${result.count} ${result.count === 1 ? "category" : "categories"} copied.`);
      document.cookie = `bt_current_month=${encodeURIComponent(result.targetYearMonth)}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax`;
      router.push("/categories");
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="rounded-xl border bg-card p-5 flex flex-wrap items-end gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="target_month" className="text-xs">Target month</Label>
          <Input
            id="target_month"
            type="month"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="h-8 w-44"
            required
          />
        </div>
        <label className="ml-auto inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={allChecked}
            onChange={(e) => toggleAll(e.target.checked)}
            className="size-4 accent-foreground"
          />
          Select all
        </label>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Budgeted</TableHead>
                <TableHead className="text-right">Spent</TableHead>
                <TableHead className="text-right">Remaining</TableHead>
                <TableHead className="w-36">New budget</TableHead>
                <TableHead className="w-36">Rollover</TableHead>
                <TableHead className="text-right">Final</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r, i) => (
                <TableRow key={r.categoryId} className={cn(!r.include && "opacity-50")}>
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={r.include}
                      onChange={(e) => update(i, { include: e.target.checked })}
                      className="size-4 accent-foreground"
                    />
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-2 font-medium">
                      <ColorDot color={r.color} />
                      {r.name}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{formatMoney(r.budgeted)}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{formatMoney(r.spent)}</TableCell>
                  <TableCell
                    className={cn(
                      "text-right font-mono tabular-nums",
                      r.remaining < 0 && "text-rose-600"
                    )}
                  >
                    {formatMoney(r.remaining)}
                  </TableCell>
                  <TableCell>
                    <div className="flex">
                      <span className="inline-flex items-center rounded-l-md border border-r-0 bg-muted px-2 text-xs text-muted-foreground">
                        {CURRENCY_SYMBOL.trim()}
                      </span>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={r.newBudget}
                        onChange={(e) => update(i, { newBudget: e.target.value })}
                        className="h-8 rounded-l-none"
                      />
                    </div>
                  </TableCell>
                  <TableCell>
                    <select
                      value={r.rollover}
                      onChange={(e) => update(i, { rollover: e.target.value as Row["rollover"] })}
                      className="h-8 w-full rounded-md border bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
                    >
                      <option value="fresh">Start fresh</option>
                      <option value="rollover">Roll over unspent</option>
                    </select>
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums font-semibold">
                    {formatMoney(finalBudget(r))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          <Copy className="size-3.5" /> {pending ? "Copying…" : "Copy"}
        </Button>
        <ButtonLink href="/categories" variant="outline">
          Cancel
        </ButtonLink>
      </div>
    </form>
  );
}
