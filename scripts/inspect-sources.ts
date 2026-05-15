/**
 * Read-only. Lists every source per user with:
 *  - openingBalance
 *  - "old" delta (the pre-fix query — no user_id filter)
 *  - "new" delta (post-fix — with user_id filter)
 *  - difference (the leak amount)
 *
 * Also lists all sources with the same name across users, to help spot UI confusion.
 */
import { sql as drizzleSql } from "drizzle-orm";
import { db } from "@/lib/db";

type Row = {
  source_id: number;
  source_name: string;
  source_owner: string;
  source_owner_email: string;
  opening_balance: string;
  old_delta: string;
  new_delta: string;
  leak: string;
};

async function main() {
  const res = await db.execute<Row>(drizzleSql`
    SELECT s.id                              AS source_id,
           s.name                            AS source_name,
           s.user_id                         AS source_owner,
           u.email                           AS source_owner_email,
           s.opening_balance::text           AS opening_balance,
           COALESCE((
             SELECT SUM(CASE
               WHEN t.kind = 'income'   AND t.source_id      = s.id THEN t.amount
               WHEN t.kind = 'transfer' AND t.dest_source_id = s.id THEN t.amount
               WHEN t.kind = 'expense'  AND t.source_id      = s.id THEN -t.amount
               WHEN t.kind = 'transfer' AND t.source_id      = s.id THEN -t.amount
               ELSE 0
             END)
             FROM transactions t
             WHERE t.source_id = s.id OR t.dest_source_id = s.id
           ), 0)::text                       AS old_delta,
           COALESCE((
             SELECT SUM(CASE
               WHEN t.kind = 'income'   AND t.source_id      = s.id THEN t.amount
               WHEN t.kind = 'transfer' AND t.dest_source_id = s.id THEN t.amount
               WHEN t.kind = 'expense'  AND t.source_id      = s.id THEN -t.amount
               WHEN t.kind = 'transfer' AND t.source_id      = s.id THEN -t.amount
               ELSE 0
             END)
             FROM transactions t
             WHERE (t.source_id = s.id OR t.dest_source_id = s.id)
               AND t.user_id = s.user_id
           ), 0)::text                       AS new_delta,
           (
             COALESCE((
               SELECT SUM(CASE
                 WHEN t.kind = 'income'   AND t.source_id      = s.id THEN t.amount
                 WHEN t.kind = 'transfer' AND t.dest_source_id = s.id THEN t.amount
                 WHEN t.kind = 'expense'  AND t.source_id      = s.id THEN -t.amount
                 WHEN t.kind = 'transfer' AND t.source_id      = s.id THEN -t.amount
                 ELSE 0
               END)
               FROM transactions t
               WHERE t.source_id = s.id OR t.dest_source_id = s.id
             ), 0)
             -
             COALESCE((
               SELECT SUM(CASE
                 WHEN t.kind = 'income'   AND t.source_id      = s.id THEN t.amount
                 WHEN t.kind = 'transfer' AND t.dest_source_id = s.id THEN t.amount
                 WHEN t.kind = 'expense'  AND t.source_id      = s.id THEN -t.amount
                 WHEN t.kind = 'transfer' AND t.source_id      = s.id THEN -t.amount
                 ELSE 0
               END)
               FROM transactions t
               WHERE (t.source_id = s.id OR t.dest_source_id = s.id)
                 AND t.user_id = s.user_id
             ), 0)
           )::text                           AS leak
    FROM sources s
    JOIN users u ON u.id = s.user_id
    ORDER BY u.email, s.name
  `);

  const rows = ((res as unknown as { rows?: Row[] }).rows ?? (res as unknown as Row[]));

  console.log("─".repeat(110));
  console.log("All sources (per user) with opening, old-delta, new-delta, leak");
  console.log("─".repeat(110));
  console.log(
    "id".padStart(4) + "  " +
    "owner".padEnd(34) + "  " +
    "name".padEnd(20) + "  " +
    "opening".padStart(12) + "  " +
    "old_delta".padStart(12) + "  " +
    "new_delta".padStart(12) + "  " +
    "leak".padStart(12)
  );
  for (const r of rows) {
    console.log(
      String(r.source_id).padStart(4) + "  " +
      r.source_owner_email.padEnd(34).slice(0, 34) + "  " +
      r.source_name.padEnd(20).slice(0, 20) + "  " +
      r.opening_balance.padStart(12) + "  " +
      r.old_delta.padStart(12) + "  " +
      r.new_delta.padStart(12) + "  " +
      r.leak.padStart(12)
    );
  }

  // Highlight rows whose leak is non-zero
  const leaky = rows.filter((r) => parseFloat(r.leak) !== 0);
  console.log("\n" + "─".repeat(72));
  console.log(`Sources with non-zero leak: ${leaky.length}`);
  console.log("─".repeat(72));
  if (leaky.length > 0) {
    for (const r of leaky) {
      console.log(
        `  source=${r.source_id} "${r.source_name}" owner=${r.source_owner_email} leak=${r.leak}`
      );
    }
  }

  // Find sources with the same name across users
  const byName = new Map<string, Row[]>();
  for (const r of rows) {
    const arr = byName.get(r.source_name.toLowerCase()) ?? [];
    arr.push(r);
    byName.set(r.source_name.toLowerCase(), arr);
  }
  const shared = Array.from(byName.entries()).filter(([, arr]) => arr.length > 1);
  console.log("\n" + "─".repeat(72));
  console.log(`Source names used by multiple users: ${shared.length}`);
  console.log("─".repeat(72));
  for (const [name, arr] of shared) {
    console.log(`  "${name}" — ${arr.length} owners:`);
    for (const r of arr) {
      console.log(`     source=${r.source_id} owner=${r.source_owner_email} opening=${r.opening_balance} new_delta=${r.new_delta}`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
