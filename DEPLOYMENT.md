# Deployment Guide — budget-next

This guide walks you through deploying the budget tracker to **Vercel** with the existing **Neon Postgres** database, pushing the source to a public **GitHub** repo under the `usmanikram` account.

> **Where things stand right now**
> - All 78 new files are already **staged** (`git add` was run for you).
> - The commit itself did **not** complete because of a stale `.git/index.lock` file the assistant could not delete from inside its sandbox. You'll fix that in Step 1.
> - `.env.local` contains the `DATABASE_URL` and `AUTH_SECRET`. It is already covered by `.gitignore` (`.env*`), so secrets will **not** be pushed.

---

## Step 0 — Prerequisites (one-time)

On your Windows machine:

1. **Git** — already installed (the repo exists).
2. **Node 20+** — required by Next 16. Check with `node --version`.
3. **A GitHub account named `usmanikram`** — sign in at https://github.com.
4. **A Vercel account** — sign up at https://vercel.com using "Continue with GitHub" so it can read your repos.
5. **A Neon account** — you already have one (your `.env.local` references `ep-curly-surf-apedtxcv` in `us-east-1`).

Open **PowerShell** (or Git Bash) and `cd C:\xampp\htdocs\budget-next` before running anything below.

---

## Step 1 — Finish the local commit and run a sanity build

```powershell
# 1a. Clear the stale lock left by the sandbox
del .git\index.lock

# 1b. Confirm secrets are not staged (you should see NO .env.local in this list)
git status

# 1c. Commit the staged work
git commit -m "Add budget tracker app: auth, categories, expenses, income, reports"

# 1d. Sanity build (catches any prod-breaking changes before Vercel does)
npm run build
```

If `npm run build` fails, fix locally before continuing. If it succeeds, you'll see `Compiled successfully`.

---

## Step 2 — Create the GitHub repo and push

You have two options. **Pick one.**

### Option A — Browser + Git (simplest, no extra tools)

1. Go to https://github.com/new (signed in as `usmanikram`).
2. **Repository name:** `budget-next`
3. **Visibility:** Public
4. **Do NOT** check "Add a README", "Add .gitignore", or "Choose a license" — the repo already has these files.
5. Click **Create repository**.
6. GitHub will show you a "…or push an existing repository from the command line" block. Run those commands in PowerShell:

   ```powershell
   git remote add origin https://github.com/usmanikram/budget-next.git
   git branch -M main
   git push -u origin main
   ```

   You'll be prompted for credentials. If you have 2FA on (you should), use a **Personal Access Token** instead of your password — create one at https://github.com/settings/tokens (classic, scopes: `repo`).

### Option B — GitHub CLI (if you have `gh` installed)

```powershell
gh auth login                                # log in as usmanikram
gh repo create usmanikram/budget-next --public --source=. --remote=origin --push
```

After either option, refresh https://github.com/usmanikram/budget-next — your code should be there. **Verify that `.env.local` is NOT in the file list.** If it is, stop and contact me — secrets leaked and the Neon password needs rotating.

---

## Step 3 — Confirm the Neon database is ready

You're reusing the existing Neon database from `.env.local`:

```
ep-curly-surf-apedtxcv.c-7.us-east-1.aws.neon.tech / neondb
```

Because the local dev app has been writing to this DB, the Drizzle schema should already be in place. Quick check:

```powershell
# Push schema (idempotent — does nothing if already in sync)
npm run db:push
```

If you'd rather have a **separate production branch** in Neon (recommended for real-world use, optional for now):

1. Go to https://console.neon.tech → your project.
2. Sidebar → **Branches** → **Create branch** → name it `production` (parent: `main`).
3. Copy the new connection string from the branch's **Connection Details** page (use the *pooled* connection string for Vercel).
4. Use that as `DATABASE_URL` in Step 4 instead of the dev one.

> **Tip for Vercel + Neon:** always use the **pooled** connection string in serverless environments. It ends with `-pooler` in the hostname. Your current `.env.local` uses the direct (non-pooled) endpoint, which can exhaust connections under load on Vercel.

---

## Step 4 — Deploy to Vercel

1. Go to https://vercel.com/new.
2. Under **Import Git Repository**, find `usmanikram/budget-next` and click **Import**.
   - If Vercel doesn't see the repo, click **Adjust GitHub App Permissions** and grant access to the repo.
3. **Configure Project** screen:
   - **Framework Preset:** Next.js (auto-detected).
   - **Root Directory:** `.` (leave as-is).
   - **Build & Output Settings:** leave defaults.
   - **Environment Variables** — add these three. Get the values from your `.env.local`:

     | Name              | Value                                                                                              | Environments        |
     | ----------------- | -------------------------------------------------------------------------------------------------- | ------------------- |
     | `DATABASE_URL`    | Your Neon pooled connection string (see Step 3 tip) — `postgresql://neondb_owner:…/neondb?sslmode=require` | Production, Preview |
     | `AUTH_SECRET`     | The value from your `.env.local` (`vN8GmCzpyPROyAr6rUqliDYELDWG9YtVw6Pj1k8uysk=`) — or regenerate: `openssl rand -base64 32` | Production, Preview |
     | `AUTH_TRUST_HOST` | `true`                                                                                             | Production, Preview |

   - **Do NOT** set the `MYSQL_*` variables on Vercel — those are only for the local one-shot migration script.
4. Click **Deploy**.
5. First build takes ~2–3 minutes. When it's done, Vercel gives you a `*.vercel.app` URL.

---

## Step 5 — Post-deploy smoke test

Open the Vercel URL and verify:

1. The **landing/login page** loads (no 500 error).
2. You can **sign up** with a new email → it returns you to a logged-in state.
3. You can **add a category, expense, and income entry**, and the reports page renders.
4. Sign out and sign back in.

If anything 500s, check **Vercel → your project → Logs → Runtime Logs**. The most common production-only issues are:
- Missing env var → "DATABASE_URL is not set" → re-check Step 4.
- Connection pool errors under load → switch to the pooled Neon connection string.
- Auth.js issues on a Vercel preview URL → confirm `AUTH_TRUST_HOST=true` is set.

---

## Step 6 — Ongoing workflow

From now on:

```powershell
git add .
git commit -m "your change"
git push
```

Vercel auto-deploys every push to `main` to production, and every PR branch to a preview URL. Schema changes need `npm run db:push` run against the production Neon DB before the deploy goes live (or, better, generate migrations with `npm run db:generate` and apply them in a CI step).

---

## Quick reference

| What                  | Where                                                                  |
| --------------------- | ---------------------------------------------------------------------- |
| GitHub repo           | https://github.com/usmanikram/budget-next                              |
| Vercel project        | https://vercel.com/dashboard → `budget-next`                           |
| Neon console          | https://console.neon.tech                                              |
| Production URL        | Shown in Vercel after first deploy                                     |
| Rotate `AUTH_SECRET`  | `openssl rand -base64 32` → update on Vercel → redeploy                |
| Rotate Neon password  | Neon console → Roles → reset password → update `DATABASE_URL` on Vercel |
