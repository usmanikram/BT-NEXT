import { PageShell } from "@/components/page-shell";
import { ChangePasswordForm } from "./change-password-form";
import { getCurrentMonth } from "@/lib/session";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month } = await searchParams;
  const current = await getCurrentMonth(month);

  return (
    <PageShell title="Settings" currentYearMonth={current.yearMonth}>
      <div className="max-w-md rounded-2xl bg-card p-6">
        <div className="mb-5">
          <h2 className="font-display text-lg font-semibold">Change password</h2>
          <p className="text-xs text-ink-soft mt-0.5">Keep your pockets safe.</p>
        </div>
        <ChangePasswordForm />
      </div>
    </PageShell>
  );
}
