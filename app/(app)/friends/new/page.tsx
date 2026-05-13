import { PageShell } from "@/components/page-shell";
import { AddFriendForm } from "./add-form";
import { addFriendByEmailAction } from "@/actions/friend";
import { getCurrentMonth } from "@/lib/session";

export default async function NewFriendPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month } = await searchParams;
  const current = await getCurrentMonth(month);
  return (
    <PageShell title="Add a friend" currentYearMonth={current.yearMonth} eyebrow="Pick someone to split with">
      <div className="max-w-md rounded-2xl bg-card p-6">
        <AddFriendForm action={addFriendByEmailAction} />
      </div>
    </PageShell>
  );
}
