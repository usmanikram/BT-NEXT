import Link from "next/link";
import { SignupForm } from "./signup-form";
import { APP_NAME } from "@/lib/constants";

export default function SignupPage() {
  return (
    <div>
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">{APP_NAME}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">Create your account</p>
      </div>
      <SignupForm />
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="text-foreground font-medium hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
