/**
 * Pure split engine for shared expenses.
 *
 * Given a total amount and a split spec, return each participant's share.
 *
 * **Invariant**: sum(shareAmount) === totalAmount exactly (to the currency's minor unit).
 * Remainders from rounding are distributed deterministically so re-running with the same
 * input always produces the same output.
 *
 * No DB, no React, no I/O — pure function. Unit-tested in `lib/split-engine.test.ts`.
 */

export type Split =
  | { type: "equal"; userIds: string[] }
  | { type: "exact"; entries: Array<{ userId: string; amount: number }> }
  | { type: "percent"; entries: Array<{ userId: string; percent: number }> }
  | { type: "shares"; entries: Array<{ userId: string; shares: number }> };

export type Share = {
  userId: string;
  shareAmount: number;
  /** Raw input that produced this share — useful for re-rendering the form. */
  shareInput: number | null;
};

export type SplitError = { ok: false; error: string };
export type SplitOk = { ok: true; shares: Share[] };
export type SplitResult = SplitOk | SplitError;

const round = (cents: number) => cents / 100;

/**
 * Convert a decimal amount to integer minor units (cents).
 * Uses Math.round to avoid 1.235 → 1.23 floating-point glitches.
 */
function toCents(amount: number): number {
  return Math.round(amount * 100);
}

/**
 * Distribute `extra` extra cents across `n` floors, giving +1 to the first `extra` entries
 * by the supplied priority order.
 */
function distributeRemainder(floors: number[], extra: number, priorityOrder: number[]): number[] {
  const result = [...floors];
  for (let i = 0; i < extra; i++) {
    const idx = priorityOrder[i];
    if (idx === undefined) break; // defensive — shouldn't happen if extra <= n
    result[idx] += 1;
  }
  return result;
}

export function computeSplit(totalAmount: number, input: Split): SplitResult {
  if (!isFinite(totalAmount) || totalAmount <= 0) {
    return { ok: false, error: "Amount must be positive" };
  }
  const totalCents = toCents(totalAmount);

  switch (input.type) {
    case "equal": {
      const ids = [...input.userIds];
      if (ids.length === 0) return { ok: false, error: "At least one participant required" };

      const n = ids.length;
      const base = Math.floor(totalCents / n);
      const extra = totalCents - base * n;

      // Priority: sorted by userId ascending so the assignment is deterministic.
      const order = ids.map((_, i) => i).sort((a, b) => ids[a].localeCompare(ids[b]));
      const cents = distributeRemainder(new Array(n).fill(base), extra, order);

      return {
        ok: true,
        shares: ids.map((userId, i) => ({
          userId,
          shareAmount: round(cents[i]),
          shareInput: null,
        })),
      };
    }

    case "exact": {
      const entries = input.entries;
      if (entries.length === 0) return { ok: false, error: "At least one participant required" };
      const sumCents = entries.reduce((s, e) => s + toCents(e.amount), 0);
      if (sumCents !== totalCents) {
        const diff = round(totalCents - sumCents);
        return {
          ok: false,
          error:
            diff > 0
              ? `Shares are short by ${diff.toFixed(2)} — they must sum to the total.`
              : `Shares exceed the total by ${(-diff).toFixed(2)}.`,
        };
      }
      return {
        ok: true,
        shares: entries.map((e) => ({
          userId: e.userId,
          shareAmount: round(toCents(e.amount)),
          shareInput: e.amount,
        })),
      };
    }

    case "percent": {
      const entries = input.entries;
      if (entries.length === 0) return { ok: false, error: "At least one participant required" };
      const sumPct = entries.reduce((s, e) => s + e.percent, 0);
      if (Math.abs(sumPct - 100) > 0.01) {
        return { ok: false, error: `Percentages must sum to 100 (got ${sumPct.toFixed(2)}).` };
      }

      // Floor each share in cents.
      const rawCents = entries.map((e) => (e.percent / 100) * totalCents);
      const floors = rawCents.map((r) => Math.floor(r));
      const sumFloors = floors.reduce((s, c) => s + c, 0);
      const extra = totalCents - sumFloors;

      // Priority: largest fractional remainder first, ties broken by largest percent then userId.
      const order = entries
        .map((_, i) => i)
        .sort((a, b) => {
          const fa = rawCents[a] - floors[a];
          const fb = rawCents[b] - floors[b];
          if (fb !== fa) return fb - fa;
          if (entries[b].percent !== entries[a].percent) return entries[b].percent - entries[a].percent;
          return entries[a].userId.localeCompare(entries[b].userId);
        });

      const cents = distributeRemainder(floors, extra, order);

      return {
        ok: true,
        shares: entries.map((e, i) => ({
          userId: e.userId,
          shareAmount: round(cents[i]),
          shareInput: e.percent,
        })),
      };
    }

    case "shares": {
      const entries = input.entries;
      if (entries.length === 0) return { ok: false, error: "At least one participant required" };
      const totalShares = entries.reduce((s, e) => s + e.shares, 0);
      if (totalShares <= 0) return { ok: false, error: "Total shares must be positive" };
      if (entries.some((e) => !Number.isInteger(e.shares) || e.shares < 0)) {
        return { ok: false, error: "Shares must be non-negative integers" };
      }

      const rawCents = entries.map((e) => (e.shares / totalShares) * totalCents);
      const floors = rawCents.map((r) => Math.floor(r));
      const sumFloors = floors.reduce((s, c) => s + c, 0);
      const extra = totalCents - sumFloors;

      // Priority: largest fractional remainder first, ties broken by largest share count then userId.
      const order = entries
        .map((_, i) => i)
        .sort((a, b) => {
          const fa = rawCents[a] - floors[a];
          const fb = rawCents[b] - floors[b];
          if (fb !== fa) return fb - fa;
          if (entries[b].shares !== entries[a].shares) return entries[b].shares - entries[a].shares;
          return entries[a].userId.localeCompare(entries[b].userId);
        });

      const cents = distributeRemainder(floors, extra, order);

      return {
        ok: true,
        shares: entries.map((e, i) => ({
          userId: e.userId,
          shareAmount: round(cents[i]),
          shareInput: e.shares,
        })),
      };
    }
  }
}

/**
 * Quick assertion helper used inside server actions: throws if the invariant breaks.
 * Cheap insurance against a bug in `computeSplit` silently losing cents.
 */
export function assertSharesSumToTotal(totalAmount: number, shares: Share[]): void {
  const sumCents = shares.reduce((s, sh) => s + toCents(sh.shareAmount), 0);
  if (sumCents !== toCents(totalAmount)) {
    throw new Error(
      `Split invariant violated: sum(shares)=${sumCents / 100} vs total=${totalAmount}`
    );
  }
}
