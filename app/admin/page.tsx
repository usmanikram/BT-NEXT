import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, transactions, sources, savingsGoals } from "@/db/schema";

export default async function AdminOverviewPage() {
  const [usersCount] = await db.select({ n: sql<number>`COUNT(*)::int` }).from(users);
  const [txnCount] = await db.select({ n: sql<number>`COUNT(*)::int` }).from(transactions);
  const [srcCount] = await db.select({ n: sql<number>`COUNT(*)::int` }).from(sources);
  const [goalsCount] = await db.select({ n: sql<number>`COUNT(*)::int` }).from(savingsGoals);

  return (
    <>
      <h1 className="font-display text-3xl font-semibold tracking-tight mb-6">Overview</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Users" value={usersCount.n} />
        <Stat label="Transactions" value={txnCount.n} />
        <Stat label="Sources" value={srcCount.n} />
        <Stat label="Goals" value={goalsCount.n} />
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-card p-5">
      <p className="text-xs uppercase tracking-wider text-ink-soft">{label}</p>
      <p className="mt-2 font-display text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
    </div>
  );
}
