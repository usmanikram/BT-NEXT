import { addMonths, endOfMonth, format, parseISO, startOfMonth, subMonths } from "date-fns";

export function getCurrentYearMonth(): string {
  return format(new Date(), "yyyy-MM");
}

export function getNextYearMonth(yearMonth: string): string {
  return format(addMonths(parseISO(`${yearMonth}-01`), 1), "yyyy-MM");
}

export function getPrevYearMonth(yearMonth: string): string {
  return format(subMonths(parseISO(`${yearMonth}-01`), 1), "yyyy-MM");
}

export function getMonthStart(yearMonth: string): string {
  return format(startOfMonth(parseISO(`${yearMonth}-01`)), "yyyy-MM-dd");
}

export function getMonthEnd(yearMonth: string): string {
  return format(endOfMonth(parseISO(`${yearMonth}-01`)), "yyyy-MM-dd");
}

export function isValidYearMonth(s: string | null | undefined): boolean {
  return !!s && /^\d{4}-\d{2}$/.test(s);
}
