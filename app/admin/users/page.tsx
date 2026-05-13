import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, transactions } from "@/db/schema";
import { formatDate } from "@/lib/format";
import { toggleAdminAction, toggleDisabledAction } from "@/actions/admin";

export default async function AdminUsersPage() {
  // Subquery: transaction count per user
  const txnCount = db
    .select({
      userId: transactions.userId,
      n: sql<number>`COUNT(*)::int`.as("n"),
    })
    .from(transactions)
    .groupBy(transactions.userId)
    .as("txn_count");

  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      fullName: users.fullName,
      role: users.role,
      disabled: users.disabled,
      defaultCurrency: users.defaultCurrency,
      createdAt: users.createdAt,
      txnCount: txnCount.n,
    })
    .from(users)
    .leftJoin(txnCount, eq(users.id, txnCount.userId))
    .orderBy(asc(users.createdAt));

  return (
    <>
      <h1 className="font-display text-3xl font-semibold tracking-tight mb-6">Users</h1>
      <div className="rounded-2xl bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-cream-soft text-xs uppercase tracking-wider text-ink-soft">
            <tr>
              <th className="text-left px-4 py-3">Email</th>
              <th className="text-left px-4 py-3">Name</th>
              <th className="text-left px-4 py-3">Role</th>
              <th className="text-left px-4 py-3">Currency</th>
              <th className="text-right px-4 py-3">Txns</th>
              <th className="text-left px-4 py-3">Joined</th>
              <th className="text-right px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink/5">
            {rows.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-3">{u.email}</td>
                <td className="px-4 py-3">{u.fullName ?? "—"}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs ${
                      u.role === "admin" ? "bg-coral text-white" : "bg-cream-soft text-ink-soft"
                    }`}
                  >
                    {u.role}
                  </span>
                  {u.disabled && (
                    <span className="ml-2 inline-flex rounded-full bg-ink/10 px-2 py-0.5 text-xs text-ink-soft">disabled</span>
                  )}
                </td>
                <td className="px-4 py-3">{u.defaultCurrency}</td>
                <td className="px-4 py-3 text-right tabular-nums">{u.txnCount ?? 0}</td>
                <td className="px-4 py-3 text-ink-soft">{formatDate(u.createdAt)}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-1.5">
                    <form
                      action={async () => {
                        "use server";
                        await toggleAdminAction(u.id, u.role !== "admin");
                      }}
                    >
                      <button type="submit" className="rounded-md px-2 py-1 text-xs hover:bg-ink/5 text-ink-soft">
                        {u.role === "admin" ? "Demote" : "Make admin"}
                      </button>
                    </form>
                    <form
                      action={async () => {
                        "use server";
                        await toggleDisabledAction(u.id, !u.disabled);
                      }}
                    >
                      <button type="submit" className="rounded-md px-2 py-1 text-xs hover:bg-ink/5 text-ink-soft">
                        {u.disabled ? "Enable" : "Disable"}
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
