import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { fxRates } from "@/db/schema";

const STABLE_RATES: Record<string, Record<string, number>> = {
  // Fallback approximate rates so the app stays usable before the cron runs.
  // Cron updates fx_rates daily; convert() prefers DB values over these.
  USD: { PKR: 280, EUR: 0.92, GBP: 0.79, AED: 3.67, INR: 83, CAD: 1.36, AUD: 1.51, SAR: 3.75 },
  PKR: { USD: 1 / 280 },
};

function stableRate(from: string, to: string): number | null {
  if (from === to) return 1;
  if (STABLE_RATES[from]?.[to]) return STABLE_RATES[from][to];
  if (STABLE_RATES[to]?.[from]) return 1 / STABLE_RATES[to][from];
  // Pivot via USD
  if (from !== "USD" && to !== "USD") {
    const a = STABLE_RATES["USD"]?.[from] ? 1 / STABLE_RATES["USD"][from] : null;
    const b = STABLE_RATES["USD"]?.[to] ?? null;
    if (a !== null && b !== null) return a * b;
  }
  return null;
}

/**
 * Read the most recent rate for from→to from `fx_rates`. Falls back to USD pivot,
 * then to STABLE_RATES, then 1.0 (last-resort) so the app never crashes on a missing rate.
 */
export async function convert(amount: number, from: string, to: string): Promise<number> {
  const f = from.toUpperCase();
  const t = to.toUpperCase();
  if (f === t) return amount;

  // Direct
  const [direct] = await db
    .select({ rate: fxRates.rate })
    .from(fxRates)
    .where(and(eq(fxRates.base, f), eq(fxRates.quote, t)))
    .orderBy(sql`${fxRates.asOf} DESC`)
    .limit(1);
  if (direct) return amount * Number(direct.rate);

  // Reverse
  const [reverse] = await db
    .select({ rate: fxRates.rate })
    .from(fxRates)
    .where(and(eq(fxRates.base, t), eq(fxRates.quote, f)))
    .orderBy(sql`${fxRates.asOf} DESC`)
    .limit(1);
  if (reverse) return amount / Number(reverse.rate);

  // Pivot via USD
  if (f !== "USD" && t !== "USD") {
    const fromUsd = await convert(amount, f, "USD");
    return convert(fromUsd, "USD", t);
  }

  // Stable fallback
  const r = stableRate(f, t);
  return amount * (r ?? 1);
}

/**
 * Sum a list of {amount, currency} into a single target currency.
 */
export async function sumInCurrency(
  items: Array<{ amount: number; currency: string }>,
  target: string
): Promise<number> {
  let total = 0;
  for (const it of items) total += await convert(it.amount, it.currency, target);
  return total;
}

export async function upsertRate(base: string, quote: string, rate: number, asOf: string): Promise<void> {
  await db
    .insert(fxRates)
    .values({ base: base.toUpperCase(), quote: quote.toUpperCase(), rate: String(rate), asOf })
    .onConflictDoUpdate({
      target: [fxRates.base, fxRates.quote, fxRates.asOf],
      set: { rate: String(rate) },
    });
}
