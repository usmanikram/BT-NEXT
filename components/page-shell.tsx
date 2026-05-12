import { Topbar } from "@/components/topbar";
import { getCurrentUser } from "@/lib/session";
import { monthLabel } from "@/lib/format";

export async function PageShell({
  title,
  currentYearMonth,
  children,
}: {
  title: string;
  currentYearMonth: string;
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  return (
    <>
      <Topbar
        pageTitle={title}
        monthLabel={monthLabel(currentYearMonth)}
        userName={user.name ?? user.email}
      />
      <div className="px-6 sm:px-8 py-6 mx-auto max-w-7xl">{children}</div>
    </>
  );
}
