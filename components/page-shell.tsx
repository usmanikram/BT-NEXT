import { Topbar } from "@/components/topbar";
import { getCurrentUser } from "@/lib/session";
import { monthLabel } from "@/lib/format";

export async function PageShell({
  title,
  currentYearMonth,
  eyebrow,
  children,
}: {
  title: React.ReactNode;
  currentYearMonth: string;
  eyebrow?: string;
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  return (
    <>
      <Topbar
        pageTitle={title}
        monthLabel={monthLabel(currentYearMonth)}
        yearMonth={currentYearMonth}
        userName={user.name ?? user.email}
        eyebrow={eyebrow}
      />
      <div className="px-6 sm:px-10 pb-12 mx-auto max-w-7xl">{children}</div>
    </>
  );
}
