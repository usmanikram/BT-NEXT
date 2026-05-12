import {
  Home,
  ShoppingCart,
  Fuel,
  Utensils,
  Zap,
  PlaySquare,
  Car,
  PiggyBank,
  Film,
  HeartPulse,
  Gift,
  Sparkles,
  Wallet,
  Coffee,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const MAP: Array<{ test: (s: string) => boolean; icon: LucideIcon }> = [
  { test: (s) => /rent|housing|mortgage|lease/.test(s), icon: Home },
  { test: (s) => /grocer|food|super[\s-]?market/.test(s), icon: ShoppingCart },
  { test: (s) => /fuel|petrol|gas|cng/.test(s), icon: Fuel },
  { test: (s) => /dining|restaurant|eat[\s-]?out/.test(s), icon: Utensils },
  { test: (s) => /coffee|cafe/.test(s), icon: Coffee },
  { test: (s) => /utilit|electric|water|gas[\s-]?bill|internet/.test(s), icon: Zap },
  { test: (s) => /subscription|netflix|spotify|saas/.test(s), icon: PlaySquare },
  { test: (s) => /transport|uber|careem|bus|taxi|car/.test(s), icon: Car },
  { test: (s) => /sav(e|ing)/.test(s), icon: PiggyBank },
  { test: (s) => /entertain|movie|cinema|game/.test(s), icon: Film },
  { test: (s) => /health|medic|pharma|doctor|gym/.test(s), icon: HeartPulse },
  { test: (s) => /gift|charity|donat/.test(s), icon: Gift },
  { test: (s) => /misc|other/.test(s), icon: Sparkles },
];

export function iconFor(name: string): LucideIcon {
  const s = name.toLowerCase();
  for (const m of MAP) if (m.test(s)) return m.icon;
  return Wallet;
}

export function CategoryIcon({
  name,
  color,
  size = "md",
  className,
}: {
  name: string;
  color: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const Icon = iconFor(name);
  const dim = { sm: "size-8", md: "size-10", lg: "size-12" }[size];
  const icon = { sm: "size-4", md: "size-5", lg: "size-6" }[size];
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-xl text-white shadow-sm",
        dim,
        className
      )}
      style={{
        background: color,
        boxShadow: `0 6px 14px ${color}40`,
      }}
      aria-hidden
    >
      <Icon className={icon} strokeWidth={2.25} />
    </span>
  );
}
