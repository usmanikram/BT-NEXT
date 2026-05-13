/**
 * Pocket assistant — heuristic intent router. No external LLM dependency.
 *
 * Routes the latest user message through `routeIntent`, which pattern-matches against
 * known question shapes and dispatches to existing service functions.
 *
 * If you want richer free-form answers later, swap `chat()` for an LLM-backed
 * implementation. The chat UI doesn't change.
 */
import { routeIntent } from "@/lib/intent-router";

export type ChatMessage = { role: "user" | "assistant"; content: string };

export async function chat(userId: string, messages: ChatMessage[]): Promise<string> {
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  if (!lastUser) return "Ask me anything about your money.";
  return routeIntent(userId, lastUser.content);
}
