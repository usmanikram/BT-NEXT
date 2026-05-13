import { createElement } from "react";
import {
  Wallet,
  Landmark,
  CreditCard,
  PiggyBank,
  Smartphone,
  Globe2,
  Banknote,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type SourceType =
  | "wallet"
  | "bank"
  | "credit_card"
  | "debit_card"
  | "easypaisa"
  | "jazzcash"
  | "payoneer"
  | "wise"
  | "savings";

export const SOURCE_TYPE_OPTIONS: Array<{ value: SourceType; label: string }> = [
  { value: "wallet", label: "Wallet (cash)" },
  { value: "bank", label: "Bank account" },
  { value: "credit_card", label: "Credit card" },
  { value: "debit_card", label: "Debit card" },
  { value: "easypaisa", label: "Easypaisa" },
  { value: "jazzcash", label: "JazzCash" },
  { value: "payoneer", label: "Payoneer" },
  { value: "wise", label: "Wise" },
  { value: "savings", label: "Savings" },
];

const ICONS: Record<SourceType, LucideIcon> = {
  wallet: Wallet,
  bank: Landmark,
  credit_card: CreditCard,
  debit_card: CreditCard,
  easypaisa: Smartphone,
  jazzcash: Smartphone,
  payoneer: Globe2,
  wise: Globe2,
  savings: PiggyBank,
};

export function iconForSourceType(type: string): LucideIcon {
  return ICONS[type as SourceType] ?? Banknote;
}

export function sourceTypeLabel(type: string): string {
  return SOURCE_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type;
}

export function SourceIcon({
  type,
  color,
  size = "md",
  className,
}: {
  type: string;
  color: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const iconType = iconForSourceType(type);
  const dim = { sm: "size-8", md: "size-10", lg: "size-12" }[size];
  const iconClass = { sm: "size-4", md: "size-5", lg: "size-6" }[size];
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
      {createElement(iconType, { className: iconClass, strokeWidth: 2.25 })}
    </span>
  );
}
