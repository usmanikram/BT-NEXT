import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { sources, transactions } from "@/db/schema";

export type SourceWithBalance = {
  id: number;
  name: string;
  type: string;
  currency: string;
  openingBalance: string;
  icon: string | null;
  color: string;
  archived: boolean;
  createdAt: Date;
  balance: number;
};

/**
 * Net = opening_balance
 *     + sum(income where source = X)
 *     + sum(transfer where dest_source = X)
 *     - sum(expense where source = X)
 *     - sum(transfer where source = X)
 *
 * The `transactions.user_id = sources.user_id` clause is defensive: validateRefs in the
 * action layer should already guarantee that any transaction referencing a source is
 * owned by the same user. Without this clause, any data-integrity drift (bad migration,
 * direct SQL, future feature) silently leaks balances across users.
 */
const balanceDelta = sql<string>`
  COALESCE((
    SELECT SUM(CASE
      WHEN ${transactions.kind} = 'income'   AND ${transactions.sourceId}     = ${sources.id} THEN ${transactions.amount}
      WHEN ${transactions.kind} = 'transfer' AND ${transactions.destSourceId} = ${sources.id} THEN ${transactions.amount}
      WHEN ${transactions.kind} = 'expense'  AND ${transactions.sourceId}     = ${sources.id} THEN -${transactions.amount}
      WHEN ${transactions.kind} = 'transfer' AND ${transactions.sourceId}     = ${sources.id} THEN -${transactions.amount}
      ELSE 0
    END)
    FROM ${transactions}
    WHERE (${transactions.sourceId} = ${sources.id} OR ${transactions.destSourceId} = ${sources.id})
      AND ${transactions.userId} = ${sources.userId}
  ), 0)
`;

export async function listSources(userId: string, includeArchived = false): Promise<SourceWithBalance[]> {
  const where = includeArchived
    ? eq(sources.userId, userId)
    : and(eq(sources.userId, userId), eq(sources.archived, false));

  const rows = await db
    .select({
      id: sources.id,
      name: sources.name,
      type: sources.type,
      currency: sources.currency,
      openingBalance: sources.openingBalance,
      icon: sources.icon,
      color: sources.color,
      archived: sources.archived,
      createdAt: sources.createdAt,
      delta: balanceDelta,
    })
    .from(sources)
    .where(where)
    .orderBy(asc(sources.archived), asc(sources.createdAt));

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    type: r.type,
    currency: r.currency,
    openingBalance: r.openingBalance,
    icon: r.icon,
    color: r.color,
    archived: r.archived,
    createdAt: r.createdAt,
    balance: parseFloat(r.openingBalance) + parseFloat(r.delta || "0"),
  }));
}

export async function getSource(userId: string, id: number): Promise<SourceWithBalance | null> {
  const [r] = await db
    .select({
      id: sources.id,
      name: sources.name,
      type: sources.type,
      currency: sources.currency,
      openingBalance: sources.openingBalance,
      icon: sources.icon,
      color: sources.color,
      archived: sources.archived,
      createdAt: sources.createdAt,
      delta: balanceDelta,
    })
    .from(sources)
    .where(and(eq(sources.userId, userId), eq(sources.id, id)))
    .limit(1);
  if (!r) return null;
  return {
    id: r.id,
    name: r.name,
    type: r.type,
    currency: r.currency,
    openingBalance: r.openingBalance,
    icon: r.icon,
    color: r.color,
    archived: r.archived,
    createdAt: r.createdAt,
    balance: parseFloat(r.openingBalance) + parseFloat(r.delta || "0"),
  };
}

/** Used by transaction service to refuse deletes that would orphan history. */
export async function sourceHasTransactions(userId: string, sourceId: number): Promise<boolean> {
  const [{ n }] = await db
    .select({ n: sql<number>`COUNT(*)::int` })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        sql`(${transactions.sourceId} = ${sourceId} OR ${transactions.destSourceId} = ${sourceId})`
      )
    );
  return Number(n) > 0;
}

/**
 * Auto-create a default Wallet source if the user has none. Called from pages that need
 * at least one source to function (e.g. first-time signup landing on the dashboard).
 */
export async function ensureDefaultSource(userId: string, currency = "PKR"): Promise<void> {
  const [{ n }] = await db
    .select({ n: sql<number>`COUNT(*)::int` })
    .from(sources)
    .where(eq(sources.userId, userId));
  if (Number(n) > 0) return;
  await db.insert(sources).values({
    userId,
    name: "Wallet",
    type: "wallet",
    currency,
    openingBalance: "0",
    color: "#7BCFA9",
  });
}
