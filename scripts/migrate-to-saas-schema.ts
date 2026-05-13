/**
 * One-shot migration: legacy month-scoped budget tracker → unified SaaS schema.
 *
 * Reads from legacy tables (income, expenses, categories with monthId+budgetedAmount)
 * and writes to new tables (sources, transactions, categories_v2, budgets).
 *
 * Idempotent per user: refuses if user already has rows in `transactions` (or `--force`).
 *
 * Usage:
 *   npm run migrate:saas -- --email you@example.com
 *   npm run migrate:saas -- --email you@example.com --dry-run
 *   npm run migrate:saas -- --all                       # all users with legacy data
 *
 * Run locally only. After it succeeds for all users, see scripts/README.md for the
 * cleanup step that drops legacy tables and renames categories_v2 → categories.
 */
import "dotenv/config";
import * as dotenv from "dotenv";
import { eq, sql as drizzleSql } from "drizzle-orm";
import { db } from "../lib/db";
import {
  users,
  months,
  income,
  categories,
  expenses,
  sources,
  categoriesV2,
  budgets,
  transactions,
} from "../db/schema";
import { getMonthStart } from "../lib/month";

dotenv.config({ path: ".env.local" });

type Flags = { email?: string; all: boolean; dryRun: boolean; force: boolean };

function parseArgs(): Flags {
  const argv = process.argv.slice(2);
  const flags: Flags = { all: false, dryRun: false, force: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--email") flags.email = argv[++i];
    else if (a === "--all") flags.all = true;
    else if (a === "--dry-run") flags.dryRun = true;
    else if (a === "--force") flags.force = true;
  }
  return flags;
}

async function migrateUser(userId: string, dryRun: boolean, force: boolean) {
  // -------- Pre-flight: refuse if already migrated --------
  const [existingTxn] = await db
    .select({ n: drizzleSql<number>`COUNT(*)::int` })
    .from(transactions)
    .where(eq(transactions.userId, userId));
  if (Number(existingTxn.n) > 0 && !force) {
    console.warn(`  ⚠ user ${userId} already has ${existingTxn.n} transactions — skipping (use --force to override)`);
    return;
  }

  // -------- Load legacy data --------
  const userMonths = await db.select().from(months).where(eq(months.userId, userId));
  const userIncome = await db.select().from(income).where(eq(income.userId, userId));
  const userCats = await db.select().from(categories).where(eq(categories.userId, userId));
  const userExpenses = await db.select().from(expenses).where(eq(expenses.userId, userId));

  console.log(
    `  legacy rows — months:${userMonths.length} income:${userIncome.length} categories:${userCats.length} expenses:${userExpenses.length}`
  );

  if (userIncome.length === 0 && userExpenses.length === 0 && userCats.length === 0) {
    console.log("  nothing to migrate — user has no legacy data");
    return;
  }

  // -------- Resolve user's default currency --------
  const [userRow] = await db.select({ defaultCurrency: users.defaultCurrency }).from(users).where(eq(users.id, userId)).limit(1);
  const currency = userRow?.defaultCurrency ?? "PKR";

  if (dryRun) {
    console.log("  [dry-run] would create 1 Wallet source");
    const distinctNames = new Set(userCats.map((c) => c.name));
    console.log(`  [dry-run] would create ${distinctNames.size} global categories from ${userCats.length} legacy rows`);
    console.log(`  [dry-run] would create ${userCats.length} budget rows`);
    console.log(`  [dry-run] would create ${userIncome.length + userExpenses.length} transactions`);
    return;
  }

  // -------- 1. Default Wallet source --------
  const [wallet] = await db
    .insert(sources)
    .values({
      userId,
      name: "Wallet",
      type: "wallet",
      currency,
      openingBalance: "0",
      color: "#7BCFA9",
    })
    .returning({ id: sources.id });
  console.log(`  ✓ source created (id=${wallet.id}, currency=${currency})`);

  // -------- 2. Global categories --------
  // Pick latest (name, color, sortOrder) per name — most-recent row wins.
  const distinctByName = new Map<string, { name: string; color: string; sortOrder: number }>();
  for (const c of userCats) {
    distinctByName.set(c.name, { name: c.name, color: c.color, sortOrder: c.sortOrder });
  }

  const oldCatToNew = new Map<number, number>(); // legacy category_id → new category_v2_id
  const newCatByName = new Map<string, number>();
  for (const meta of distinctByName.values()) {
    const [inserted] = await db
      .insert(categoriesV2)
      .values({
        userId,
        name: meta.name,
        kind: "expense",
        color: meta.color,
        sortOrder: meta.sortOrder,
      })
      .returning({ id: categoriesV2.id });
    newCatByName.set(meta.name, inserted.id);
  }
  for (const c of userCats) {
    const newId = newCatByName.get(c.name);
    if (newId) oldCatToNew.set(c.id, newId);
  }
  console.log(`  ✓ ${newCatByName.size} global categories created (deduped from ${userCats.length})`);

  // -------- 3. Budgets (one row per legacy category → budget for that month) --------
  let budgetCount = 0;
  for (const c of userCats) {
    const newCatId = oldCatToNew.get(c.id);
    if (!newCatId) continue;
    // Upsert: a global category may appear in multiple months with different budgets.
    // Unique constraint is (user_id, month_id, category_id) — won't collide across months.
    await db
      .insert(budgets)
      .values({
        userId,
        monthId: c.monthId,
        categoryId: newCatId,
        amount: c.budgetedAmount,
      })
      .onConflictDoUpdate({
        target: [budgets.userId, budgets.monthId, budgets.categoryId],
        set: { amount: c.budgetedAmount, updatedAt: new Date() },
      });
    budgetCount++;
  }
  console.log(`  ✓ ${budgetCount} budgets created`);

  // -------- 4. Income → transactions --------
  // Income rows have no date; use the month's first day at noon UTC.
  const monthsById = new Map<number, (typeof userMonths)[number]>();
  for (const m of userMonths) monthsById.set(m.id, m);

  let incomeCount = 0;
  for (const r of userIncome) {
    const month = monthsById.get(r.monthId);
    if (!month) continue;
    const occurredAt = new Date(`${getMonthStart(month.yearMonth)}T12:00:00Z`);
    await db.insert(transactions).values({
      userId,
      sourceId: wallet.id,
      kind: "income",
      categoryId: null,
      amount: r.amount,
      currency,
      occurredAt,
      description: r.source,
      notes: r.notes ?? null,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    });
    incomeCount++;
  }
  console.log(`  ✓ ${incomeCount} income transactions created`);

  // -------- 5. Expenses → transactions --------
  let expenseCount = 0;
  for (const e of userExpenses) {
    const newCatId = oldCatToNew.get(e.categoryId);
    const occurredAt = new Date(`${e.expenseDate}T12:00:00Z`);
    await db.insert(transactions).values({
      userId,
      sourceId: wallet.id,
      kind: "expense",
      categoryId: newCatId ?? null,
      amount: e.amount,
      currency,
      occurredAt,
      description: e.description,
      notes: null,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
    });
    expenseCount++;
  }
  console.log(`  ✓ ${expenseCount} expense transactions created`);

  // -------- 6. Verify totals --------
  const [{ s: sIncomeOld }] = await db
    .select({ s: drizzleSql<string>`COALESCE(SUM(amount), 0)` })
    .from(income)
    .where(eq(income.userId, userId));
  const [{ s: sExpenseOld }] = await db
    .select({ s: drizzleSql<string>`COALESCE(SUM(amount), 0)` })
    .from(expenses)
    .where(eq(expenses.userId, userId));
  const [{ s: sIncomeNew }] = await db
    .select({ s: drizzleSql<string>`COALESCE(SUM(amount), 0)` })
    .from(transactions)
    .where(drizzleSql`${transactions.userId} = ${userId} AND ${transactions.kind} = 'income'`);
  const [{ s: sExpenseNew }] = await db
    .select({ s: drizzleSql<string>`COALESCE(SUM(amount), 0)` })
    .from(transactions)
    .where(drizzleSql`${transactions.userId} = ${userId} AND ${transactions.kind} = 'expense'`);

  console.log(`  ▸ income: legacy=${sIncomeOld} new=${sIncomeNew}  ${sIncomeOld === sIncomeNew ? "✓" : "✗ MISMATCH"}`);
  console.log(`  ▸ expense: legacy=${sExpenseOld} new=${sExpenseNew}  ${sExpenseOld === sExpenseNew ? "✓" : "✗ MISMATCH"}`);
  if (sIncomeOld !== sIncomeNew || sExpenseOld !== sExpenseNew) {
    throw new Error("Totals do not match after migration. Investigate before continuing.");
  }
}

async function main() {
  const flags = parseArgs();

  if (!flags.email && !flags.all) {
    console.error("Usage: --email <user@example.com>  OR  --all");
    console.error("Optional: --dry-run --force");
    process.exit(1);
  }

  const targets = flags.all
    ? await db.select({ id: users.id, email: users.email }).from(users)
    : await db.select({ id: users.id, email: users.email }).from(users).where(eq(users.email, flags.email!.toLowerCase()));

  if (targets.length === 0) {
    console.error("No matching users found.");
    process.exit(1);
  }

  console.log(`→ Migrating ${targets.length} user(s)${flags.dryRun ? " [dry-run]" : ""}`);
  for (const u of targets) {
    console.log(`\n• ${u.email} (${u.id})`);
    await migrateUser(u.id, flags.dryRun, flags.force);
  }
  console.log("\n✓ Done.");
}

main().catch((err) => {
  console.error("\n✗ Migration failed:", err);
  process.exit(1);
});
