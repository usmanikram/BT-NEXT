/**
 * Pocket assistant — three-layer chain:
 *   1. Regex router (`routeIntent`) — fast, deterministic, free.
 *   2. Gemini classifier (`classifyIntentGemini`) — fallback for paraphrases. Only
 *      picks an intent JSON; all numbers come from DB-backed handlers.
 *   3. Help string — when both layers fail.
 *
 * The LLM step is skipped silently if `GEMINI_API_KEY` is unset, so the chain
 * degrades back to today's behavior with no errors.
 */
import { routeIntent, noMatchHelp } from "@/lib/intent-router";
import { classifyIntentGemini } from "@/lib/llm-gemini";
import { dispatchIntent } from "@/lib/intent-dispatcher";

export type ChatMessage = { role: "user" | "assistant"; content: string };

export async function chat(userId: string, messages: ChatMessage[]): Promise<string> {
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  if (!lastUser) return "Ask me anything about your money.";

  const regexAnswer = await routeIntent(userId, lastUser.content);
  if (regexAnswer !== null) return regexAnswer;

  const intent = await classifyIntentGemini(lastUser.content);
  if (intent.intent === "unknown") return noMatchHelp();
  return dispatchIntent(userId, intent);
}
