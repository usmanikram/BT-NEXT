import { UserRound } from "lucide-react";

/** Coral rounded-square brand mark used top-left and on the login card. */
export function BrandMark({ size = "md" }: { size?: "md" | "lg" }) {
  const dim = size === "lg" ? "size-12" : "size-10";
  const icon = size === "lg" ? "size-6" : "size-5";
  return (
    <span
      className={`inline-flex ${dim} items-center justify-center rounded-2xl bg-coral text-white shadow-[0_8px_20px_rgba(255,107,92,0.35)]`}
      aria-hidden
    >
      <UserRound className={icon} strokeWidth={2.5} />
    </span>
  );
}
