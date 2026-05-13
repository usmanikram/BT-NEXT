import { Plus, ArrowDown, ArrowUp, ArrowLeftRight, Receipt } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Money } from "@/components/money";
import { ButtonLink } from "@/components/button-link";
import { EmptyState } from "@/components/empty-state";
import { ConfirmDelete } from "@/components/confirm-delete";
import { listTransactions } from "@/lib/transaction-service";
import { getCurrentMonth, requireUserId } from "@/lib/session";
import { formatDate } from "@/lib/format";
import { deleteTransactionAction } from "@/actions/transaction";
import { cn } from "@/lib/utils";

const KIND_LINKS: Array<{ kind: "all" | "income" | "expense" | "transfer"; label: string }> = [
  { kind: "all", label: "All" },
  { kind: "income", label: "Income" },
  { kind: "expense", label: "Expense" },
  { kind: "transfer", label: "Transfer" },
];

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; kind?: string; page?: string }>;
}) {
  const userId = await requireUserId();
  const { month, kind, page } = await searchParams;
  const current = await getCurrentMonth(month);

  const activeKind = kind === "income" || kind === "expense" || kind === "transfer" ? kind : undefined;
  const pageNum = Math.max(1, Number(page) || 1);
  const perPage = 25;

  const { rows, total } = await listTransactions(userId, {
    kind: activeKind,
    page: pageNum,
    perPage,
  });

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  return (
    <PageShell title="Transactions" currentYearMonth={current.yearMonth} eyebrow="Everything that's moved">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex flex-wrap gap-1.5">
          {KIND_LINKS.map((k) => {
            const isActive = (k.kind === "all" && !activeKind) || k.kind === activeKind;
            const href = k.kind === "all" ? "/transactions" : `/transactions?kind=${k.kind}`;
            return (
              <a
                key={k.kind}
                href={href}
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
                  isActive ? "bg-ink text-cream" : "bg-card text-ink-soft hover:text-ink"
                )}
              >
                {k.label}
              </a>
            );
          })}
        </div>
        <ButtonLink href="/transactions/new">
          <Plus className="size-3.5" /> New transaction
        </ButtonLink>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No transactions yet"
          description="Log your first income, expense, or transfer to see it here."
          action={
            <ButtonLink href="/transactions/new">
              <Plus className="size-3.5" /> Add one
            </ButtonLink>
          }
        />
      ) : (
        <>
          <ul className="rounded-2xl bg-card divide-y divide-ink/5 overflow-hidden">
            {rows.map((t) => {
              const isOut = t.kind === "expense";
              const isIn = t.kind === "income";
              const Icon = t.kind === "transfer" ? ArrowLeftRight : isOut ? ArrowUp : ArrowDown;
              return (
                <li key={t.id} className="flex items-center gap-3 px-4 py-3">
                  <span
                    className={cn(
                      "inline-flex size-9 items-center justify-center rounded-xl",
                      isOut ? "bg-coral/10 text-coral" : isIn ? "bg-green/15 text-green" : "bg-yellow/30 text-ink"
                    )}
                  >
                    <Icon className="size-4" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {t.description ?? (t.kind === "transfer" ? `Transfer · ${t.destSourceName}` : t.kind === "income" ? "Income" : "Expense")}
                    </p>
                    <p className="text-xs text-ink-soft">
                      {t.kind === "transfer"
                        ? `${t.sourceName} → ${t.destSourceName}`
                        : `${t.categoryName ?? "—"} · ${t.sourceName}`}
                      {" · "}{formatDate(t.occurredAt)}
                    </p>
                  </div>
                  <Money
                    value={parseFloat(t.amount) || 0}
                    prefix={t.currency}
                    size="sm"
                    className={cn(isOut && "text-coral", isIn && "text-green")}
                  />
                  <div className="ml-2 flex">
                    <a href={`/transactions/${t.id}`} className="rounded-md p-1.5 text-ink-soft hover:bg-ink/5 hover:text-ink">
                      <span className="sr-only">Edit</span>
                      <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4Z" /></svg>
                    </a>
                    <ConfirmDelete
                      onConfirm={async () => {
                        "use server";
                        return deleteTransactionAction(t.id);
                      }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between text-xs text-ink-soft">
              <span>
                Page {pageNum} of {totalPages} · {total} total
              </span>
              <div className="flex gap-2">
                {pageNum > 1 && (
                  <a
                    href={`/transactions?${new URLSearchParams({ ...(activeKind ? { kind: activeKind } : {}), page: String(pageNum - 1) }).toString()}`}
                    className="rounded-md bg-card px-3 py-1.5 hover:bg-ink/5"
                  >
                    Previous
                  </a>
                )}
                {pageNum < totalPages && (
                  <a
                    href={`/transactions?${new URLSearchParams({ ...(activeKind ? { kind: activeKind } : {}), page: String(pageNum + 1) }).toString()}`}
                    className="rounded-md bg-card px-3 py-1.5 hover:bg-ink/5"
                  >
                    Next
                  </a>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </PageShell>
  );
}
