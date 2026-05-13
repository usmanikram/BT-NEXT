import { NextRequest } from "next/server";
import { upsertRate } from "@/lib/fx";

/**
 * Daily Vercel Cron job that fetches FX rates from open.er-api.com (free, no key)
 * and upserts them into the fx_rates table.
 *
 * Schedule via vercel.json:
 *   { "crons": [{ "path": "/api/cron/fx", "schedule": "0 6 * * *" }] }
 *
 * Auth: requires header `Authorization: Bearer <CRON_SECRET>` (Vercel sets this
 * automatically for built-in cron requests when CRON_SECRET env var is configured).
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  if (process.env.CRON_SECRET && auth !== expected) {
    return new Response("Unauthorized", { status: 401 });
  }

  let updated = 0;
  const todayUtc = new Date().toISOString().slice(0, 10);

  // Fetch USD-based rates (most stable hub).
  const res = await fetch("https://open.er-api.com/v6/latest/USD", {
    cache: "no-store",
  });
  if (!res.ok) {
    return new Response(`Upstream error: ${res.status}`, { status: 502 });
  }
  const data = (await res.json()) as {
    result?: string;
    base_code?: string;
    rates?: Record<string, number>;
  };
  if (data.result !== "success" || !data.rates) {
    return new Response("Bad response from FX provider", { status: 502 });
  }

  // Persist USD → X for the currencies we care about (anything the user uses).
  // For simplicity, store all rates returned.
  for (const [quote, rate] of Object.entries(data.rates)) {
    if (!quote || quote === "USD") continue;
    if (typeof rate !== "number" || !isFinite(rate) || rate <= 0) continue;
    await upsertRate("USD", quote, rate, todayUtc);
    updated++;
  }

  return Response.json({ ok: true, asOf: todayUtc, updated });
}
