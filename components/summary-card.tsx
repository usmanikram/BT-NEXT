import { Money } from "@/components/money";
import { cn } from "@/lib/utils";

export function SummaryCard({
  label,
  value,
  meta,
  prefix,
  blobColor = "#7BCFA9",
}: {
  label: string;
  value: number;
  meta?: string;
  prefix?: string;
  /** Color of the decorative blob in the top-right corner. */
  blobColor?: string;
}) {
  return (
    <div className="relative rounded-2xl bg-card p-5 overflow-hidden shadow-[0_4px_14px_rgba(31,26,20,0.04)]">
      {/* Decorative tinted blob in top-right corner */}
      <div
        className="pointer-events-none absolute -top-6 -right-6 size-28 rounded-full opacity-40"
        style={{
          background: blobColor,
          filter: "blur(8px)",
        }}
        aria-hidden
      />
      <div className="relative">
        <p className={cn("text-sm font-medium text-ink-soft")}>{label}</p>
        <div className="mt-2">
          <Money value={value} size="lg" {...(prefix ? { prefix } : {})} />
        </div>
        {meta && <p className="mt-1.5 text-xs text-ink-soft">{meta}</p>}
      </div>
    </div>
  );
}
