/**
 * Backfill: every existing transaction with kind='expense' gets one expense_participants row
 * (payer = user_id, share = full amount). After this runs, the user_expense_shares view returns
 * identical totals to the legacy SUM(transactions.amount) WHERE kind='expense' queries.
 *
 * Idempotent: ON CONFLICT DO NOTHING on (transaction_id, user_id).
 *
 * Usage: npm run migrate:participants
 */
import "dotenv/config";
import * as dotenv from "dotenv";
import { and, eq, sql as drizzleSql } from "drizzle-orm";
import { db } from "../lib/db";
import { expenseParticipants, transactions, userExpenseShares, users } from "../db/schema";

dotenv.config({ path: ".env.local" });

async function main() {
  console.log("→ Counting expense transactions that need backfilling…");
  const [{ n: totalExpenses }] = await db
    .select({ n: drizzleSql<number>`COUNT(*)::int` })
    .from(transactions)
    .where(eq(transactions.kind, "expense"));

  const [{ n: existingParticipants }] = await db
    .select({ n: drizzleSql<number>`COUNT(*)::int` })
    .from(expenseParticipants);

  console.log(`  ${totalExpenses} expense transactions in DB`);
  console.log(`  ${existingParticipants} participant rows already exist`);

  console.log("→ Inserting missing participant rows…");
  // One INSERT…SELECT, ON CONFLICT DO NOTHING. Atomic.
  const result = await db.execute(drizzleSql`
    INSERT INTO expense_participants (transaction_id, user_id, share_amount)
    SELECT t.id, t.user_id, t.amount
    FROM transactions t
    WHERE t.kind = 'expense'
      AND NOT EXISTS (
        SELECT 1 FROM expense_participants ep WHERE ep.transaction_id = t.id
      )
    ON CONFLICT (transaction_id, user_id) DO NOTHING
  `);
  console.log(`  inserted (rowCount): ${(result as { rowCount?: number }).rowCount ?? "?"}`);

  // -------- Verification: per-user sums match before/after --------
  console.log("\n→ Verifying per-user totals match…");
  const userList = await db.select({ id: users.id, email: users.email }).from(users);
  let allOk = true;
  for (const u of userList) {
    const [{ legacy }] = await db
      .select({
        legacy: drizzleSql<string>`COALESCE(SUM(${transactions.amount}), 0)`,
      })
      .from(transactions)
      .where(and(eq(transactions.userId, u.id), eq(transactions.kind, "expense")));

    const [{ viaView }] = await db
      .select({ viaView: drizzleSql<string>`COALESCE(SUM(${userExpenseShares.amount}), 0)` })
      .from(userExpenseShares)
      .where(eq(userExpenseShares.userId, u.id));

    const ok = String(legacy) === String(viaView);
    if (!ok) allOk = false;
    console.log(`  ${u.email}: legacy=${legacy}  via_view=${viaView}  ${ok ? "✓" : "✗ MISMATCH"}`);
  }

  if (!allOk) {
    console.error("\n✗ One or more users have mismatched totals. Investigate before refactoring queries.");
    process.exit(1);
  }
  console.log("\n✓ Backfill complete. All per-user totals match.");
}

main().catch((e) => {
  console.error("\n✗ Backfill failed:", e);
  process.exit(1);
});
