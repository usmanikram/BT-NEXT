"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { Sparkles, Send, User } from "lucide-react";
import { Button } from "@/components/ui/button";

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTED = [
  "What's my total balance?",
  "How much did I spend on food this month?",
  "How is this month vs last month?",
  "Show my recent transactions",
  "How am I doing on my goals?",
];

export function AssistantChat({ userName }: { userName: string }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [pending, startTransition] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || pending) return;
    const next: Msg[] = [...messages, { role: "user", content: trimmed }];
    setMessages(next);
    setInput("");
    startTransition(async () => {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const data = (await res.json()) as { reply?: string; error?: string };
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply ?? data.error ?? "Something went wrong." },
      ]);
    });
  }

  return (
    <div className="flex flex-col h-[calc(100vh-220px)] min-h-[400px] rounded-3xl bg-card overflow-hidden">
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-coral text-white shadow-[0_8px_18px_rgba(255,107,92,0.25)]">
              <Sparkles className="size-5" />
            </span>
            <h2 className="mt-4 font-display text-xl font-semibold">Ask me anything about your money</h2>
            <p className="mt-1 text-sm text-ink-soft max-w-md">
              I can read your accounts, transactions, budgets, and goals — but I can&apos;t change anything.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2 max-w-lg">
              {SUGGESTED.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-full bg-cream-soft px-3 py-1.5 text-xs hover:bg-ink/5"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={`flex gap-3 ${m.role === "user" ? "justify-end" : ""}`}>
              {m.role === "assistant" && (
                <span className="shrink-0 inline-flex size-8 items-center justify-center rounded-xl bg-coral text-white">
                  <Sparkles className="size-3.5" />
                </span>
              )}
              <div
                className={`max-w-[70%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                  m.role === "user" ? "bg-ink text-cream" : "bg-cream-soft"
                }`}
              >
                {m.content}
              </div>
              {m.role === "user" && (
                <span className="shrink-0 inline-flex size-8 items-center justify-center rounded-xl bg-cream-soft text-ink-soft">
                  <User className="size-3.5" />
                </span>
              )}
            </div>
          ))
        )}
        {pending && (
          <div className="flex gap-3">
            <span className="shrink-0 inline-flex size-8 items-center justify-center rounded-xl bg-coral text-white">
              <Sparkles className="size-3.5 animate-pulse" />
            </span>
            <div className="rounded-2xl bg-cream-soft px-4 py-2.5 text-sm text-ink-soft">Thinking…</div>
          </div>
        )}
        <div ref={endRef} />
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="border-t border-ink/5 p-4 flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Ask Pocket about your money, ${userName.split(/\s+/)[0]}…`}
          className="flex-1 rounded-full bg-cream-soft px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-coral/40"
          disabled={pending}
        />
        <Button type="submit" disabled={pending || !input.trim()} size="icon" className="size-10 rounded-full">
          <Send className="size-4" />
        </Button>
      </form>
    </div>
  );
}
