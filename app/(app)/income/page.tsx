import { and, desc, eq, sql } from "drizzle-orm";
import { Plus, Coins, Pencil } from "lucide-react";
import { db } from "@/lib/db";
import { income } from "@/db/schema";
import { getCurrentMonth, requireUserId } from "@/lib/session";
import { formatDate, formatMoney, monthLabel } from "@/lib/format";
import { PageShell } from "@/components/page-shell";
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
      <div className="mb-6 flex items-end justify-between">
        <div>
          <p className="text-3xl font-semibold tracking-tight font-mono tabular-nums">
            {formatMoney(totalIncome)}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Total for {monthLabel(current.yearMonth)}
          </p>
        </div>
        <ButtonLink href="/income/new" size="sm">
          <Plus className="size-3.5" /> Add income
        </ButtonLink>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Coins}
          title="No income entries"
          description="Start by adding your income sources for this month."
          action={
            <ButtonLink href="/income/new" size="sm">
              <Plus className="size-3.5" /> Add income
            </ButtonLink>
          }
        />
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Source</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead>Added</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.source}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {formatMoney(r.amount)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{r.notes ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(r.createdAt)}</TableCell>
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
              <TableRow>
                <TableCell className="font-medium text-muted-foreground">Total</TableCell>
                <TableCell className="text-right font-semibold font-mono tabular-nums">
                  {formatMoney(totalIncome)}
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
