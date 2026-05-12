import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SignupForm } from "./signup-form";
import { BrandMark } from "@/components/brand-mark";
import { APP_NAME } from "@/lib/constants";

export default function SignupPage() {
  return (
    <div className="rounded-3xl bg-gradient-to-br from-white to-cream-soft p-8 sm:p-10 shadow-[0_24px_60px_rgba(31,26,20,0.08)]">
      <div className="flex flex-col items-center text-center">
        <div className="flex items-center gap-3">
          <BrandMark size="md" />
          <span className="font-display text-3xl font-semibold tracking-tight">{APP_NAME}</span>
        </div>

        <h1 className="mt-8 font-display text-4xl font-semibold tracking-tight leading-[1.05]">
          Start a{" "}
          <em className="not-italic text-coral font-display italic">cozy</em>
          <br />
          budget.
        </h1>
        <p className="mt-3 text-sm text-ink-soft">Free, friendly, and yours.</p>
      </div>

      <div className="mt-8">
        <SignupForm />
      </div>

      <p className="mt-6 text-center text-sm text-ink-soft">
        Already saving?{" "}
        <Link
          href="/login"
          className="text-coral font-semibold hover:underline inline-flex items-center gap-1"
        >
          Sign in <ArrowRight className="size-3.5" />
        </Link>
      </p>
    </div>
  );
}
