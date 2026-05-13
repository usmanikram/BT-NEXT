import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeBalances, netBalances, simplifyDebts } from "./balance-engine";

describe("computeBalances", () => {
  it("A pays 100 for self+B+C equal → B and C each owe A 33.33+", () => {
    const pairs = computeBalances(
      [
        {
          payerId: "A",
          participants: [
            { userId: "A", share: 33.34 },
            { userId: "B", share: 33.33 },
            { userId: "C", share: 33.33 },
          ],
        },
      ],
      []
    );
    const ba = pairs.find((p) => p.fromUserId === "B")!;
    const ca = pairs.find((p) => p.fromUserId === "C")!;
    assert.equal(ba.toUserId, "A");
    assert.equal(ba.amount, 33.33);
    assert.equal(ca.toUserId, "A");
    assert.equal(ca.amount, 33.33);
  });

  it("settlement reduces existing debt", () => {
    const pairs = computeBalances(
      [
        {
          payerId: "A",
          participants: [
            { userId: "A", share: 50 },
            { userId: "B", share: 50 },
          ],
        },
      ],
      [{ fromUserId: "B", toUserId: "A", amount: 30 }]
    );
    assert.equal(pairs.length, 1);
    assert.equal(pairs[0].fromUserId, "B");
    assert.equal(pairs[0].toUserId, "A");
    assert.equal(pairs[0].amount, 20);
  });

  it("over-payment flips direction", () => {
    const pairs = computeBalances(
      [
        {
          payerId: "A",
          participants: [
            { userId: "A", share: 50 },
            { userId: "B", share: 50 },
          ],
        },
      ],
      [{ fromUserId: "B", toUserId: "A", amount: 80 }]
    );
    assert.equal(pairs.length, 1);
    assert.equal(pairs[0].fromUserId, "A");
    assert.equal(pairs[0].toUserId, "B");
    assert.equal(pairs[0].amount, 30);
  });

  it("zero-net pair is dropped", () => {
    const pairs = computeBalances(
      [
        {
          payerId: "A",
          participants: [
            { userId: "A", share: 50 },
            { userId: "B", share: 50 },
          ],
        },
      ],
      [{ fromUserId: "B", toUserId: "A", amount: 50 }]
    );
    assert.equal(pairs.length, 0);
  });
});

describe("netBalances", () => {
  it("sum of all net balances === 0", () => {
    const pairs = computeBalances(
      [
        {
          payerId: "A",
          participants: [
            { userId: "A", share: 25 },
            { userId: "B", share: 25 },
            { userId: "C", share: 25 },
            { userId: "D", share: 25 },
          ],
        },
        {
          payerId: "B",
          participants: [
            { userId: "A", share: 30 },
            { userId: "B", share: 30 },
          ],
        },
      ],
      []
    );
    const net = netBalances(pairs);
    let total = 0;
    for (const v of net.values()) total += v;
    assert.equal(Math.round(total * 100) / 100, 0);
  });
});

describe("simplifyDebts", () => {
  it("triangle A→B 10, B→C 10, C→A 10 simplifies to zero settlements", () => {
    const pairs: Array<{ fromUserId: string; toUserId: string; amount: number }> = [
      { fromUserId: "A", toUserId: "B", amount: 10 },
      { fromUserId: "B", toUserId: "C", amount: 10 },
      { fromUserId: "C", toUserId: "A", amount: 10 },
    ];
    const net = netBalances(pairs);
    const simplified = simplifyDebts(net);
    assert.equal(simplified.length, 0);
  });

  it("applying simplified settlements zeros out all balances", () => {
    const pairs: Array<{ fromUserId: string; toUserId: string; amount: number }> = [
      { fromUserId: "A", toUserId: "B", amount: 30 },
      { fromUserId: "A", toUserId: "C", amount: 20 },
      { fromUserId: "B", toUserId: "C", amount: 10 },
    ];
    const net = netBalances(pairs);
    const simplified = simplifyDebts(net);
    // Apply simplified, recompute net, expect all zero.
    const after = new Map(net);
    for (const s of simplified) {
      after.set(s.fromUserId, Math.round(((after.get(s.fromUserId) ?? 0) + s.amount) * 100) / 100);
      after.set(s.toUserId, Math.round(((after.get(s.toUserId) ?? 0) - s.amount) * 100) / 100);
    }
    for (const v of after.values()) assert.equal(v, 0);
  });

  it("at most N-1 settlements for N non-zero members", () => {
    const net = new Map([
      ["A", -50],
      ["B", -30],
      ["C", 60],
      ["D", 20],
    ]);
    const out = simplifyDebts(net);
    assert.ok(out.length <= 3);
  });
});
