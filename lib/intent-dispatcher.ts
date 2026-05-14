/**
 * Intent schema + dispatcher for the Pocket assistant.
 *
 * The regex router in `intent-router.ts` and the Gemini classifier in `llm-gemini.ts`
 * both produce values shaped like `Intent`. `dispatchIntent` runs the matching handler
 * so the LLM never has to author monetary amounts — it only picks the intent shape.
 */
import { z } from "zod";
import {
  answerTotalBalance,
  answerSources,
  answerMonthSummary,
  answerSpendingByCategory,
  answerRecentTransactions,
  answerCompareMonths,
  answerMonthlyTrend,
  answerGoals,
  answerGroups,
  answerFriends,
  answerOverallBalances,
  answerHelp,
} from "./intent-router";
import { getCurrentYearMonth, isValidYearMonth } from "./month";

export const IntentSchema = z.discriminatedUnion("intent", [
  z.object({ intent: z.literal("total_balance") }),
  z.object({ intent: z.literal("sources") }),
  z.object({
    intent: z.literal("month_summary"),
    yearMonth: z.string().optional(),
  }),
  z.object({
    intent: z.literal("spending_by_category"),
    yearMonth: z.string().optional(),
    category: z.string().optional(),
  }),
  z.object({
    intent: z.literal("recent_transactions"),
    limit: z.number().int().min(1).max(50).optional(),
    kind: z.enum(["income", "expense", "transfer"]).optional(),
  }),
  z.object({ intent: z.literal("compare_months") }),
  z.object({ intent: z.literal("monthly_trend") }),
  z.object({ intent: z.literal("goals") }),
  z.object({ intent: z.literal("groups") }),
  z.object({ intent: z.literal("friends") }),
  z.object({ intent: z.literal("overall_balances") }),
  z.object({ intent: z.literal("help") }),
  z.object({ intent: z.literal("unknown") }),
]);

export type Intent = z.infer<typeof IntentSchema>;

function resolveYM(ym: string | undefined): string {
  if (ym && isValidYearMonth(ym)) return ym;
  return getCurrentYearMonth();
}

export async function dispatchIntent(userId: string, intent: Intent): Promise<string> {
  switch (intent.intent) {
    case "total_balance":
      return answerTotalBalance(userId);
    case "sources":
      return answerSources(userId);
    case "month_summary":
      return answerMonthSummary(userId, resolveYM(intent.yearMonth));
    case "spending_by_category":
      return answerSpendingByCategory(userId, resolveYM(intent.yearMonth), intent.category);
    case "recent_transactions":
      return answerRecentTransactions(userId, intent.limit ?? 10, intent.kind);
    case "compare_months":
      return answerCompareMonths(userId);
    case "monthly_trend":
      return answerMonthlyTrend(userId);
    case "goals":
      return answerGoals(userId);
    case "groups":
      return answerGroups(userId);
    case "friends":
      return answerFriends(userId);
    case "overall_balances":
      return answerOverallBalances(userId);
    case "help":
      return answerHelp();
    case "unknown":
      return answerHelp();
  }
}
