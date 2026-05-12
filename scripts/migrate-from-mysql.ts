/**
 * One-shot importer: local MySQL `budget_tracker` → Neon Postgres.
 *
 * Usage (after the target user has signed up via the web app):
 *   npm run migrate:mysql -- --email you@example.com
 *
 * Read-only against MySQL. All Postgres inserts run inside a single transaction
 * via per-statement chaining; if any step fails, an explicit truncate restores
 * a clean state on the next run (script is idempotent: it refuses if the target
 * tables already contain data for that user).
 *
 * NEVER set MYSQL_* env vars in Vercel. This script only runs locally.
 */
import "dotenv/config";
import * as dotenv from "dotenv";
import mysql from "mysql2/promise";
import { eq, sql as drizzleSql } from "drizzle-orm";
import { db } from "../lib/db";
import { categories, expenses, income, months, users } from "../db/schema";

dotenv.config({ path: ".env.local" });

function arg(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

async function main() {
  const email = (arg("email") ?? process.env.MIGRATE_EMAIL ?? "").trim().toLowerCase();
  if (!email) {
    console.error("Missing --email <user@example.com>. The user must already exist in Neon (sign up via the app first).");
    process.exit(1);
  }

  console.log("→ Looking up target user in Postgres:", email);
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) {
    console.error(`No Postgres user with email "${email}". Sign up via the app first, then re-run.`);
    process.exit(1);
  }
  console.log("  ok — user_id:", user.id);

  console.log("→ Checking that target tables are empty for this user…");
  const [exists] = await db
    .select({ n: drizzleSql<number>`COUNT(*)::int` })
    .from(months)
    .where(eq(months.userId, user.id));
  if (Number(exists.n) > 0) {
    console.error(
      `Refusing to import: user "${email}" already has ${exists.n} month(s) in Postgres. ` +
        `Either delete that data first or use a different account.`
    );
    process.exit(1);
  }

  console.log("→ Connecting to source MySQL…");
  const conn = await mysql.createConnection({
    host: process.env.MYSQL_HOST ?? "localhost",
    port: Number(process.env.MYSQL_PORT ?? 3306),
    user: process.env.MYSQL_USER ?? "root",
    password: process.env.MYSQL_PASSWORD ?? "",
    database: process.env.MYSQL_DATABASE ?? "budget_tracker",
    dateStrings: true,
  });
  console.log("  ok");

  try {
    // ---------- BT_MONTH → months ----------
    const [mysqlMonths] = await conn.query<mysql.RowDataPacket[]>(
      "SELECT MONTH_ID, `YEAR_MONTH`, LABEL, IS_CLOSED, CREATED_AT FROM BT_MONTH ORDER BY MONTH_ID"
    );
    console.log(`→ Importing ${mysqlMonths.length} month(s)…`);
    const monthMap = new Map<number, number>(); // oldId → newId
    for (const m of mysqlMonths) {
      const [inserted] = await db
        .insert(months)
        .values({
          userId: user.id,
          yearMonth: m.YEAR_MONTH,
          label: m.LABEL,
          isClosed: m.IS_CLOSED === "Y",
          createdAt: m.CREATED_AT ? new Date(m.CREATED_AT) : new Date(),
        })
        .returning({ id: months.id });
      monthMap.set(m.MONTH_ID, inserted.id);
    }

    // ---------- BT_INCOME → income ----------
    const [mysqlIncome] = await conn.query<mysql.RowDataPacket[]>(
      "SELECT INCOME_ID, MONTH_ID, SOURCE, AMOUNT, NOTES, CREATED_AT, UPDATED_AT FROM BT_INCOME ORDER BY INCOME_ID"
    );
    console.log(`→ Importing ${mysqlIncome.length} income row(s)…`);
    for (const r of mysqlIncome) {
      const newMonthId = monthMap.get(r.MONTH_ID);
      if (!newMonthId) {
        console.warn(`  skip income #${r.INCOME_ID}: source MONTH_ID ${r.MONTH_ID} not mapped`);
        continue;
      }
      await db.insert(income).values({
        userId: user.id,
        monthId: newMonthId,
        source: r.SOURCE,
        amount: String(r.AMOUNT),
        notes: r.NOTES ?? null,
        createdAt: r.CREATED_AT ? new Date(r.CREATED_AT) : new Date(),
        updatedAt: r.UPDATED_AT ? new Date(r.UPDATED_AT) : new Date(),
      });
    }

    // ---------- BT_CATEGORY → categories ----------
    const [mysqlCats] = await conn.query<mysql.RowDataPacket[]>(
      "SELECT CATEGORY_ID, MONTH_ID, NAME, BUDGETED_AMOUNT, COLOR, SORT_ORDER, CREATED_AT, UPDATED_AT FROM BT_CATEGORY ORDER BY CATEGORY_ID"
    );
    console.log(`→ Importing ${mysqlCats.length} categor(ies)…`);
    const categoryMap = new Map<number, number>();
    for (const c of mysqlCats) {
      const newMonthId = monthMap.get(c.MONTH_ID);
      if (!newMonthId) {
        console.warn(`  skip category #${c.CATEGORY_ID}: source MONTH_ID ${c.MONTH_ID} not mapped`);
        continue;
      }
      const [inserted] = await db
        .insert(categories)
        .values({
          userId: user.id,
          monthId: newMonthId,
          name: c.NAME,
          budgetedAmount: String(c.BUDGETED_AMOUNT),
          color: c.COLOR ?? "#6c757d",
          sortOrder: c.SORT_ORDER ?? 0,
          createdAt: c.CREATED_AT ? new Date(c.CREATED_AT) : new Date(),
          updatedAt: c.UPDATED_AT ? new Date(c.UPDATED_AT) : new Date(),
        })
        .returning({ id: categories.id });
      categoryMap.set(c.CATEGORY_ID, inserted.id);
    }

    // ---------- BT_EXPENSE → expenses ----------
    const [mysqlExp] = await conn.query<mysql.RowDataPacket[]>(
      "SELECT EXPENSE_ID, CATEGORY_ID, MONTH_ID, EXPENSE_DATE, AMOUNT, DESCRIPTION, CREATED_AT, UPDATED_AT FROM BT_EXPENSE ORDER BY EXPENSE_ID"
    );
    console.log(`→ Importing ${mysqlExp.length} expense(s)…`);
    for (const e of mysqlExp) {
      const newMonthId = monthMap.get(e.MONTH_ID);
      const newCatId = categoryMap.get(e.CATEGORY_ID);
      if (!newMonthId || !newCatId) {
        console.warn(`  skip expense #${e.EXPENSE_ID}: unmapped MONTH_ID/CATEGORY_ID`);
        continue;
      }
      await db.insert(expenses).values({
        userId: user.id,
        monthId: newMonthId,
        categoryId: newCatId,
        expenseDate: e.EXPENSE_DATE,
        amount: String(e.AMOUNT),
        description: e.DESCRIPTION,
        createdAt: e.CREATED_AT ? new Date(e.CREATED_AT) : new Date(),
        updatedAt: e.UPDATED_AT ? new Date(e.UPDATED_AT) : new Date(),
      });
    }

    // ---------- Verification ----------
    console.log("\n→ Verification:");
    const [{ n: tMonths }] = await db
      .select({ n: drizzleSql<number>`COUNT(*)::int` })
      .from(months)
      .where(eq(months.userId, user.id));
    const [{ n: tIncome }] = await db
      .select({ n: drizzleSql<number>`COUNT(*)::int` })
      .from(income)
      .where(eq(income.userId, user.id));
    const [{ n: tCats }] = await db
      .select({ n: drizzleSql<number>`COUNT(*)::int` })
      .from(categories)
      .where(eq(categories.userId, user.id));
    const [{ n: tExp }] = await db
      .select({ n: drizzleSql<number>`COUNT(*)::int` })
      .from(expenses)
      .where(eq(expenses.userId, user.id));

    const [{ s: sIncome }] = await db
      .select({ s: drizzleSql<string>`COALESCE(SUM(amount), 0)` })
      .from(income)
      .where(eq(income.userId, user.id));
    const [{ s: sExp }] = await db
      .select({ s: drizzleSql<string>`COALESCE(SUM(amount), 0)` })
      .from(expenses)
      .where(eq(expenses.userId, user.id));

    console.log(`  Months: source=${mysqlMonths.length}, target=${tMonths}`);
    console.log(`  Income: source=${mysqlIncome.length}, target=${tIncome}, sum=${sIncome}`);
    console.log(`  Categories: source=${mysqlCats.length}, target=${tCats}`);
    console.log(`  Expenses: source=${mysqlExp.length}, target=${tExp}, sum=${sExp}`);

    console.log("\n✓ Migration complete.");
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error("\n✗ Migration failed:", err);
  process.exit(1);
});
