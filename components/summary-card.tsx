import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export function SummaryCard({
  label,
  value,
  icon: Icon,
  tone = "neutral",
  valueClass,
}: {
  label: string;
  value: string;
  icon?: LucideIcon;
  tone?: "neutral" | "success" | "danger" | "warning";
  valueClass?: string;
}) {
  const toneClass = {
    neutral: "",
    success: "text-emerald-700",
    danger: "text-rose-600",
    warning: "text-amber-700",
  }[tone];

  return (
    <div className="rounded-xl border bg-card p-5 transition-colors">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
        {Icon && <Icon className="size-4 text-muted-foreground/60" />}
      </div>
      <p
        className={cn(
          "mt-3 text-2xl font-semibold tracking-tight font-mono tabular-nums",
          toneClass,
          valueClass
        )}
      >
        {value}
      </p>
    </div>
  );
}
