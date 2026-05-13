/**
 * Pure balance engine. Given shared expenses + settlements, returns who owes whom.
 *
 * - All amounts are in a single currency per call. Cross-currency rollup is the caller's job.
 * - "B owes A" means B should pay A. Stored as a positive number on a Pair { from: B, to: A }.
 */

export type ExpenseInput = {
  payerId: string;
  participants: Array<{ userId: string; share: number }>; // payer included
};

export type SettlementInput = {
  fromUserId: string;
  toUserId: string;
  amount: number;
};

export type Pair = { fromUserId: string; toUserId: string; amount: number };

/**
 * For each pair (X, Y), compute the net debt where X is the debtor.
 * Returns at most one row per unordered pair, in canonical (debtor, creditor) form
 * with a positive amount. Pairs that net to zero are dropped.
 */
export function computeBalances(
  expenses: ExpenseInput[],
  settlements: SettlementInput[]
): Pair[] {
  // Map keyed by "userA<userB" (sorted) → signed balance. Positive means userA owes userB.
  const ledger = new Map<string, { a: string; b: string; aOwesB: number }>();

  const keyOf = (x: string, y: string) => {
    return x < y ? `${x}<${y}` : `${y}<${x}`;
  };

  const adjust = (debtor: string, creditor: string, amount: number) => {
    if (amount === 0 || debtor === creditor) return;
    const [a, b] = debtor < creditor ? [debtor, creditor] : [creditor, debtor];
    const key = keyOf(a, b);
    const existing = ledger.get(key) ?? { a, b, aOwesB: 0 };
    // If debtor === a, then a owes b → +amount. Else a is owed by b → -amount.
    existing.aOwesB += debtor === a ? amount : -amount;
    ledger.set(key, existing);
  };

  for (const exp of expenses) {
    for (const p of exp.participants) {
      if (p.userId === exp.payerId) continue;
      // p owes payer p.share
      adjust(p.userId, exp.payerId, p.share);
    }
  }

  for (const s of settlements) {
    // from paid to. So `from` no longer owes `to` by `amount`.
    // i.e. `from owes to` reduces by amount.
    adjust(s.fromUserId, s.toUserId, -s.amount);
  }

  const pairs: Pair[] = [];
  for (const entry of ledger.values()) {
    const net = round2(entry.aOwesB);
    if (net > 0) {
      pairs.push({ fromUserId: entry.a, toUserId: entry.b, amount: net });
    } else if (net < 0) {
      pairs.push({ fromUserId: entry.b, toUserId: entry.a, amount: -net });
    }
  }
  return pairs;
}

/**
 * Per-user net: positive = owed money, negative = owes money.
 * Invariant: sum of all values === 0 (modulo rounding).
 */
export function netBalances(pairs: Pair[]): Map<string, number> {
  const net = new Map<string, number>();
  const add = (u: string, v: number) => net.set(u, round2((net.get(u) ?? 0) + v));
  for (const p of pairs) {
    add(p.fromUserId, -p.amount); // debtor's net decreases
    add(p.toUserId, p.amount); // creditor's net increases
  }
  return net;
}

/**
 * Splitwise-style greedy simplification. Returns the minimal-ish set of settlements
 * that, when applied, drives every net balance to zero.
 *
 * At most N-1 transactions for N non-zero participants.
 */
export function simplifyDebts(net: Map<string, number>): Pair[] {
  // Work copy: filter zeros, round.
  const remaining = new Map<string, number>();
  for (const [u, v] of net) {
    const r = round2(v);
    if (r !== 0) remaining.set(u, r);
  }

  const out: Pair[] = [];
  while (remaining.size > 0) {
    // Biggest creditor (most positive) and biggest debtor (most negative).
    let creditor: string | null = null;
    let debtor: string | null = null;
    let maxCredit = 0;
    let maxDebit = 0;
    for (const [u, v] of remaining) {
      if (v > maxCredit) {
        maxCredit = v;
        creditor = u;
      }
      if (v < maxDebit) {
        maxDebit = v;
        debtor = u;
      }
    }
    if (!creditor || !debtor) break;

    const amount = Math.min(maxCredit, -maxDebit);
    out.push({ fromUserId: debtor, toUserId: creditor, amount: round2(amount) });

    const newCredit = round2(maxCredit - amount);
    const newDebit = round2(maxDebit + amount);
    if (newCredit === 0) remaining.delete(creditor);
    else remaining.set(creditor, newCredit);
    if (newDebit === 0) remaining.delete(debtor);
    else remaining.set(debtor, newDebit);
  }
  return out;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
