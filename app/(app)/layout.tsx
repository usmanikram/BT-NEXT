import { Sidebar } from "@/components/sidebar";
import { MobileNav } from "@/components/mobile-nav";
import { BackgroundBlobs } from "@/components/background-blobs";
import { getCurrentUser, readCurrentMonthCookie } from "@/lib/session";
import { listMonths } from "@/lib/budget-service";
import { getCurrentYearMonth } from "@/lib/month";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const months = await listMonths(user.id);
  const cookieYM = await readCurrentMonthCookie();
  const currentYearMonth = cookieYM ?? months[0]?.yearMonth ?? getCurrentYearMonth();

  return (
    <div className="relative min-h-screen">
      <BackgroundBlobs />
      <Sidebar
        months={months.map((m) => ({ yearMonth: m.yearMonth, label: m.label }))}
        currentYearMonth={currentYearMonth}
      />
      <main className="relative z-10 md:pl-64 pb-24 md:pb-0">{children}</main>
      <MobileNav />
    </div>
  );
}
