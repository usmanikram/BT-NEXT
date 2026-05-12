import { Sidebar } from "@/components/sidebar";
import { getCurrentUser, readCurrentMonthCookie } from "@/lib/session";
import { listMonths } from "@/lib/budget-service";
import { getCurrentYearMonth } from "@/lib/month";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const months = await listMonths(user.id);
  const cookieYM = await readCurrentMonthCookie();
  const currentYearMonth = cookieYM ?? months[0]?.yearMonth ?? getCurrentYearMonth();

  return (
    <div className="min-h-screen">
      <Sidebar
        months={months.map((m) => ({ yearMonth: m.yearMonth, label: m.label }))}
        currentYearMonth={currentYearMonth}
      />
      <main className="md:pl-60">{children}</main>
    </div>
  );
}
