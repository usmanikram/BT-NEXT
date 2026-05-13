"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Home,
  Wallet,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  Landmark,
  ArrowLeftRight,
  Target,
  Sparkles,
  Users,
  UserRound,
  Scale,
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
    { href: "/", label: "Home", icon: Home, match: "/" },
    { href: "/sources", label: "Sources", icon: Landmark, match: "/sources" },
    { href: "/transactions", label: "Transactions", icon: ArrowLeftRight, match: "/transactions" },
    { href: "/categories", label: "Pockets", icon: Wallet, match: "/categories" },
    { href: "/groups", label: "Groups", icon: Users, match: "/groups" },
    { href: "/friends", label: "Friends", icon: UserRound, match: "/friends" },
    { href: "/balances", label: "Balances", icon: Scale, match: "/balances" },
    { href: "/goals", label: "Goals", icon: Target, match: "/goals" },
    { href: "/assistant", label: "Assistant", icon: Sparkles, match: "/assistant" },
    { href: "/reports", label: "Reports", icon: BarChart3, match: "/reports" },
    { href: "/settings", label: "Settings", icon: Settings, match: "/settings" },
  ];

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 bg-sidebar text-sidebar-foreground z-30">
      <div className="px-6 pt-7 pb-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="inline-flex size-8 items-center justify-center rounded-xl bg-coral text-white">
            <Wallet className="size-4" strokeWidth={2.5} />
          </span>
          <span className="font-display text-lg font-semibold tracking-tight">{APP_NAME}</span>
        </Link>
      </div>

      <div className="px-3 pb-3">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            className="rounded-md p-1.5 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
            onClick={() => switchMonth(getPrevYearMonth(currentYearMonth))}
            aria-label="Previous month"
          >
            <ChevronLeft className="size-3.5" />
          </button>
          <div className="relative flex-1">
            <select
              className="w-full appearance-none rounded-md bg-sidebar-accent px-3 py-1.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-sidebar-ring/40 text-sidebar-foreground"
              value={currentYearMonth}
              onChange={(e) => switchMonth(e.target.value)}
            >
              {months.map((m) => (
                <option key={m.yearMonth} value={m.yearMonth} className="bg-ink text-cream">
                  {m.label}
                </option>
              ))}
              {!months.find((m) => m.yearMonth === currentYearMonth) && (
                <option value={currentYearMonth} className="bg-ink text-cream">
                  {currentYearMonth}
                </option>
              )}
            </select>
          </div>
          <button
            type="button"
            className="rounded-md p-1.5 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
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
                "group flex items-center gap-3 rounded-lg px-3 py-2 my-0.5 text-sm transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-foreground font-medium"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
              )}
            >
              <Icon
                className={cn(
                  "size-4 shrink-0 transition-colors",
                  active ? "text-coral" : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground"
                )}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mx-3 mb-5 rounded-2xl bg-gradient-to-br from-yellow to-coral/70 px-4 py-4 text-ink shadow-[0_8px_20px_rgba(255,216,107,0.25)]">
        <p className="text-[10px] uppercase tracking-wider text-ink/70 font-semibold">Streak</p>
        <p className="font-display text-2xl font-semibold leading-none mt-1">14</p>
        <p className="mt-1 text-xs text-ink/80">days under budget 🎉</p>
        <div className="mt-3 flex gap-1">
          {Array.from({ length: 14 }).map((_, i) => (
            <span key={i} className="size-1.5 rounded-full bg-ink/60" />
          ))}
        </div>
      </div>
    </aside>
  );
}
