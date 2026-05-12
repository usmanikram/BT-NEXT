"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Topbar({
  pageTitle,
  monthLabel,
  userName,
}: {
  pageTitle: string;
  monthLabel: string;
  userName: string;
}) {
  return (
    <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center justify-between px-6 sm:px-8 py-4">
        <div>
          <p className="text-xs text-muted-foreground">{monthLabel}</p>
          <h1 className="text-xl font-semibold tracking-tight">{pageTitle}</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden sm:inline text-sm text-muted-foreground">{userName}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => signOut({ callbackUrl: "/login" })}
            title="Sign out"
          >
            <LogOut className="size-3.5" />
            <span className="sr-only sm:not-sr-only">Sign out</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
