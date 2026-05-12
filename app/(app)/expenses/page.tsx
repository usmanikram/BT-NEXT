import { and, desc, eq, sql } from "drizzle-orm";
import { Plus, Receipt, Pencil } from "lucide-react";
import { db } from "@/lib/db";
import { categories, expenses } from "@/db/schema";
import { PageShell } from "@/components/page-shell";
import { ButtonLink } from "@/components/button-link";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { ColorDot } from "@/components/color-dot";
import { ConfirmDelete } from "@/components/confirm-delete";
import { getCurrentMonth, requireUserId } from "@/lib/session";
import { formatDate, formatMoney, monthLabel } from "@/lib/format";
import { deleteExpenseAction } from "@/actions/expense";

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; category?: string }>;
}) {
  const userId = await requireUserId();
  const { month, category } = await searchParams;
  const current = await getCurrentMonth(month);

  const filterCat = category && /^\d+$/.test(category) ? Number(category) : null;

  const conditions = [eq(expenses.userId, userId), eq(expenses.monthId, current.monthId)];
  if (filterCat) conditions.push(eq(expenses.categoryId, filterCat));

  const rows = await db
    .select({
      id: expenses.id,
      expenseDate: expenses.expenseDate,
      amount: expenses.amount,
      description: expenses.description,
      categoryId: expenses.categoryId,
      categoryName: categories.name,
      categoryColor: categories.color,
    })
    .from(expenses)
    .innerJoin(categories, eq(expenses.categoryId, categories.id))
    .where(and(...conditions))
    .orderBy(desc(expenses.expenseDate), desc(expenses.createdAt));

  const [totalRow] = await db
    .select({ total: sql<string>`COALESCE(SUM(${expenses.amount}), 0)` })
    .from(expenses)
    .where(and(...conditions));
  const total = parseFloat(totalRow.total) || 0;

  const cats = await db
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .where(and(eq(categories.userId, userId), eq(categories.monthId, current.monthId)))
    .orderBy(categories.name);

  return (
    <PageShell title="Expenses" currentYearMonth={current.yearMonth}>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <p className="text-3xl font-semibold tracking-tight font-mono tabular-nums">
            {formatMoney(total)}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Total for {monthLabel(current.yearMonth)}
          </p>
        </div>
        <ButtonLink href="/expenses/new" size="sm">
          <Plus className="size-3.5" /> Add expense
        </ButtonLink>
      </div>

      {cats.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <ButtonLink
            href="/expenses"
            size="sm"
            variant={filterCat == null ? "default" : "outline"}
          >
            All
          </ButtonLink>
          {cats.map((c) => (
            <ButtonLink
              key={c.id}
              href={`/expenses?category=${c.id}`}
              size="sm"
              variant={filterCat === c.id ? "default" : "outline"}
            >
              {c.name}
            </ButtonLink>
          ))}
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No expenses yet"
          description="Start tracking your spending by adding an expense."
          action={
            <ButtonLink href="/expenses/new" size="sm">
              <Plus className="size-3.5" /> Add expense
            </ButtonLink>
          }
        />
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-muted-foreground whitespace-nowrap">{formatDate(r.expenseDate)}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-2">
                      <ColorDot color={r.categoryColor} />
                      <span>{r.categoryName}</span>
                    </span>
                  </TableCell>
                  <TableCell className="font-medium">{r.description}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {formatMoney(r.amount)}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end -mr-2">
                      <ButtonLink href={`/expenses/${r.id}`} variant="ghost" size="icon" className="size-7">
                        <Pencil className="size-3.5" />
                      </ButtonLink>
                      <ConfirmDelete
                        onConfirm={async () => {
                          "use server";
                          return deleteExpenseAction(r.id);
                        }}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={3} className="font-medium text-muted-foreground">Total</TableCell>
                <TableCell className="text-right font-semibold font-mono tabular-nums">
                  {formatMoney(total)}
                </TableCell>
                <TableCell />
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      )}
    </PageShell>
  );
}
