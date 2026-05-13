import Link from "next/link";
import { redirect } from "next/navigation";
import { Shield } from "lucide-react";
import { auth } from "@/lib/auth";
import { APP_NAME } from "@/lib/constants";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "admin") redirect("/");

  return (
    <div className="min-h-screen bg-cream-soft">
      <header className="border-b border-ink/5 bg-ink text-cream">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="size-5 text-coral" />
            <span className="font-display text-lg font-semibold tracking-tight">
              {APP_NAME} · Admin
            </span>
          </div>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/admin" className="hover:text-coral">Overview</Link>
            <Link href="/admin/users" className="hover:text-coral">Users</Link>
            <Link href="/" className="text-cream/60 hover:text-cream">← Back to app</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </div>
  );
}
