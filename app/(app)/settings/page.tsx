import { eq } from "drizzle-orm";
import { PageShell } from "@/components/page-shell";
import { ChangePasswordForm } from "./change-password-form";
import { CurrencyForm } from "./currency-form";
import { getCurrentMonth, requireUserId } from "@/lib/session";
import { db } from "@/lib/db";
import { users } from "@/db/schema";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month } = await searchParams;
  const current = await getCurrentMonth(month);
  const userId = await requireUserId();
  const [user] = await db
    .select({ defaultCurrency: users.defaultCurrency, email: users.email, fullName: users.fullName, role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return (
    <PageShell title="Settings" currentYearMonth={current.yearMonth}>
      <div className="grid gap-6 max-w-md">
        <div className="rounded-2xl bg-card p-6">
          <div className="mb-5">
            <h2 className="font-display text-lg font-semibold">Account</h2>
            <p className="text-xs text-ink-soft mt-0.5">
              {user?.email} · {user?.role}
            </p>
          </div>
        </div>

        <div className="rounded-2xl bg-card p-6">
          <div className="mb-5">
            <h2 className="font-display text-lg font-semibold">Currency</h2>
            <p className="text-xs text-ink-soft mt-0.5">How money rolls up on your dashboard.</p>
          </div>
          <CurrencyForm initial={user?.defaultCurrency ?? "PKR"} />
        </div>

        <div className="rounded-2xl bg-card p-6">
          <div className="mb-5">
            <h2 className="font-display text-lg font-semibold">Change password</h2>
            <p className="text-xs text-ink-soft mt-0.5">Keep your pockets safe.</p>
          </div>
          <ChangePasswordForm />
        </div>
      </div>
    </PageShell>
  );
}
