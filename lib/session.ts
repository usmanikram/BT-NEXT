import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { months } from "@/db/schema";
import { COOKIE_CURRENT_MONTH } from "@/lib/constants";
import { getCurrentYearMonth, isValidYearMonth } from "@/lib/month";
import { monthLabel } from "@/lib/format";

export async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session.user.id;
}

export async function getCurrentUser() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session.user;
}

/**
 * Resolves the active month for the current request.
 * Precedence: ?month=YYYY-MM search param > cookie > current calendar month.
 * Upserts the months row for (user_id, year_month) if missing.
 */
export async function getCurrentMonth(searchYearMonth?: string): Promise<{
  monthId: number;
  yearMonth: string;
  label: string;
}> {
  const userId = await requireUserId();
  const cookieStore = await cookies();

  let yearMonth: string | undefined;
  if (isValidYearMonth(searchYearMonth)) {
    yearMonth = searchYearMonth!;
  } else {
    const c = cookieStore.get(COOKIE_CURRENT_MONTH)?.value;
    if (isValidYearMonth(c)) yearMonth = c!;
  }
  if (!yearMonth) yearMonth = getCurrentYearMonth();

  const existing = await db
    .select()
    .from(months)
    .where(and(eq(months.userId, userId), eq(months.yearMonth, yearMonth)))
    .limit(1);

  if (existing.length > 0) {
    return {
      monthId: existing[0].id,
      yearMonth: existing[0].yearMonth,
      label: existing[0].label,
    };
  }

  const label = monthLabel(yearMonth);
  const [inserted] = await db
    .insert(months)
    .values({ userId, yearMonth, label })
    .returning();

  return { monthId: inserted.id, yearMonth: inserted.yearMonth, label: inserted.label };
}

export async function setCurrentMonthCookie(yearMonth: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_CURRENT_MONTH, yearMonth, {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function readCurrentMonthCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  const c = cookieStore.get(COOKIE_CURRENT_MONTH)?.value;
  return isValidYearMonth(c) ? c! : null;
}
