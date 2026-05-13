import { Plus, Wallet, Archive } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Money } from "@/components/money";
import { ButtonLink } from "@/components/button-link";
import { EmptyState } from "@/components/empty-state";
import { SourceIcon, sourceTypeLabel } from "@/components/source-icon";
import { listSources } from "@/lib/source-service";
import { getCurrentMonth, requireUserId } from "@/lib/session";

export default async function SourcesPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; archived?: string }>;
}) {
  const userId = await requireUserId();
  const { month, archived } = await searchParams;
  const current = await getCurrentMonth(month);
  const showArchived = archived === "1";

  const sources = await listSources(userId, showArchived);
  const active = sources.filter((s) => !s.archived);
  const totalByCurrency = active.reduce<Record<string, number>>((acc, s) => {
    acc[s.currency] = (acc[s.currency] ?? 0) + s.balance;
    return acc;
  }, {});

  return (
    <PageShell title="Sources" currentYearMonth={current.yearMonth} eyebrow="Where your money lives">
      <section className="rounded-3xl bg-yellow/30 px-7 py-7 mb-6 flex items-end justify-between gap-4 flex-wrap">
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-wider text-ink-soft">Total across sources</p>
          <div className="flex flex-wrap gap-x-8 gap-y-2">
            {Object.keys(totalByCurrency).length === 0 ? (
              <Money value={0} size="xl" />
            ) : (
              Object.entries(totalByCurrency).map(([cur, amt]) => (
                <Money key={cur} value={amt} prefix={cur} size="xl" />
              ))
            )}
          </div>
          <p className="text-sm text-ink-soft">
            {active.length} active {active.length === 1 ? "source" : "sources"}
          </p>
        </div>
        <ButtonLink href="/sources/new">
          <Plus className="size-3.5" /> Add source
        </ButtonLink>
      </section>

      {sources.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="No sources yet"
          description="Add your wallets, bank accounts, mobile money, and cards. Every transaction will live in one of these."
          action={
            <ButtonLink href="/sources/new">
              <Plus className="size-3.5" /> Add source
            </ButtonLink>
          }
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sources.map((s) => (
            <a
              key={s.id}
              href={`/sources/${s.id}`}
              className="group rounded-2xl bg-card p-5 transition-shadow hover:shadow-[0_8px_18px_rgba(31,26,20,0.08)]"
            >
              <div className="flex items-start justify-between">
                <SourceIcon type={s.type} color={s.color} size="md" />
                {s.archived && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-ink/5 px-2 py-0.5 text-[10px] uppercase tracking-wider text-ink-soft">
                    <Archive className="size-3" /> Archived
                  </span>
                )}
              </div>
              <p className="mt-4 font-medium">{s.name}</p>
              <p className="text-xs text-ink-soft">{sourceTypeLabel(s.type)}</p>
              <div className="mt-4">
                <Money value={s.balance} prefix={s.currency} size="lg" />
              </div>
            </a>
          ))}
        </div>
      )}

      <div className="mt-6 flex justify-end">
        <a
          href={`?archived=${showArchived ? "0" : "1"}`}
          className="text-xs text-ink-soft hover:text-ink"
        >
          {showArchived ? "Hide archived" : "Show archived"}
        </a>
      </div>
    </PageShell>
  );
}
