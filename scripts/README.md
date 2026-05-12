# Data migration: MySQL → Neon Postgres

One-shot importer to migrate the existing XAMPP `budget_tracker` MySQL data into the new Neon Postgres database.

## Preconditions

1. **The PHP app at `c:\xampp\htdocs\budget\` is untouched.** This script reads from MySQL but never writes to it.
2. **Neon Postgres schema is already pushed** (`npm run db:push`).
3. **The target user account exists in Postgres** — sign up via the new Next.js app at `/signup` first.
4. `.env.local` has both:
   - `DATABASE_URL` pointing at Neon
   - `MYSQL_HOST` / `MYSQL_PORT` / `MYSQL_USER` / `MYSQL_PASSWORD` / `MYSQL_DATABASE` pointing at local XAMPP MySQL

## Run

```bash
cd c:\xampp\htdocs\budget-next
npm run migrate:mysql -- --email you@example.com
```

The script:

- Looks up the target user in Postgres by email.
- Refuses to run if that user already has any months (idempotency guard — re-runs must start clean).
- Imports `BT_MONTH → months`, then `BT_INCOME → income`, then `BT_CATEGORY → categories` (building an id map), then `BT_EXPENSE → expenses`.
- Skips `BT_USER` (the old `admin` hash is not migrated — the user signs up fresh).
- Prints source vs target row counts and amount sums at the end.

## Verification

After it completes, log in via the web app, navigate to the dashboard for any imported month, and confirm the totals match the PHP app at `http://budget.local`.

## NEVER deploy this

The script and `MYSQL_*` env vars are local-only. Do not add `MYSQL_*` to the Vercel project environment.
