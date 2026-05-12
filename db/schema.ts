import {
  pgTable,
  serial,
  text,
  varchar,
  timestamp,
  boolean,
  numeric,
  integer,
  uuid,
  date,
  unique,
  index,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  fullName: text("full_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const months = pgTable(
  "months",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    yearMonth: varchar("year_month", { length: 7 }).notNull(),
    label: varchar("label", { length: 30 }).notNull(),
    isClosed: boolean("is_closed").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [unique("uk_user_year_month").on(t.userId, t.yearMonth)]
);

export const income = pgTable(
  "income",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    monthId: integer("month_id")
      .notNull()
      .references(() => months.id, { onDelete: "cascade" }),
    source: varchar("source", { length: 100 }).notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    notes: varchar("notes", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("idx_income_user_month").on(t.userId, t.monthId)]
);

export const categories = pgTable(
  "categories",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    monthId: integer("month_id")
      .notNull()
      .references(() => months.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(),
    budgetedAmount: numeric("budgeted_amount", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    color: varchar("color", { length: 20 }).notNull().default("#6c757d"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    unique("uk_user_month_category").on(t.userId, t.monthId, t.name),
    index("idx_category_user_month").on(t.userId, t.monthId),
  ]
);

export const expenses = pgTable(
  "expenses",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    monthId: integer("month_id")
      .notNull()
      .references(() => months.id, { onDelete: "cascade" }),
    categoryId: integer("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }),
    expenseDate: date("expense_date").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    description: varchar("description", { length: 255 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("idx_expense_user_month").on(t.userId, t.monthId),
    index("idx_expense_category").on(t.categoryId),
    index("idx_expense_date").on(t.expenseDate),
  ]
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Month = typeof months.$inferSelect;
export type NewMonth = typeof months.$inferInsert;
export type Income = typeof income.$inferSelect;
export type NewIncome = typeof income.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type Expense = typeof expenses.$inferSelect;
export type NewExpense = typeof expenses.$inferInsert;
