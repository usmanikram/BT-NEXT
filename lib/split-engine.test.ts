import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeSplit, assertSharesSumToTotal } from "./split-engine";

function sumShares(shares: Array<{ shareAmount: number }>): number {
  return Math.round(shares.reduce((s, sh) => s + sh.shareAmount * 100, 0)) / 100;
}

describe("computeSplit · EQUAL", () => {
  it("splits 100 across 4 users exactly into 25 each", () => {
    const r = computeSplit(100, { type: "equal", userIds: ["a", "b", "c", "d"] });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.deepEqual(r.shares.map((s) => s.shareAmount), [25, 25, 25, 25]);
    assert.equal(sumShares(r.shares), 100);
  });

  it("splits 100 across 3 users with remainder (33.34/33.33/33.33)", () => {
    const r = computeSplit(100, { type: "equal", userIds: ["a", "b", "c"] });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    // sorted-userId tie-break: a gets the extra cent → 33.34, b/c → 33.33
    assert.deepEqual(r.shares.map((s) => s.shareAmount), [33.34, 33.33, 33.33]);
    assert.equal(sumShares(r.shares), 100);
  });

  it("splits 0.01 across 2 users (0.01/0.00) — never loses a cent", () => {
    const r = computeSplit(0.01, { type: "equal", userIds: ["a", "b"] });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(sumShares(r.shares), 0.01);
    assert.deepEqual(r.shares.map((s) => s.shareAmount), [0.01, 0]);
  });

  it("is deterministic — same input → same output", () => {
    const a = computeSplit(100, { type: "equal", userIds: ["x", "y", "z"] });
    const b = computeSplit(100, { type: "equal", userIds: ["x", "y", "z"] });
    assert.deepEqual(a, b);
  });

  it("rejects empty participants", () => {
    const r = computeSplit(100, { type: "equal", userIds: [] });
    assert.equal(r.ok, false);
  });
});

describe("computeSplit · EXACT", () => {
  it("accepts shares that sum to the total", () => {
    const r = computeSplit(100, {
      type: "exact",
      entries: [
        { userId: "a", amount: 70 },
        { userId: "b", amount: 30 },
      ],
    });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(sumShares(r.shares), 100);
  });

  it("rejects shares that don't sum to the total", () => {
    const r = computeSplit(100, {
      type: "exact",
      entries: [
        { userId: "a", amount: 70 },
        { userId: "b", amount: 25 },
      ],
    });
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.match(r.error, /5\.00/); // diff = 5
  });
});

describe("computeSplit · PERCENT", () => {
  it("splits 100 by 50/50", () => {
    const r = computeSplit(100, {
      type: "percent",
      entries: [
        { userId: "a", percent: 50 },
        { userId: "b", percent: 50 },
      ],
    });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.deepEqual(r.shares.map((s) => s.shareAmount), [50, 50]);
  });

  it("splits 100 by 60/30/10 with remainder distribution", () => {
    const r = computeSplit(100, {
      type: "percent",
      entries: [
        { userId: "a", percent: 60 },
        { userId: "b", percent: 30 },
        { userId: "c", percent: 10 },
      ],
    });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(sumShares(r.shares), 100);
  });

  it("splits 100 across 3 equal thirds 33.33/33.33/33.34", () => {
    const r = computeSplit(100, {
      type: "percent",
      entries: [
        { userId: "a", percent: 33.33 },
        { userId: "b", percent: 33.33 },
        { userId: "c", percent: 33.34 },
      ],
    });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(sumShares(r.shares), 100);
  });

  it("rejects percentages that don't sum to 100", () => {
    const r = computeSplit(100, {
      type: "percent",
      entries: [
        { userId: "a", percent: 50 },
        { userId: "b", percent: 30 },
      ],
    });
    assert.equal(r.ok, false);
  });
});

describe("computeSplit · SHARES", () => {
  it("splits 100 by 1/1/2 shares → 25/25/50", () => {
    const r = computeSplit(100, {
      type: "shares",
      entries: [
        { userId: "a", shares: 1 },
        { userId: "b", shares: 1 },
        { userId: "c", shares: 2 },
      ],
    });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.deepEqual(r.shares.map((s) => s.shareAmount), [25, 25, 50]);
  });

  it("splits 100 by 1/1/1 (same as EQUAL of 3)", () => {
    const r = computeSplit(100, {
      type: "shares",
      entries: [
        { userId: "a", shares: 1 },
        { userId: "b", shares: 1 },
        { userId: "c", shares: 1 },
      ],
    });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(sumShares(r.shares), 100);
  });

  it("rejects negative or non-integer share counts", () => {
    const r = computeSplit(100, {
      type: "shares",
      entries: [
        { userId: "a", shares: 1.5 },
        { userId: "b", shares: 1 },
      ],
    });
    assert.equal(r.ok, false);
  });
});

describe("computeSplit · invariants across many cases", () => {
  const totals = [0.01, 0.99, 1, 9.99, 100, 1234.56, 99999.99];
  const sizes = [1, 2, 3, 4, 5, 6, 7];

  it("EQUAL: sum(shares) === total for every combination", () => {
    for (const total of totals) {
      for (const n of sizes) {
        const userIds = Array.from({ length: n }, (_, i) => `user${i}`);
        const r = computeSplit(total, { type: "equal", userIds });
        assert.equal(r.ok, true, `failed for total=${total} n=${n}`);
        if (!r.ok) continue;
        assert.equal(sumShares(r.shares), total, `mismatch for total=${total} n=${n}`);
      }
    }
  });

  it("PERCENT (equal pcts): sum(shares) === total", () => {
    for (const total of totals) {
      for (const n of sizes) {
        const pct = 100 / n;
        // Adjust last entry so the sum is exactly 100 (avoid 33.33+33.33+33.33 = 99.99)
        const entries = Array.from({ length: n }, (_, i) => ({
          userId: `user${i}`,
          percent: i === n - 1 ? 100 - pct * (n - 1) : pct,
        }));
        const r = computeSplit(total, { type: "percent", entries });
        assert.equal(r.ok, true, `failed for total=${total} n=${n}`);
        if (!r.ok) continue;
        assert.equal(sumShares(r.shares), total, `mismatch for total=${total} n=${n}`);
      }
    }
  });
});

describe("assertSharesSumToTotal", () => {
  it("passes when shares sum to total", () => {
    assert.doesNotThrow(() =>
      assertSharesSumToTotal(100, [
        { userId: "a", shareAmount: 60, shareInput: null },
        { userId: "b", shareAmount: 40, shareInput: null },
      ])
    );
  });

  it("throws when shares lose a cent", () => {
    assert.throws(() =>
      assertSharesSumToTotal(100, [
        { userId: "a", shareAmount: 60, shareInput: null },
        { userId: "b", shareAmount: 39.99, shareInput: null },
      ])
    );
  });
});
