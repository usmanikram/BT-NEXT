import Link from "next/link";
import { ResetForm } from "./reset-form";
import { BrandMark } from "@/components/brand-mark";
import { APP_NAME } from "@/lib/constants";

export default async function ResetPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return (
    <div className="rounded-3xl bg-gradient-to-br from-white to-cream-soft p-8 sm:p-10 shadow-[0_24px_60px_rgba(31,26,20,0.08)]">
      <div className="flex flex-col items-center text-center">
        <div className="flex items-center gap-3">
          <BrandMark size="md" />
          <span className="font-display text-3xl font-semibold tracking-tight">{APP_NAME}</span>
        </div>
        <h1 className="mt-8 font-display text-3xl font-semibold tracking-tight">New password</h1>
        <p className="mt-3 text-sm text-ink-soft max-w-sm">
          Set a new password and you&apos;re back in.
        </p>
      </div>
      <div className="mt-8">
        <ResetForm token={token} />
      </div>
      <p className="mt-6 text-center text-sm text-ink-soft">
        <Link href="/login" className="text-coral font-semibold hover:underline">
          Back to login
        </Link>
      </p>
    </div>
  );
}
