import { and, asc, desc, eq, isNull, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  groups,
  groupMembers,
  users,
  transactions,
  expenseParticipants,
  settlements,
  categoriesV2,
} from "@/db/schema";
import { computeBalances, netBalances, simplifyDebts, type Pair } from "@/lib/balance-engine";

export type GroupWithMeta = {
  id: number;
  name: string;
  description: string | null;
  defaultCurrency: string;
  simplifyDebts: boolean;
  archivedAt: Date | null;
  memberCount: number;
  /** Net balance for the viewing user in the group's default currency. */
  netBalance: number;
};

export async function listGroups(userId: string, includeArchived = false): Promise<GroupWithMeta[]> {
  // Groups the user is an active member of.
  const memberships = await db
    .select({ groupId: groupMembers.groupId })
    .from(groupMembers)
    .where(and(eq(groupMembers.userId, userId), isNull(groupMembers.leftAt)));
  if (memberships.length === 0) return [];

  const groupIds = memberships.map((m) => m.groupId);
  const rows = await db
    .select()
    .from(groups)
    .where(
      includeArchived
        ? inArray(groups.id, groupIds)
        : and(inArray(groups.id, groupIds), isNull(groups.archivedAt))
    )
    .orderBy(desc(groups.createdAt));

  const out: GroupWithMeta[] = [];
  for (const g of rows) {
    const memberCount = await db
      .select({ n: sql<number>`COUNT(*)::int` })
      .from(groupMembers)
      .where(and(eq(groupMembers.groupId, g.id), isNull(groupMembers.leftAt)))
      .then((r) => r[0]?.n ?? 0);

    const { net } = await computeGroupNetForUser(g.id, userId, g.defaultCurrency);
    out.push({
      id: g.id,
      name: g.name,
      description: g.description,
      defaultCurrency: g.defaultCurrency,
      simplifyDebts: g.simplifyDebts,
      archivedAt: g.archivedAt,
      memberCount: Number(memberCount),
      netBalance: net,
    });
  }
  return out;
}

export async function getGroup(userId: string, groupId: number) {
  const [g] = await db.select().from(groups).where(eq(groups.id, groupId)).limit(1);
  if (!g) return null;
  const [m] = await db
    .select()
    .from(groupMembers)
    .where(
      and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId), isNull(groupMembers.leftAt))
    )
    .limit(1);
  if (!m) return null;
  return g;
}

export type Member = {
  userId: string;
  email: string;
  fullName: string | null;
  joinedAt: Date;
  leftAt: Date | null;
};

export async function listGroupMembers(groupId: number, includeLeft = false): Promise<Member[]> {
  const rows = await db
    .select({
      userId: groupMembers.userId,
      email: users.email,
      fullName: users.fullName,
      joinedAt: groupMembers.joinedAt,
      leftAt: groupMembers.leftAt,
    })
    .from(groupMembers)
    .innerJoin(users, eq(groupMembers.userId, users.id))
    .where(
      includeLeft ? eq(groupMembers.groupId, groupId) : and(eq(groupMembers.groupId, groupId), isNull(groupMembers.leftAt))
    )
    .orderBy(asc(groupMembers.joinedAt));
  return rows;
}

export type GroupExpense = {
  transactionId: number;
  payerId: string;
  payerName: string | null;
  payerEmail: string;
  amount: number;
  currency: string;
  occurredAt: Date;
  description: string | null;
  categoryName: string | null;
  splitType: string | null;
  participants: Array<{ userId: string; shareAmount: number; name: string | null; email: string }>;
};

export async function listGroupExpenses(groupId: number): Promise<GroupExpense[]> {
  const txns = await db
    .select({
      id: transactions.id,
      payerId: transactions.userId,
      payerEmail: users.email,
      payerName: users.fullName,
      amount: transactions.amount,
      currency: transactions.currency,
      occurredAt: transactions.occurredAt,
      description: transactions.description,
      splitType: transactions.splitType,
      categoryName: categoriesV2.name,
    })
    .from(transactions)
    .innerJoin(users, eq(transactions.userId, users.id))
    .leftJoin(categoriesV2, eq(transactions.categoryId, categoriesV2.id))
    .where(and(eq(transactions.groupId, groupId), eq(transactions.kind, "expense")))
    .orderBy(desc(transactions.occurredAt), desc(transactions.id));

  if (txns.length === 0) return [];

  const txnIds = txns.map((t) => t.id);
  const parts = await db
    .select({
      transactionId: expenseParticipants.transactionId,
      userId: expenseParticipants.userId,
      shareAmount: expenseParticipants.shareAmount,
      email: users.email,
      fullName: users.fullName,
    })
    .from(expenseParticipants)
    .innerJoin(users, eq(expenseParticipants.userId, users.id))
    .where(inArray(expenseParticipants.transactionId, txnIds));

  const partsByTxn = new Map<number, GroupExpense["participants"]>();
  for (const p of parts) {
    const arr = partsByTxn.get(p.transactionId) ?? [];
    arr.push({
      userId: p.userId,
      shareAmount: parseFloat(p.shareAmount),
      email: p.email,
      name: p.fullName,
    });
    partsByTxn.set(p.transactionId, arr);
  }

  return txns.map((t) => ({
    transactionId: t.id,
    payerId: t.payerId,
    payerEmail: t.payerEmail,
    payerName: t.payerName,
    amount: parseFloat(t.amount),
    currency: t.currency,
    occurredAt: t.occurredAt,
    description: t.description,
    categoryName: t.categoryName,
    splitType: t.splitType,
    participants: partsByTxn.get(t.id) ?? [],
  }));
}

async function computeGroupNetForUser(
  groupId: number,
  userId: string,
  currency: string
): Promise<{ net: number }> {
  // Load expenses + settlements scoped to this group + currency.
  const expenseRows = await db
    .select({ id: transactions.id, payerId: transactions.userId, amount: transactions.amount })
    .from(transactions)
    .where(
      and(
        eq(transactions.groupId, groupId),
        eq(transactions.kind, "expense"),
        eq(transactions.currency, currency)
      )
    );
  if (expenseRows.length === 0) {
    const settled = await db
      .select({
        from: settlements.fromUserId,
        to: settlements.toUserId,
        amount: settlements.amount,
      })
      .from(settlements)
      .where(and(eq(settlements.groupId, groupId), eq(settlements.currency, currency)));
    if (settled.length === 0) return { net: 0 };
  }

  const ids = expenseRows.map((e) => e.id);
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

  const settled = await db
    .select({
      from: settlements.fromUserId,
      to: settlements.toUserId,
      amount: settlements.amount,
    })
    .from(settlements)
    .where(and(eq(settlements.groupId, groupId), eq(settlements.currency, currency)));

  const pairs = computeBalances(
    expenseRows.map((e) => ({
      payerId: e.payerId,
      participants: partsByTxn.get(e.id) ?? [],
    })),
    settled.map((s) => ({
      fromUserId: s.from,
      toUserId: s.to,
      amount: parseFloat(s.amount),
    }))
  );
  const net = netBalances(pairs);
  return { net: net.get(userId) ?? 0 };
}

export type GroupBalanceView = {
  currency: string;
  pairs: Pair[]; // raw (debtor → creditor)
  simplified: Pair[];
  netByUser: Array<{ userId: string; email: string; fullName: string | null; net: number }>;
};

/**
 * Per-currency balance view for the group. Uses the engines from balance-engine.ts.
 * Returns one entry per currency that has any data.
 */
export async function getGroupBalances(groupId: number): Promise<GroupBalanceView[]> {
  const [g] = await db.select().from(groups).where(eq(groups.id, groupId)).limit(1);
  if (!g) return [];

  const members = await listGroupMembers(groupId, true);
  const memberInfo = new Map(members.map((m) => [m.userId, m]));

  // All expenses in the group (any currency).
  const expenseRows = await db
    .select({
      id: transactions.id,
      payerId: transactions.userId,
      currency: transactions.currency,
    })
    .from(transactions)
    .where(and(eq(transactions.groupId, groupId), eq(transactions.kind, "expense")));

  const expenseIds = expenseRows.map((e) => e.id);
  const parts = expenseIds.length
    ? await db
        .select({
          transactionId: expenseParticipants.transactionId,
          userId: expenseParticipants.userId,
          shareAmount: expenseParticipants.shareAmount,
        })
        .from(expenseParticipants)
        .where(inArray(expenseParticipants.transactionId, expenseIds))
    : [];

  const partsByTxn = new Map<number, Array<{ userId: string; share: number }>>();
  for (const p of parts) {
    const arr = partsByTxn.get(p.transactionId) ?? [];
    arr.push({ userId: p.userId, share: parseFloat(p.shareAmount) });
    partsByTxn.set(p.transactionId, arr);
  }

  const settleRows = await db
    .select({
      from: settlements.fromUserId,
      to: settlements.toUserId,
      amount: settlements.amount,
      currency: settlements.currency,
    })
    .from(settlements)
    .where(eq(settlements.groupId, groupId));

  // Group by currency.
  const currencies = new Set<string>([
    ...expenseRows.map((e) => e.currency),
    ...settleRows.map((s) => s.currency),
  ]);

  const out: GroupBalanceView[] = [];
  for (const cur of currencies) {
    const exps = expenseRows
      .filter((e) => e.currency === cur)
      .map((e) => ({
        payerId: e.payerId,
        participants: partsByTxn.get(e.id) ?? [],
      }));
    const sets = settleRows
      .filter((s) => s.currency === cur)
      .map((s) => ({
        fromUserId: s.from,
        toUserId: s.to,
        amount: parseFloat(s.amount),
      }));
    const pairs = computeBalances(exps, sets);
    const net = netBalances(pairs);
    const simplified = simplifyDebts(net);

    const netByUser = Array.from(net.entries()).map(([userId, value]) => {
      const m = memberInfo.get(userId);
      return {
        userId,
        email: m?.email ?? "(unknown)",
        fullName: m?.fullName ?? null,
        net: value,
      };
    });

    out.push({ currency: cur, pairs, simplified, netByUser });
  }
  return out;
}

/**
 * Guard for any group-scoped read/write — confirms the user is an active member.
 * Returns true if member, false otherwise (caller decides whether to redirect or throw).
 */
export async function isGroupMember(userId: string, groupId: number): Promise<boolean> {
  const [m] = await db
    .select({ id: groupMembers.id })
    .from(groupMembers)
    .where(
      and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId), isNull(groupMembers.leftAt))
    )
    .limit(1);
  return !!m;
}
