"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changePasswordAction } from "@/actions/user";

export function ChangePasswordForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const data = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await changePasswordAction(data);
      if (!result.ok) {
        setError(result.error);
        toast.error(result.error);
        return;
      }
      toast.success("Password changed.");
      formRef.current?.reset();
    });
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="currentPassword" className="text-xs uppercase tracking-wider text-ink-soft">
          Current password
        </Label>
        <Input id="currentPassword" name="currentPassword" type="password" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="newPassword" className="text-xs uppercase tracking-wider text-ink-soft">
          New password
        </Label>
        <Input id="newPassword" name="newPassword" type="password" minLength={6} required />
        <p className="text-xs text-ink-soft">At least 6 characters.</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirmPassword" className="text-xs uppercase tracking-wider text-ink-soft">
          Confirm new
        </Label>
        <Input id="confirmPassword" name="confirmPassword" type="password" required />
      </div>
      {error && <p className="text-sm text-coral">{error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Updating…" : "Update password"}
      </Button>
    </form>
  );
}
