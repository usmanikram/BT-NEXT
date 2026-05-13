import {
  pgTable,
  pgEnum,
  pgView,
  serial,
  text,
  varchar,
  timestamp,
  boolean,
  numeric,
  integer,
  uuid,
  date,
  char,
  unique,
  uniqueIndex,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ============================================================
// Enums
// ============================================================

export const userRoleEnum = pgEnum("user_role", ["user", "admin"]);

export const sourceTypeEnum = pgEnum("source_type", [
  "wallet",
  "bank",
  "credit_card",
  "debit_card",
  "easypaisa",
  "jazzcash",
  "payoneer",
  "wise",
  "savings",
]);

export const transactionKindEnum = pgEnum("transaction_kind", [
  "income",
  "expense",
  "transfer",
]);

export const categoryKindEnum = pgEnum("category_kind", [
  "income",
  "expense",
  "both",
]);

export const splitTypeEnum = pgEnum("split_type", [
  "equal",
  "exact",
  "percent",
  "shares",
]);

// ============================================================
// Existing tables (kept additive during Phase 1 migration)
// ============================================================

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  fullName: text("full_name"),
  role: userRoleEnum("role").notNull().default("user"),
  defaultCurrency: char("default_currency", { length: 3 }).notNull().default("PKR"),
  disabled: boolean("disabled").notNull().default(false),
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

// LEGACY — kept so existing UI keeps working until Phase 1.3 cutover. Will be dropped in final cleanup.
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

// LEGACY — per-month categories, will be replaced by global `categoriesV2` + `budgets`.
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

// LEGACY
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

// ============================================================
// New SaaS tables
// ============================================================

export const sources = pgTable(
  "sources",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(),
    type: sourceTypeEnum("type").notNull(),
    currency: char("currency", { length: 3 }).notNull(),
    openingBalance: numeric("opening_balance", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    icon: varchar("icon", { length: 50 }),
    color: varchar("color", { length: 20 }).notNull().default("#7BCFA9"),
    archived: boolean("archived").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("idx_source_user").on(t.userId)]
);

// Global categories. Will be renamed `categories` in final cleanup (after old per-month one is dropped).
export const categoriesV2 = pgTable(
  "categories_v2",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(),
    kind: categoryKindEnum("kind").notNull().default("expense"),
    icon: varchar("icon", { length: 50 }),
    color: varchar("color", { length: 20 }).notNull().default("#7BCFA9"),
    sortOrder: integer("sort_order").notNull().default(0),
    archived: boolean("archived").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    unique("uk_user_category_name").on(t.userId, t.name),
    index("idx_category_v2_user").on(t.userId),
  ]
);

export const budgets = pgTable(
  "budgets",
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
      .references(() => categoriesV2.id, { onDelete: "cascade" }),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    unique("uk_user_month_category_budget").on(t.userId, t.monthId, t.categoryId),
    index("idx_budget_user_month").on(t.userId, t.monthId),
  ]
);

// ============================================================
// Shared expenses: groups + friendships (Splitwise feature)
// ============================================================

export const groups = pgTable("groups", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  defaultCurrency: char("default_currency", { length: 3 }).notNull(),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  simplifyDebts: boolean("simplify_debts").notNull().default(true),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const groupMembers = pgTable(
  "group_members",
  {
    id: serial("id").primaryKey(),
    groupId: integer("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow().notNull(),
    leftAt: timestamp("left_at", { withTimezone: true }),
  },
  (t) => [
    // Active membership uniqueness — a user can re-join after leaving but can't be active twice.
    uniqueIndex("uk_group_member_active")
      .on(t.groupId, t.userId)
      .where(sql`left_at IS NULL`),
    index("idx_group_member_user").on(t.userId),
  ]
);

// 1-to-1 friend relationship for non-group splits. Always stored with userAId < userBId.
export const friendships = pgTable(
  "friendships",
  {
    id: serial("id").primaryKey(),
    userAId: uuid("user_a_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    userBId: uuid("user_b_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    unique("uk_friendship_pair").on(t.userAId, t.userBId),
    index("idx_friendship_a").on(t.userAId),
    index("idx_friendship_b").on(t.userBId),
  ]
);

export const transactions = pgTable(
  "transactions",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sourceId: integer("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "restrict" }),
    destSourceId: integer("dest_source_id").references(() => sources.id, {
      onDelete: "restrict",
    }),
    kind: transactionKindEnum("kind").notNull(),
    categoryId: integer("category_id").references(() => categoriesV2.id, {
      onDelete: "set null",
    }),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    currency: char("currency", { length: 3 }).notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    description: varchar("description", { length: 255 }),
    notes: text("notes"),
    attachmentUrl: text("attachment_url"),
    // Shared expenses (Splitwise feature). For personal expenses these stay null/false.
    groupId: integer("group_id").references(() => groups.id, { onDelete: "set null" }),
    splitType: splitTypeEnum("split_type"),
    isShared: boolean("is_shared").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("idx_txn_user_occurred").on(t.userId, t.occurredAt),
    index("idx_txn_source").on(t.sourceId),
    index("idx_txn_dest_source").on(t.destSourceId),
    index("idx_txn_category").on(t.categoryId),
    index("idx_txn_user_kind").on(t.userId, t.kind),
    index("idx_txn_group").on(t.groupId),
  ]
);

// Participants of a shared expense — including the payer. For personal expenses created
// after this feature ships, a single row (payer alone, share = full amount) is written.
// Pre-feature expenses are backfilled by scripts/backfill-expense-participants.ts.
export const expenseParticipants = pgTable(
  "expense_participants",
  {
    id: serial("id").primaryKey(),
    transactionId: integer("transaction_id")
      .notNull()
      .references(() => transactions.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    shareAmount: numeric("share_amount", { precision: 14, scale: 2 }).notNull(),
    // Raw input that produced share_amount (percent, share count, exact amount) — stored so
    // the original split can be re-rendered for editing.
    shareInput: numeric("share_input", { precision: 14, scale: 4 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    unique("uk_participant_per_txn").on(t.transactionId, t.userId),
    index("idx_participant_user").on(t.userId),
    index("idx_participant_txn").on(t.transactionId),
  ]
);

// Recorded payment between two users that reduces their balance toward zero.
// Money movement happens outside the app — this only records the fact.
export const settlements = pgTable(
  "settlements",
  {
    id: serial("id").primaryKey(),
    fromUserId: uuid("from_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    toUserId: uuid("to_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    currency: char("currency", { length: 3 }).notNull(),
    groupId: integer("group_id").references(() => groups.id, { onDelete: "set null" }),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("idx_settlement_from").on(t.fromUserId),
    index("idx_settlement_to").on(t.toUserId),
    index("idx_settlement_group").on(t.groupId),
  ]
);

export const tags = pgTable(
  "tags",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 50 }).notNull(),
    color: varchar("color", { length: 20 }).notNull().default("#A98AD6"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [unique("uk_user_tag_name").on(t.userId, t.name)]
);

export const transactionTags = pgTable(
  "transaction_tags",
  {
    transactionId: integer("transaction_id")
      .notNull()
      .references(() => transactions.id, { onDelete: "cascade" }),
    tagId: integer("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.transactionId, t.tagId] })]
);

export const savingsGoals = pgTable(
  "savings_goals",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(),
    targetAmount: numeric("target_amount", { precision: 14, scale: 2 }).notNull(),
    currentAmount: numeric("current_amount", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    currency: char("currency", { length: 3 }).notNull(),
    deadline: date("deadline"),
    sourceId: integer("source_id").references(() => sources.id, {
      onDelete: "set null",
    }),
    icon: varchar("icon", { length: 50 }),
    color: varchar("color", { length: 20 }).notNull().default("#FFD86B"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("idx_goal_user").on(t.userId)]
);

export const fxRates = pgTable(
  "fx_rates",
  {
    base: char("base", { length: 3 }).notNull(),
    quote: char("quote", { length: 3 }).notNull(),
    rate: numeric("rate", { precision: 14, scale: 6 }).notNull(),
    asOf: date("as_of").notNull(),
  },
  (t) => [primaryKey({ columns: [t.base, t.quote, t.asOf] })]
);

export const passwordResets = pgTable(
  "password_resets",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("idx_pwreset_token").on(t.tokenHash),
    index("idx_pwreset_user").on(t.userId),
  ]
);

// ============================================================
// Views
// ============================================================

/**
 * One row per (user, expense, share). Drives all "personal spending" aggregations.
 *
 * Defined here for type-inference on the Drizzle side. The actual CREATE VIEW is run by
 * scripts/create-views.ts (drizzle-kit push doesn't manage views well; idempotent script).
 *
 * For a user with no shared expenses, this returns identical totals to
 * `SUM(transactions.amount) WHERE userId = X AND kind = 'expense'` because every existing
 * personal expense gets exactly one participant row (the payer) via the backfill.
 */
export const userExpenseShares = pgView("user_expense_shares", {
  userId: uuid("user_id").notNull(),
  transactionId: integer("transaction_id").notNull(),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  currency: char("currency", { length: 3 }).notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  categoryId: integer("category_id"),
  groupId: integer("group_id"),
  sourceId: integer("source_id").notNull(),
  payerId: uuid("payer_id").notNull(),
}).as(sql`
  SELECT
    ep.user_id,
    ep.transaction_id,
    ep.share_amount AS amount,
    t.currency,
    t.occurred_at,
    t.category_id,
    t.group_id,
    t.source_id,
    t.user_id AS payer_id
  FROM expense_participants ep
  JOIN transactions t ON t.id = ep.transaction_id
  WHERE t.kind = 'expense'
`);

// ============================================================
// Types
// ============================================================

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

export type Source = typeof sources.$inferSelect;
export type NewSource = typeof sources.$inferInsert;
export type CategoryV2 = typeof categoriesV2.$inferSelect;
export type NewCategoryV2 = typeof categoriesV2.$inferInsert;
export type Budget = typeof budgets.$inferSelect;
export type NewBudget = typeof budgets.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type Tag = typeof tags.$inferSelect;
export type NewTag = typeof tags.$inferInsert;
export type SavingsGoal = typeof savingsGoals.$inferSelect;
export type NewSavingsGoal = typeof savingsGoals.$inferInsert;
export type FxRate = typeof fxRates.$inferSelect;
export type NewFxRate = typeof fxRates.$inferInsert;
export type PasswordReset = typeof passwordResets.$inferSelect;
export type NewPasswordReset = typeof passwordResets.$inferInsert;

export type Group = typeof groups.$inferSelect;
export type NewGroup = typeof groups.$inferInsert;
export type GroupMember = typeof groupMembers.$inferSelect;
export type NewGroupMember = typeof groupMembers.$inferInsert;
export type Friendship = typeof friendships.$inferSelect;
export type NewFriendship = typeof friendships.$inferInsert;
export type ExpenseParticipant = typeof expenseParticipants.$inferSelect;
export type NewExpenseParticipant = typeof expenseParticipants.$inferInsert;
export type Settlement = typeof settlements.$inferSelect;
export type NewSettlement = typeof settlements.$inferInsert;
