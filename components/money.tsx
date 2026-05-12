import { cn } from "@/lib/utils";

/**
 * Renders a currency amount with a small "Rs" prefix and a large display number.
 * Inspired by the Mochi mockup where the prefix is muted and the number is the hero.
 */
export function Money({
  value,
  size = "md",
  prefix = "Rs",
  className,
  showDecimals = true,
}: {
  value: number;
  size?: "sm" | "md" | "lg" | "xl" | "hero";
  prefix?: string;
  className?: string;
  showDecimals?: boolean;
}) {
  const sizes = {
    sm: { wrap: "gap-1 text-base", pre: "text-xs", num: "text-base font-display font-semibold" },
    md: { wrap: "gap-1 text-xl", pre: "text-xs", num: "text-2xl font-display font-semibold" },
    lg: { wrap: "gap-1.5", pre: "text-sm", num: "text-3xl font-display font-semibold" },
    xl: { wrap: "gap-2", pre: "text-base", num: "text-4xl font-display font-semibold tracking-tight" },
    hero: { wrap: "gap-2", pre: "text-xl", num: "text-6xl font-display font-semibold tracking-tight" },
  }[size];

  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
  }).format(value || 0);

  return (
    <span className={cn("inline-flex items-baseline", sizes.wrap, className)}>
      <span className={cn(sizes.pre, "text-current/70 font-medium")}>{prefix}</span>
      <span className={cn(sizes.num, "tabular-nums")}>{formatted}</span>
    </span>
  );
}
