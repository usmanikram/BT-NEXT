import { and, desc, eq, isNull, inArray, or } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  friendships,
  users,
  transactions,
  expenseParticipants,
  settlements,
  categoriesV2,
} from "@/db/schema";
import { computeBalances, netBalances } from "@/lib/balance-engine";

export type FriendWithBalance = {
  friendUserId: string;
  email: string;
  fullName: string | null;
  /** Balance per currency. Negative = you owe them; positive = they owe you. */
  balanceByCurrency: Record<string, number>;
};

/** Friendships are stored canonically with userAId < userBId. This helper normalizes. */
export function canonicalPair(a: string, b: string): { lo: string; hi: string } {
  return a < b ? { lo: a, hi: b } : { lo: b, hi: a };
}

export async function listFriends(userId: string): Promise<FriendWithBalance[]> {
  const rows = await db
    .select({
      id: friendships.id,
      userAId: friendships.userAId,
      userBId: friendships.userBId,
    })
    .from(friendships)
    .where(or(eq(friendships.userAId, userId), eq(friendships.userBId, userId)));

  if (rows.length === 0) return [];

  // For each friendship, the "other" user id is the one that isn't `userId`.
  const friendIds = rows.map((r) => (r.userAId === userId ? r.userBId : r.userAId));
  const friendRows = await db
    .select({ id: users.id, email: users.email, fullName: users.fullName })
    .from(users)
    .where(inArray(users.id, friendIds));
  const friendInfo = new Map(friendRows.map((u) => [u.id, u]));

  const out: FriendWithBalance[] = [];
  for (const friendId of friendIds) {
    const meta = friendInfo.get(friendId);
    const balance = await getFriendBalances(userId, friendId);
    out.push({
      friendUserId: friendId,
      email: meta?.email ?? "(unknown)",
      fullName: meta?.fullName ?? null,
      balanceByCurrency: balance,
    });
  }
  return out;
}

/** Non-group shared expenses + non-group settlements between exactly userId and friendId. */
export async function getFriendBalances(
  userId: string,
  friendId: string
): Promise<Record<string, number>> {
  // Non-group shared expenses that have both as participants and one as payer.
  // Strategy: find all transactions where groupId IS NULL AND kind='expense' AND (payer = userId OR friendId)
  // AND both userIds appear in expense_participants.
  const txns = await db
    .select({
      id: transactions.id,
      payerId: transactions.userId,
      currency: transactions.currency,
    })
    .from(transactions)
    .where(
      and(
        isNull(transactions.groupId),
        eq(transactions.kind, "expense"),
        or(eq(transactions.userId, userId), eq(transactions.userId, friendId))
      )
    );

  const ids = txns.map((t) => t.id);
  const parts = ids.length
    ? await db
        .select({
          transactionId: expenseParticipants.transactionId,
          userId: expenseParticipants.userId,
          shareAmount: expenseParticipants.shareAmount,
        })
        .from(expenseParticipants)
        .where(inArray(expenseParticipants.transactionId, ids))
    : [];

  const partsByTxn = new Map<number, Array<{ userId: string; share: number }>>();
  for (const p of parts) {
    const arr = partsByTxn.get(p.transactionId) ?? [];
    arr.push({ userId: p.userId, share: parseFloat(p.shareAmount) });
    partsByTxn.set(p.transactionId, arr);
  }

  // Filter: keep only txns where BOTH userId and friendId are participants.
  const relevantTxns = txns.filter((t) => {
    const ps = partsByTxn.get(t.id) ?? [];
    const ids = new Set(ps.map((p) => p.userId));
    return ids.has(userId) && ids.has(friendId);
  });

  // Settlements: non-group, between the pair.
  const settles = await db
    .select({
      from: settlements.fromUserId,
      to: settlements.toUserId,
      amount: settlements.amount,
      currency: settlements.currency,
    })
    .from(settlements)
    .where(
      and(
        isNull(settlements.groupId),
        or(
          and(eq(settlements.fromUserId, userId), eq(settlements.toUserId, friendId)),
          and(eq(settlements.fromUserId, friendId), eq(settlements.toUserId, userId))
        )
      )
    );

  const byCurrency: Record<string, number> = {};
  const currencies = new Set([...relevantTxns.map((t) => t.currency), ...settles.map((s) => s.currency)]);
  for (const cur of currencies) {
    const exps = relevantTxns
      .filter((t) => t.currency === cur)
      .map((t) => ({ payerId: t.payerId, participants: partsByTxn.get(t.id) ?? [] }));
    const sets = settles
      .filter((s) => s.currency === cur)
      .map((s) => ({ fromUserId: s.from, toUserId: s.to, amount: parseFloat(s.amount) }));
    const pairs = computeBalances(exps, sets);
    const net = netBalances(pairs);
    const myNet = net.get(userId) ?? 0;
    if (myNet !== 0) byCurrency[cur] = myNet;
  }
  return byCurrency;
}

export type FriendExpenseRow = {
  transactionId: number;
  payerId: string;
  amount: number;
  currency: string;
  occurredAt: Date;
  description: string | null;
  categoryName: string | null;
  yourShare: number;
};

export async function listFriendExpenses(
  userId: string,
  friendId: string
): Promise<FriendExpenseRow[]> {
  // Non-group expenses where both are participants.
  const txns = await db
    .select({
      id: transactions.id,
      payerId: transactions.userId,
      amount: transactions.amount,
      currency: transactions.currency,
      occurredAt: transactions.occurredAt,
      description: transactions.description,
      categoryName: categoriesV2.name,
    })
    .from(transactions)
    .leftJoin(categoriesV2, eq(transactions.categoryId, categoriesV2.id))
    .where(
      and(
        isNull(transactions.groupId),
        eq(transactions.kind, "expense"),
        or(eq(transactions.userId, userId), eq(transactions.userId, friendId))
      )
    )
    .orderBy(desc(transactions.occurredAt));

  const ids = txns.map((t) => t.id);
  if (ids.length === 0) return [];

  const parts = await db
    .select({
      transactionId: expenseParticipants.transactionId,
      userId: expenseParticipants.userId,
      shareAmount: expenseParticipants.shareAmount,
    })
    .from(expenseParticipants)
    .where(inArray(expenseParticipants.transactionId, ids));

  const partsByTxn = new Map<number, Array<{ userId: string; share: number }>>();
  for (const p of parts) {
    const arr = partsByTxn.get(p.transactionId) ?? [];
    arr.push({ userId: p.userId, share: parseFloat(p.shareAmount) });
    partsByTxn.set(p.transactionId, arr);
  }

  return txns
    .filter((t) => {
      const ps = partsByTxn.get(t.id) ?? [];
      const ids = new Set(ps.map((p) => p.userId));
      return ids.has(userId) && ids.has(friendId);
    })
    .map((t) => {
      const ps = partsByTxn.get(t.id) ?? [];
      const yourShare = ps.find((p) => p.userId === userId)?.share ?? 0;
      return {
        transactionId: t.id,
        payerId: t.payerId,
        amount: parseFloat(t.amount),
        currency: t.currency,
        occurredAt: t.occurredAt,
        description: t.description,
        categoryName: t.categoryName,
        yourShare,
      };
    });
}

export async function areFriends(userId: string, otherId: string): Promise<boolean> {
  const { lo, hi } = canonicalPair(userId, otherId);
  const [r] = await db
    .select({ id: friendships.id })
    .from(friendships)
    .where(and(eq(friendships.userAId, lo), eq(friendships.userBId, hi)))
    .limit(1);
  return !!r;
}

export async function getFriendUser(friendId: string) {
  const [u] = await db
    .select({ id: users.id, email: users.email, fullName: users.fullName })
    .from(users)
    .where(eq(users.id, friendId))
    .limit(1);
  return u ?? null;
}
