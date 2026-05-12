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
      <div className="max-w-md rounded-xl border bg-card p-6">
        <div className="mb-5">
          <h2 className="text-sm font-medium">Change password</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Update your account password.</p>
        </div>
        <ChangePasswordForm />
      </div>
    </PageShell>
  );
}
