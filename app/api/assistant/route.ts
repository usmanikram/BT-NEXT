import { NextRequest } from "next/server";
import { requireUserId } from "@/lib/session";
import { chat, type ChatMessage } from "@/lib/assistant";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const userId = await requireUserId();
  const body = (await req.json()) as { messages?: ChatMessage[] };
  const messages = (body.messages ?? []).filter(
    (m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string"
  );
  if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
    return Response.json({ error: "Last message must be from the user" }, { status: 400 });
  }
  try {
    const reply = await chat(userId, messages);
    return Response.json({ reply });
  } catch (err) {
    console.error("assistant error", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Assistant failed" },
      { status: 500 }
    );
  }
}
