import { Plus, Users } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Money } from "@/components/money";
import { ButtonLink } from "@/components/button-link";
import { EmptyState } from "@/components/empty-state";
import { getCurrentMonth, requireUserId } from "@/lib/session";
import { listGroups } from "@/lib/group-service";

export default async function GroupsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const userId = await requireUserId();
  const { month } = await searchParams;
  const current = await getCurrentMonth(month);
  const groups = await listGroups(userId, false);

  return (
    <PageShell title="Groups" currentYearMonth={current.yearMonth} eyebrow="Splitting expenses with people">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-soft">
          {groups.length} {groups.length === 1 ? "group" : "groups"}
        </p>
        <ButtonLink href="/groups/new">
          <Plus className="size-3.5" /> New group
        </ButtonLink>
      </div>

      {groups.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No groups yet"
          description="Create one for your roommates, a trip, or anything you split costs on."
          action={
            <ButtonLink href="/groups/new">
              <Plus className="size-3.5" /> Create group
            </ButtonLink>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((g) => (
            <a
              key={g.id}
              href={`/groups/${g.id}`}
              className="relative rounded-3xl bg-card p-6 overflow-hidden shadow-[0_4px_14px_rgba(31,26,20,0.04)] hover:shadow-[0_8px_18px_rgba(31,26,20,0.08)] transition-shadow"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="inline-flex size-10 items-center justify-center rounded-xl bg-coral text-white shadow-[0_6px_14px_rgba(255,107,92,0.25)]">
                  <Users className="size-5" />
                </span>
                <span className="text-xs text-ink-soft">{g.memberCount} {g.memberCount === 1 ? "member" : "members"}</span>
              </div>
              <h3 className="mt-4 font-display text-lg font-semibold tracking-tight truncate">{g.name}</h3>
              {g.description && (
                <p className="mt-0.5 text-xs text-ink-soft line-clamp-1">{g.description}</p>
              )}
              <div className="mt-4">
                {g.netBalance === 0 ? (
                  <p className="text-sm text-ink-soft">Settled up</p>
                ) : g.netBalance > 0 ? (
                  <div>
                    <p className="text-xs text-ink-soft">You&apos;re owed</p>
                    <Money value={g.netBalance} prefix={g.defaultCurrency} size="md" className="text-green" />
                  </div>
                ) : (
                  <div>
                    <p className="text-xs text-ink-soft">You owe</p>
                    <Money value={Math.abs(g.netBalance)} prefix={g.defaultCurrency} size="md" className="text-coral" />
                  </div>
                )}
              </div>
            </a>
          ))}
        </div>
      )}
    </PageShell>
  );
}
