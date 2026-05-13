import { PageShell } from "@/components/page-shell";
import { SourceForm } from "../source-form";
import { createSourceAction } from "@/actions/source";
import { getCurrentMonth, requireUserId } from "@/lib/session";
import { db } from "@/lib/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export default async function NewSourcePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const userId = await requireUserId();
  const { month } = await searchParams;
  const current = await getCurrentMonth(month);
  const [user] = await db.select({ defaultCurrency: users.defaultCurrency }).from(users).where(eq(users.id, userId)).limit(1);

  return (
    <PageShell title="New source" currentYearMonth={current.yearMonth} eyebrow="Track where your money lives">
      <div className="max-w-lg rounded-2xl bg-card p-6">
        <SourceForm
          initial={{
            name: "",
            type: "wallet",
            currency: user?.defaultCurrency ?? "PKR",
            openingBalance: "0",
            color: "#7BCFA9",
          }}
          action={createSourceAction}
          submitLabel="Add source"
        />
      </div>
    </PageShell>
  );
}
