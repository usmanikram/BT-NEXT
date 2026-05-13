import { PageShell } from "@/components/page-shell";
import { AssistantChat } from "./chat";
import { getCurrentMonth, getCurrentUser } from "@/lib/session";

export default async function AssistantPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month } = await searchParams;
  const current = await getCurrentMonth(month);
  const user = await getCurrentUser();

  return (
    <PageShell title="Assistant" currentYearMonth={current.yearMonth} eyebrow="Your money copilot">
      <AssistantChat userName={user.name ?? user.email} />
    </PageShell>
  );
}
