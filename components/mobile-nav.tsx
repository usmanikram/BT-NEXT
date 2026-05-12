"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Coins, Wallet, Receipt, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/", label: "Home", icon: Home, match: (p: string) => p === "/" },
  { href: "/income", label: "Income", icon: Coins, match: (p: string) => p.startsWith("/income") },
  { href: "/categories", label: "Pockets", icon: Wallet, match: (p: string) => p.startsWith("/categories") },
  { href: "/expenses", label: "Spends", icon: Receipt, match: (p: string) => p.startsWith("/expenses") },
  { href: "/reports", label: "Reports", icon: BarChart3, match: (p: string) => p.startsWith("/reports") },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav
      className="md:hidden fixed bottom-3 left-3 right-3 z-40 rounded-2xl bg-ink text-cream shadow-[0_12px_30px_rgba(31,26,20,0.25)]"
      aria-label="Primary"
    >
      <ul className="grid grid-cols-5">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = tab.match(pathname);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 py-2.5 text-xs font-medium transition-colors",
                  active ? "text-coral" : "text-cream/70 hover:text-cream"
                )}
              >
                <Icon className="size-5" strokeWidth={active ? 2.5 : 2} />
                <span>{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
