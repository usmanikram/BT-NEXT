"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Coins,
  Tags,
  Receipt,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { APP_NAME } from "@/lib/constants";
import { getNextYearMonth, getPrevYearMonth } from "@/lib/month";

type MonthOption = { yearMonth: string; label: string };

export function Sidebar({
  months,
  currentYearMonth,
}: {
  months: MonthOption[];
  currentYearMonth: string;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const isActive = (prefix: string) =>
    prefix === "/" ? pathname === "/" : pathname.startsWith(prefix);

  function switchMonth(ym: string) {
    document.cookie = `bt_current_month=${encodeURIComponent(ym)}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    const params = new URLSearchParams(window.location.search);
    params.set("month", ym);
    router.push(`${pathname}?${params.toString()}`);
    router.refresh();
  }

  const nav = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard, match: "/" },
    { href: "/income", label: "Income", icon: Coins, match: "/income" },
    { href: "/categories", label: "Categories", icon: Tags, match: "/categories" },
    { href: "/expenses", label: "Expenses", icon: Receipt, match: "/expenses" },
    { href: "/reports", label: "Reports", icon: BarChart3, match: "/reports" },
    { href: "/settings", label: "Settings", icon: Settings, match: "/settings" },
  ];

  return (
    <aside className="hidden md:flex md:w-60 md:flex-col md:fixed md:inset-y-0 border-r bg-sidebar">
      <div className="px-5 pt-6 pb-5">
        <Link href="/" className="text-base font-semibold tracking-tight">
          {APP_NAME}
        </Link>
      </div>

      <div className="px-3 pb-3">
        <p className="px-2 pb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Period
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            onClick={() => switchMonth(getPrevYearMonth(currentYearMonth))}
            aria-label="Previous month"
          >
            <ChevronLeft className="size-3.5" />
          </button>
          <div className="relative flex-1">
            <select
              className="w-full appearance-none rounded-md border bg-background px-2.5 py-1.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-ring/30"
              value={currentYearMonth}
              onChange={(e) => switchMonth(e.target.value)}
            >
              {months.map((m) => (
                <option key={m.yearMonth} value={m.yearMonth}>
                  {m.label}
                </option>
              ))}
              {!months.find((m) => m.yearMonth === currentYearMonth) && (
                <option value={currentYearMonth}>{currentYearMonth}</option>
              )}
            </select>
          </div>
          <button
            type="button"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            onClick={() => switchMonth(getNextYearMonth(currentYearMonth))}
            aria-label="Next month"
          >
            <ChevronRight className="size-3.5" />
          </button>
        </div>
      </div>

      <nav className="flex-1 px-3 py-2">
        {nav.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.match);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center gap-2.5 rounded-md px-2.5 py-1.5 my-0.5 text-sm transition-colors",
                active
                  ? "bg-accent text-foreground font-medium"
                  : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
              )}
            >
              <Icon
                className={cn(
                  "size-4 shrink-0 transition-colors",
                  active ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
                )}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
