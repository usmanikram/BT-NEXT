/**
 * Gemini-backed intent classifier. Wakes only when the regex router in
 * `intent-router.ts` returns null. The model gets the raw user message + the
 * system prompt below, and returns a JSON intent object that `dispatchIntent`
 * runs against existing DB-backed handlers.
 *
 * The LLM never authors monetary amounts — it only picks an intent shape.
 *
 * Requires GEMINI_API_KEY in the environment. Free tier on gemini-2.0-flash;
 * see https://aistudio.google.com/apikey to mint a key.
 */
import { GoogleGenAI, Type } from "@google/genai";
import { IntentSchema, type Intent } from "./intent-dispatcher";

const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

const SYSTEM_PROMPT = `You are an intent classifier for a personal-finance app called Pocket.

Given a user message, output ONE JSON object that picks the closest intent and
extracts any parameters present in the message. NEVER author monetary amounts —
the server computes them. If nothing matches, return {"intent":"unknown"}.

Today's date is ${new Date().toISOString().slice(0, 10)}. Use it to resolve
relative phrases like "this month", "last month", "two months ago" into a
yearMonth string of the form "YYYY-MM".

Available intents:
- total_balance — net worth / how much money the user has
- sources — list of wallets, bank accounts, cards
- month_summary — overall picture for one month (income, spent, saved)
  optional: yearMonth ("YYYY-MM")
- spending_by_category — top spending or spending on a specific category
  optional: yearMonth, category (single word/phrase, e.g. "food", "transport")
- recent_transactions — recent moves on the account
  optional: limit (1-50), kind ("income" | "expense" | "transfer")
- compare_months — current month vs previous month
- monthly_trend — last few months of income/spending
- goals — savings-goal progress
- groups — shared-expense groups the user belongs to
- friends — 1-to-1 split partners
- overall_balances — who owes whom across all groups and friends
- help — user asked what the assistant can do
- unknown — nothing else fits

Output ONLY the JSON object, no prose, no Markdown fences.`;

export async function classifyIntentGemini(message: string): Promise<Intent> {
  if (!ai) return { intent: "unknown" };
  try {
    const res = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: message,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            intent: {
              type: Type.STRING,
              enum: [
                "total_balance",
                "sources",
                "month_summary",
                "spending_by_category",
                "recent_transactions",
                "compare_months",
                "monthly_trend",
                "goals",
                "groups",
                "friends",
                "overall_balances",
                "help",
                "unknown",
              ],
            },
            yearMonth: { type: Type.STRING, nullable: true },
            category: { type: Type.STRING, nullable: true },
            limit: { type: Type.INTEGER, nullable: true },
            kind: {
              type: Type.STRING,
              enum: ["income", "expense", "transfer"],
              nullable: true,
            },
          },
          required: ["intent"],
        },
        temperature: 0,
      },
    });
    const text = res.text ?? "{}";
    const json = JSON.parse(text) as Record<string, unknown>;
    // Drop null fields so the discriminated union parses cleanly.
    const cleaned = Object.fromEntries(
      Object.entries(json).filter(([, v]) => v !== null && v !== undefined)
    );
    const parsed = IntentSchema.safeParse(cleaned);
    return parsed.success ? parsed.data : { intent: "unknown" };
  } catch (err) {
    console.error("gemini classifier error", err);
    return { intent: "unknown" };
  }
}
