import { Plus, UserRound } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Money } from "@/components/money";
import { ButtonLink } from "@/components/button-link";
import { EmptyState } from "@/components/empty-state";
import { getCurrentMonth, requireUserId } from "@/lib/session";
import { listFriends } from "@/lib/friend-service";

function displayName(name: string | null, email: string): string {
  return name?.trim() || email.split("@")[0];
}

export default async function FriendsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const userId = await requireUserId();
  const { month } = await searchParams;
  const current = await getCurrentMonth(month);
  const friends = await listFriends(userId);

  return (
    <PageShell title="Friends" currentYearMonth={current.yearMonth} eyebrow="1-to-1 splits">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-soft">
          {friends.length} {friends.length === 1 ? "friend" : "friends"}
        </p>
        <ButtonLink href="/friends/new">
          <Plus className="size-3.5" /> Add friend
        </ButtonLink>
      </div>

      {friends.length === 0 ? (
        <EmptyState
          icon={UserRound}
          title="No friends added"
          description="Add a registered user by email to start splitting 1-to-1 expenses with them."
          action={
            <ButtonLink href="/friends/new">
              <Plus className="size-3.5" /> Add friend
            </ButtonLink>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {friends.map((f) => {
            const entries = Object.entries(f.balanceByCurrency);
            return (
              <a
                key={f.friendUserId}
                href={`/friends/${f.friendUserId}`}
                className="rounded-3xl bg-card p-6 shadow-[0_4px_14px_rgba(31,26,20,0.04)] hover:shadow-[0_8px_18px_rgba(31,26,20,0.08)] transition-shadow"
              >
                <span className="inline-flex size-10 items-center justify-center rounded-xl bg-violet-500 text-white shadow-[0_6px_14px_rgba(139,92,246,0.25)]">
                  <UserRound className="size-5" />
                </span>
                <h3 className="mt-4 font-display text-lg font-semibold tracking-tight truncate">
                  {displayName(f.fullName, f.email)}
                </h3>
                <p className="text-xs text-ink-soft truncate">{f.email}</p>
                <div className="mt-4 space-y-1">
                  {entries.length === 0 ? (
                    <p className="text-sm text-ink-soft">Settled up</p>
                  ) : (
                    entries.map(([cur, amt]) => (
                      <div key={cur} className="text-sm">
                        {amt > 0 ? (
                          <span className="text-green">
                            Owes you <Money value={amt} prefix={cur} size="sm" />
                          </span>
                        ) : (
                          <span className="text-coral">
                            You owe <Money value={Math.abs(amt)} prefix={cur} size="sm" />
                          </span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </a>
            );
          })}
        </div>
      )}
    </PageShell>
  );
}
