import Link from "next/link";
import { LoginForm } from "./login-form";
import { APP_NAME } from "@/lib/constants";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const { from } = await searchParams;
  return (
    <div>
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">{APP_NAME}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">Sign in to your account</p>
      </div>
      <LoginForm callbackUrl={from ?? "/"} />
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="text-foreground font-medium hover:underline">
          Create one
        </Link>
      </p>
    </div>
  );
}
