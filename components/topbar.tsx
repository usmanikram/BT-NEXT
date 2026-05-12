"use client";

import { signOut } from "next-auth/react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, LogOut, LayoutDashboard, Settings as SettingsIcon } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getNextYearMonth, getPrevYearMonth } from "@/lib/month";

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function Topbar({
  pageTitle,
  monthLabel,
  yearMonth,
  userName,
  eyebrow,
}: {
  pageTitle: React.ReactNode;
  monthLabel: string;
  yearMonth: string;
  userName: string;
  eyebrow?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();

  function switchMonth(ym: string) {
    document.cookie = `bt_current_month=${encodeURIComponent(ym)}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    const params = new URLSearchParams(window.location.search);
    params.set("month", ym);
    router.push(`${pathname}?${params.toString()}`);
    router.refresh();
  }

  return (
    <header className="px-6 sm:px-10 pt-8 pb-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          {eyebrow && (
            <p className="text-sm text-ink-soft mb-1">{eyebrow}</p>
          )}
          <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight leading-tight">
            {pageTitle}
          </h1>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* Month pill */}
          <div className="hidden sm:inline-flex items-center gap-1 rounded-full bg-card pl-2 pr-2 py-1 shadow-sm">
            <button
              type="button"
              onClick={() => switchMonth(getPrevYearMonth(yearMonth))}
              className="rounded-full p-1 text-ink-soft hover:bg-cream-soft hover:text-ink transition-colors"
              aria-label="Previous month"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="font-display text-sm font-medium px-2">{monthLabel}</span>
            <button
              type="button"
              onClick={() => switchMonth(getNextYearMonth(yearMonth))}
              className="rounded-full p-1 text-ink-soft hover:bg-cream-soft hover:text-ink transition-colors"
              aria-label="Next month"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>

          {/* User avatar */}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  title={userName}
                  className="inline-flex size-10 items-center justify-center rounded-full text-white text-sm font-semibold shadow-[0_8px_18px_rgba(139,92,246,0.25)] focus:outline-none focus:ring-2 focus:ring-ink/20"
                  style={{
                    background:
                      "linear-gradient(135deg, #FFB199 0%, #FF6B5C 40%, #A98AD6 100%)",
                  }}
                >
                  {initials(userName)}
                </button>
              }
            />
            <DropdownMenuContent align="end" className="min-w-48 rounded-xl">
              <DropdownMenuItem render={<Link href="/" />}>
                <LayoutDashboard className="size-3.5" /> Dashboard
              </DropdownMenuItem>
              <DropdownMenuItem render={<Link href="/settings" />}>
                <SettingsIcon className="size-3.5" /> Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/login" })}>
                <LogOut className="size-3.5" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
