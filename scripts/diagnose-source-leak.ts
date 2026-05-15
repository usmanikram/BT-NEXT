/**
 * Read-only diagnostic. Finds transactions whose user_id does not match the user_id
 * of the source they reference (or the dest_source for transfers). These are the rows
 * that were causing source balances to leak between users before the source-service
 * query was hardened.
 *
 * Run: npm run diagnose:source-leak
 * Or:  npx tsx --env-file=.env.local scripts/diagnose-source-leak.ts
 */
import { sql as drizzleSql } from "drizzle-orm";
import { db } from "@/lib/db";

async function main() {
  console.log("─".repeat(72));
  console.log("Source-balance leak diagnostic");
  console.log("─".repeat(72));

  const mismatchedSourceRes = await db.execute<{
    txn_id: number;
    txn_user: string;
    txn_email: string;
    source_id: number;
    source_owner: string;
    source_owner_email: string;
    source_name: string;
    kind: string;
    amount: string;
    currency: string;
    occurred_at: Date;
    description: string | null;
    is_shared: boolean;
    group_id: number | null;
  }>(drizzleSql`
    SELECT t.id              AS txn_id,
           t.user_id         AS txn_user,
           u_txn.email       AS txn_email,
           t.source_id,
           s.user_id         AS source_owner,
           u_src.email       AS source_owner_email,
           s.name            AS source_name,
           t.kind,
           t.amount,
           t.currency,
           t.occurred_at,
           t.description,
           t.is_shared,
           t.group_id
    FROM transactions t
    JOIN sources s     ON s.id    = t.source_id
    JOIN users   u_txn ON u_txn.id = t.user_id
    JOIN users   u_src ON u_src.id = s.user_id
    WHERE t.user_id <> s.user_id
    ORDER BY t.occurred_at DESC
  `);

  const mismatchedDestRes = await db.execute<{
    txn_id: number;
    txn_user: string;
    txn_email: string;
    dest_source_id: number;
    dest_owner: string;
    dest_owner_email: string;
    source_name: string;
    kind: string;
    amount: string;
    currency: string;
    occurred_at: Date;
    description: string | null;
  }>(drizzleSql`
    SELECT t.id                  AS txn_id,
           t.user_id             AS txn_user,
           u_txn.email           AS txn_email,
           t.dest_source_id,
           s.user_id             AS dest_owner,
           u_src.email           AS dest_owner_email,
           s.name                AS source_name,
           t.kind,
           t.amount,
           t.currency,
           t.occurred_at,
           t.description
    FROM transactions t
    JOIN sources s     ON s.id    = t.dest_source_id
    JOIN users   u_txn ON u_txn.id = t.user_id
    JOIN users   u_src ON u_src.id = s.user_id
    WHERE t.dest_source_id IS NOT NULL
      AND t.user_id <> s.user_id
    ORDER BY t.occurred_at DESC
  `);

  // Aggregate impact: per source, sum of amounts (signed by kind) that don't belong.
  const impactBySourceRes = await db.execute<{
    source_id: number;
    source_name: string;
    source_owner_email: string;
    bad_count: number;
    inflated_balance: string;
  }>(drizzleSql`
    SELECT s.id                                                         AS source_id,
           s.name                                                       AS source_name,
           u.email                                                      AS source_owner_email,
           COUNT(*)::int                                                AS bad_count,
           COALESCE(SUM(
             CASE
               WHEN t.kind = 'income'   AND t.source_id      = s.id THEN t.amount
               WHEN t.kind = 'transfer' AND t.dest_source_id = s.id THEN t.amount
               WHEN t.kind = 'expense'  AND t.source_id      = s.id THEN -t.amount
               WHEN t.kind = 'transfer' AND t.source_id      = s.id THEN -t.amount
               ELSE 0
             END
           ), 0)::text                                                  AS inflated_balance
    FROM transactions t
    JOIN sources s ON s.id = t.source_id OR s.id = t.dest_source_id
    JOIN users   u ON u.id = s.user_id
    WHERE t.user_id <> s.user_id
    GROUP BY s.id, s.name, u.email
    HAVING COUNT(*) > 0
    ORDER BY ABS(SUM(
      CASE
        WHEN t.kind = 'income'   AND t.source_id      = s.id THEN t.amount
        WHEN t.kind = 'transfer' AND t.dest_source_id = s.id THEN t.amount
        WHEN t.kind = 'expense'  AND t.source_id      = s.id THEN -t.amount
        WHEN t.kind = 'transfer' AND t.source_id      = s.id THEN -t.amount
        ELSE 0
      END
    )) DESC
  `);

  // Neon's pg driver wraps rows in { rows: [...] }; node-postgres style. Normalize.
  const mismatchedSource = (mismatchedSourceRes as unknown as { rows?: typeof mismatchedSourceRes }).rows ?? (mismatchedSourceRes as unknown as typeof mismatchedSourceRes);
  const mismatchedDest = (mismatchedDestRes as unknown as { rows?: typeof mismatchedDestRes }).rows ?? (mismatchedDestRes as unknown as typeof mismatchedDestRes);
  const impactBySource = (impactBySourceRes as unknown as { rows?: typeof impactBySourceRes }).rows ?? (impactBySourceRes as unknown as typeof impactBySourceRes);

  console.log(`\nSection A — transactions with source_id mismatch: ${mismatchedSource.length} row(s)`);
  if (mismatchedSource.length === 0) {
    console.log("  (none)");
  } else {
    for (const r of mismatchedSource.slice(0, 50)) {
      console.log(
        `  txn=${r.txn_id}  ${r.occurred_at.toISOString().slice(0, 10)}  ${r.kind.padEnd(8)} ` +
        `${r.currency} ${r.amount.padStart(12)}  ` +
        `txn_user=${r.txn_email}  →  source="${r.source_name}" owned_by=${r.source_owner_email}  ` +
        `${r.is_shared ? "(shared" + (r.group_id ? `, group=${r.group_id}` : "") + ")" : ""}  ` +
        `desc=${r.description ?? "(none)"}`
      );
    }
    if (mismatchedSource.length > 50) console.log(`  …and ${mismatchedSource.length - 50} more`);
  }

  console.log(`\nSection B — transfers with dest_source_id mismatch: ${mismatchedDest.length} row(s)`);
  if (mismatchedDest.length === 0) {
    console.log("  (none)");
  } else {
    for (const r of mismatchedDest.slice(0, 50)) {
      console.log(
        `  txn=${r.txn_id}  ${r.occurred_at.toISOString().slice(0, 10)}  ${r.kind.padEnd(8)} ` +
        `${r.currency} ${r.amount.padStart(12)}  ` +
        `txn_user=${r.txn_email}  →  dest_source="${r.source_name}" owned_by=${r.dest_owner_email}  ` +
        `desc=${r.description ?? "(none)"}`
      );
    }
    if (mismatchedDest.length > 50) console.log(`  …and ${mismatchedDest.length - 50} more`);
  }

  console.log(`\nSection C — per-source inflated balance (before fix):`);
  if (impactBySource.length === 0) {
    console.log("  (none)");
  } else {
    for (const r of impactBySource) {
      console.log(
        `  source=${r.source_id}  "${r.source_name}"  owner=${r.source_owner_email}  ` +
        `bad_rows=${r.bad_count}  inflated_by=${r.inflated_balance}`
      );
    }
  }

  console.log("\n" + "─".repeat(72));
  console.log("Diagnostic complete. No data was modified.");
  console.log("─".repeat(72));
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
