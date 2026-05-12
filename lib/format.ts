import { format, parseISO } from "date-fns";
import { CURRENCY_SYMBOL } from "./constants";

export function formatMoney(amount: number | string | null | undefined): string {
  const n = typeof amount === "string" ? parseFloat(amount) : amount ?? 0;
  return (
    CURRENCY_SYMBOL +
    new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n || 0)
  );
}

export function formatDate(
  date: string | Date | null | undefined,
  pattern: string = "dd MMM yyyy"
): string {
  if (!date) return "";
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, pattern);
}

export function monthLabel(yearMonth: string): string {
  return format(parseISO(`${yearMonth}-01`), "MMMM yyyy");
}
