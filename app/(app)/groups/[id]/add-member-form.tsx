"use client";

import { useTransition, useRef } from "react";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";
import { Input } from "@/components/ui/input";

export function AddMemberForm({
  action,
}: {
  action: (formData: FormData) => Promise<{ ok: boolean; error?: string } | void>;
}) {
  const ref = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startTransition(async () => {
      const r = await action(data);
      if (r && "ok" in r && !r.ok) {
        toast.error(r.error ?? "Could not add member");
        return;
      }
      toast.success("Member added");
      ref.current?.reset();
    });
  }

  return (
    <form ref={ref} onSubmit={onSubmit} className="flex gap-2">
      <Input
        name="email"
        type="email"
        placeholder="friend@example.com"
        required
        className="flex-1 h-9 text-sm"
      />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-1 rounded-md bg-ink text-cream px-3 py-1.5 text-xs font-medium disabled:opacity-50"
      >
        <UserPlus className="size-3.5" /> {pending ? "Adding…" : "Add"}
      </button>
    </form>
  );
}
