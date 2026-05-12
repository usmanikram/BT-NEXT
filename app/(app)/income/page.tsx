import { and, desc, eq, sql } from "drizzle-orm";
import { Plus, Coins, Pencil } from "lucide-react";
import { db } from "@/lib/db";
import { income } from "@/db/schema";
import { getCurrentMonth, requireUserId } from "@/lib/session";
import { formatDate, monthLabel } from "@/lib/format";
import { PageShell } from "@/components/page-shell";
import { Money } from "@/components/money";
import { ButtonLink } from "@/components/button-link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { ConfirmDelete } from "@/components/confirm-delete";
import { deleteIncomeAction } from "@/actions/income";

export default async function IncomePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const userId = await requireUserId();
  const { month } = await searchParams;
  const current = await getCurrentMonth(month);

  const rows = await db
    .select()
    .from(income)
    .where(and(eq(income.userId, userId), eq(income.monthId, current.monthId)))
    .orderBy(desc(income.createdAt));

  const [totalRow] = await db
    .select({ total: sql<string>`COALESCE(SUM(${income.amount}), 0)` })
    .from(income)
    .where(and(eq(income.userId, userId), eq(income.monthId, current.monthId)));

  const totalIncome = parseFloat(totalRow.total) || 0;

  return (
    <PageShell title="Income" currentYearMonth={current.yearMonth}>
      <section className="rounded-3xl bg-green/20 px-7 py-7 mb-6 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-wider text-ink-soft mb-2">
            Total for {monthLabel(current.yearMonth)}
          </p>
          <Money value={totalIncome} size="xl" />
          <p className="mt-1.5 text-sm text-ink-soft">
            {rows.length} {rows.length === 1 ? "source" : "sources"}
          </p>
        </div>
        <ButtonLink href="/income/new">
          <Plus className="size-3.5" /> Add income
        </ButtonLink>
      </section>

      {rows.length === 0 ? (
        <EmptyState
          icon={Coins}
          title="No income yet"
          description="Salary, freelance, rentals — add anything coming in this month."
          action={
            <ButtonLink href="/income/new">
              <Plus className="size-3.5" /> Add income
            </ButtonLink>
          }
        />
      ) : (
        <div className="rounded-2xl bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-ink/5 hover:bg-transparent">
                <TableHead>Source</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead>Added</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id} className="border-ink/5">
                  <TableCell className="font-medium">{r.source}</TableCell>
                  <TableCell className="text-right">
                    <Money value={parseFloat(r.amount) || 0} size="sm" />
                  </TableCell>
                  <TableCell className="text-ink-soft">{r.notes ?? "—"}</TableCell>
                  <TableCell className="text-ink-soft">{formatDate(r.createdAt)}</TableCell>
                  <TableCell>
                    <div className="flex justify-end -mr-2">
                      <ButtonLink href={`/income/${r.id}`} variant="ghost" size="icon" className="size-7">
                        <Pencil className="size-3.5" />
                      </ButtonLink>
                      <ConfirmDelete
                        onConfirm={async () => {
                          "use server";
                          return deleteIncomeAction(r.id);
                        }}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow className="border-ink/5">
                <TableCell className="font-medium text-ink-soft">Total</TableCell>
                <TableCell className="text-right">
                  <Money value={totalIncome} size="sm" />
                </TableCell>
                <TableCell colSpan={3} />
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      )}
    </PageShell>
  );
}
