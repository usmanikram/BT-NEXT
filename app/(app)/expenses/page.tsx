import { and, desc, eq, sql } from "drizzle-orm";
import { Plus, Receipt, Pencil } from "lucide-react";
import { db } from "@/lib/db";
import { categories, expenses } from "@/db/schema";
import { PageShell } from "@/components/page-shell";
import { Money } from "@/components/money";
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
import { CategoryIcon } from "@/components/category-icon";
import { ConfirmDelete } from "@/components/confirm-delete";
import { getCurrentMonth, requireUserId } from "@/lib/session";
import { formatDate, monthLabel } from "@/lib/format";
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
    <PageShell title="Spends" currentYearMonth={current.yearMonth}>
      <section className="rounded-3xl bg-coral text-white px-7 py-7 mb-6 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-wider text-white/80 mb-2">
            Total for {monthLabel(current.yearMonth)}
          </p>
          <Money value={total} size="xl" className="text-white" />
          <p className="mt-1.5 text-sm text-white/80">
            {rows.length} {rows.length === 1 ? "spend" : "spends"}
          </p>
        </div>
        <ButtonLink href="/expenses/new" className="bg-white text-ink hover:bg-cream">
          <Plus className="size-3.5" /> Add spend
        </ButtonLink>
      </section>

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
          title="No spends yet"
          description="Track your moves as they happen — the dashboard learns from it."
          action={
            <ButtonLink href="/expenses/new">
              <Plus className="size-3.5" /> Add spend
            </ButtonLink>
          }
        />
      ) : (
        <div className="rounded-2xl bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-ink/5 hover:bg-transparent">
                <TableHead>Date</TableHead>
                <TableHead>Pocket</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id} className="border-ink/5">
                  <TableCell className="text-ink-soft whitespace-nowrap">{formatDate(r.expenseDate)}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-2">
                      <CategoryIcon name={r.categoryName} color={r.categoryColor} size="sm" />
                      <span>{r.categoryName}</span>
                    </span>
                  </TableCell>
                  <TableCell className="font-medium">{r.description}</TableCell>
                  <TableCell className="text-right">
                    <Money value={parseFloat(r.amount) || 0} size="sm" />
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
              <TableRow className="border-ink/5">
                <TableCell colSpan={3} className="font-medium text-ink-soft">Total</TableCell>
                <TableCell className="text-right">
                  <Money value={total} size="sm" />
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
