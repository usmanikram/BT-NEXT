import { and, desc, eq, gte, ilike, lte, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { transactions, categoriesV2, sources } from "@/db/schema";

export type TransactionFilters = {
  kind?: "income" | "expense" | "transfer";
  sourceId?: number;
  categoryId?: number;
  from?: Date;
  to?: Date;
  search?: string;
  currency?: string;
  page?: number;
  perPage?: number;
};

export type TransactionRow = {
  id: number;
  kind: "income" | "expense" | "transfer";
  amount: string;
  currency: string;
  occurredAt: Date;
  description: string | null;
  notes: string | null;
  attachmentUrl: string | null;
  sourceId: number;
  sourceName: string;
  sourceColor: string;
  sourceType: string;
  destSourceId: number | null;
  destSourceName: string | null;
  categoryId: number | null;
  categoryName: string | null;
  categoryColor: string | null;
};

function buildWhere(userId: string, f: TransactionFilters): SQL {
  const clauses: SQL[] = [eq(transactions.userId, userId)];
  if (f.kind) clauses.push(eq(transactions.kind, f.kind));
  if (f.sourceId) {
    clauses.push(
      sql`(${transactions.sourceId} = ${f.sourceId} OR ${transactions.destSourceId} = ${f.sourceId})`
    );
  }
  if (f.categoryId) clauses.push(eq(transactions.categoryId, f.categoryId));
  if (f.from) clauses.push(gte(transactions.occurredAt, f.from));
  if (f.to) clauses.push(lte(transactions.occurredAt, f.to));
  if (f.currency) clauses.push(eq(transactions.currency, f.currency.toUpperCase()));
  if (f.search) {
    const q = `%${f.search}%`;
    clauses.push(or(ilike(transactions.description, q), ilike(transactions.notes, q))!);
  }
  return and(...clauses)!;
}

export async function listTransactions(
  userId: string,
  filters: TransactionFilters = {}
): Promise<{ rows: TransactionRow[]; total: number; page: number; perPage: number }> {
  const page = filters.page && filters.page > 0 ? filters.page : 1;
  const perPage = filters.perPage && filters.perPage > 0 ? filters.perPage : 25;

  const where = buildWhere(userId, filters);

  const destSource = db.$with("dest_src").as(
    db.select({ id: sources.id, name: sources.name }).from(sources)
  );

  const rows = await db
    .with(destSource)
    .select({
      id: transactions.id,
      kind: transactions.kind,
      amount: transactions.amount,
      currency: transactions.currency,
      occurredAt: transactions.occurredAt,
      description: transactions.description,
      notes: transactions.notes,
      attachmentUrl: transactions.attachmentUrl,
      sourceId: transactions.sourceId,
      sourceName: sources.name,
      sourceColor: sources.color,
      sourceType: sources.type,
      destSourceId: transactions.destSourceId,
      destSourceName: destSource.name,
      categoryId: transactions.categoryId,
      categoryName: categoriesV2.name,
      categoryColor: categoriesV2.color,
    })
    .from(transactions)
    .innerJoin(sources, eq(transactions.sourceId, sources.id))
    .leftJoin(destSource, eq(transactions.destSourceId, destSource.id))
    .leftJoin(categoriesV2, eq(transactions.categoryId, categoriesV2.id))
    .where(where)
    .orderBy(desc(transactions.occurredAt), desc(transactions.id))
    .limit(perPage)
    .offset((page - 1) * perPage);

  const [{ n: total }] = await db
    .select({ n: sql<number>`COUNT(*)::int` })
    .from(transactions)
    .where(where);

  return { rows: rows as TransactionRow[], total: Number(total), page, perPage };
}

export async function getTransaction(userId: string, id: number) {
  const [row] = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.userId, userId), eq(transactions.id, id)))
    .limit(1);
  return row ?? null;
}

/** Quick "most recent N" for dashboard / source detail. */
export async function getRecentTransactions(userId: string, limit = 10) {
  const { rows } = await listTransactions(userId, { perPage: limit, page: 1 });
  return rows;
}
