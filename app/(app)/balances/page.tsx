import { Scale, Users, UserRound } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Money } from "@/components/money";
import { EmptyState } from "@/components/empty-state";
import { getCurrentMonth, requireUserId } from "@/lib/session";
import { getOverallBalances, summarizeBalances } from "@/lib/settlement-service";

export default async function BalancesPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const userId = await requireUserId();
  const { month } = await searchParams;
  const current = await getCurrentMonth(month);

  const entries = await getOverallBalances(userId);
  const totals = summarizeBalances(entries);

  // Group entries by counterparty for compact display.
  const byCounterparty = new Map<string, { name: string; email: string; rows: typeof entries }>();
  for (const e of entries) {
    const existing = byCounterparty.get(e.counterpartyId) ?? { name: e.name, email: e.email, rows: [] as typeof entries };
    existing.rows.push(e);
    byCounterparty.set(e.counterpartyId, existing);
  }

  return (
    <PageShell title="Balances" currentYearMonth={current.yearMonth} eyebrow="Who owes whom">
      {/* Totals strip */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
        {Object.keys(totals).length === 0 ? (
          <div className="md:col-span-2 rounded-2xl bg-card p-5 text-sm text-ink-soft">
            All settled up.
          </div>
        ) : (
          Object.entries(totals).map(([cur, t]) => (
            <div key={cur} className="rounded-2xl bg-card p-5">
              <p className="text-xs uppercase tracking-wider text-ink-soft">{cur}</p>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[11px] text-ink-soft">You&apos;re owed</p>
                  <Money value={t.owed} prefix={cur} size="md" className="text-green" />
                </div>
                <div>
                  <p className="text-[11px] text-ink-soft">You owe</p>
                  <Money value={t.owe} prefix={cur} size="md" className="text-coral" />
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {byCounterparty.size === 0 ? (
        <EmptyState
          icon={Scale}
          title="Nothing outstanding"
          description="When you share expenses or record settlements, balances will show up here."
        />
      ) : (
        <ul className="space-y-3">
          {Array.from(byCounterparty.entries()).map(([cpId, info]) => (
            <li key={cpId} className="rounded-2xl bg-card p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{info.name}</p>
                  <p className="text-xs text-ink-soft">{info.email}</p>
                </div>
              </div>
              <ul className="mt-3 space-y-1.5">
                {info.rows.map((r, i) => (
                  <li key={i} className="text-sm flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-ink-soft">
                      {r.source === "group" ? <Users className="size-3.5" /> : <UserRound className="size-3.5" />}
                      {r.context}
                    </span>
                    {r.amount > 0 ? (
                      <span className="text-green">
                        +<Money value={r.amount} prefix={r.currency} size="sm" />
                      </span>
                    ) : (
                      <span className="text-coral">
                        −<Money value={Math.abs(r.amount)} prefix={r.currency} size="sm" />
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}
