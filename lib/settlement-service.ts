import { listGroups, getGroupBalances } from "@/lib/group-service";
import { listFriends } from "@/lib/friend-service";

export type OverallEntry = {
  counterpartyId: string;
  name: string;
  email: string;
  source: "group" | "friend";
  context: string; // e.g. group name, or "1-to-1"
  contextId: number | null; // group id, or null
  currency: string;
  /** Positive: counterparty owes the user. Negative: user owes counterparty. */
  amount: number;
};

/**
 * Flat list of every non-zero balance the user has, across all groups and friend relationships,
 * keyed by counterparty + currency. Two entries with the same counterparty but different
 * currencies stay separate (no FX rollup per spec).
 */
export async function getOverallBalances(userId: string): Promise<OverallEntry[]> {
  const out: OverallEntry[] = [];

  // Groups: walk each active group, take the simplified balance from the user's POV.
  const groups = await listGroups(userId, false);
  for (const g of groups) {
    const balanceViews = await getGroupBalances(g.id);
    for (const bv of balanceViews) {
      const list = g.simplifyDebts ? bv.simplified : bv.pairs;
      // We want pair entries that touch the user.
      for (const p of list) {
        if (p.fromUserId === userId) {
          const meta = bv.netByUser.find((n) => n.userId === p.toUserId);
          if (!meta) continue;
          out.push({
            counterpartyId: p.toUserId,
            name: meta.fullName ?? meta.email.split("@")[0],
            email: meta.email,
            source: "group",
            context: g.name,
            contextId: g.id,
            currency: bv.currency,
            amount: -p.amount, // user owes
          });
        } else if (p.toUserId === userId) {
          const meta = bv.netByUser.find((n) => n.userId === p.fromUserId);
          if (!meta) continue;
          out.push({
            counterpartyId: p.fromUserId,
            name: meta.fullName ?? meta.email.split("@")[0],
            email: meta.email,
            source: "group",
            context: g.name,
            contextId: g.id,
            currency: bv.currency,
            amount: p.amount, // owed to user
          });
        }
      }
    }
  }

  // Friends
  const friends = await listFriends(userId);
  for (const f of friends) {
    for (const [cur, amt] of Object.entries(f.balanceByCurrency)) {
      out.push({
        counterpartyId: f.friendUserId,
        name: f.fullName ?? f.email.split("@")[0],
        email: f.email,
        source: "friend",
        context: "1-to-1",
        contextId: null,
        currency: cur,
        amount: amt,
      });
    }
  }

  return out;
}

/**
 * Totals per currency: how much you're owed and how much you owe, summed across everyone.
 */
export function summarizeBalances(entries: OverallEntry[]) {
  const totals: Record<string, { owed: number; owe: number }> = {};
  for (const e of entries) {
    const bucket = totals[e.currency] ?? { owed: 0, owe: 0 };
    if (e.amount > 0) bucket.owed += e.amount;
    else bucket.owe += -e.amount;
    totals[e.currency] = bucket;
  }
  return totals;
}
