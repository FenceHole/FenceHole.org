# FenceHole Hub — Full App (verified build)

This folder is the complete FenceHole Hub + HQ app, ready to drop into the
`FenceHole/Fence-Hole-Hub` repo. It replaces the placeholder scaffold that is
deployed right now.

## What's inside

- **Login system** — `/login` and `/request-access` pages backed by Supabase Auth
- **Auth middleware** — `/hub`, `/client`, and `/hq` all redirect to `/login`
  unless you're signed in. Nothing private is reachable without a password.
- **Team Hub** — `/hub` dashboard, `/hub/brands`, `/hub/content`, `/hub/crm`
- **Client portal** — `/client`
- **FenceHole HQ** — `/hq` Command Center + `/hq/agents` sandboxed Agent Crew
- **Hermes Coordinator + AI Router** — `/hq/hermes`, a real working agent that
  drafts plans and routes them to the cheapest safe model (Qwen for most tasks,
  Claude for harder planning) via OpenRouter
- **Supabase schema** — `supabase/schema.sql` (tables + row-level security)

## How to install (no terminal needed)

1. Download this folder to your Mac (Code → Download ZIP on this repo, unzip,
   open the `hub-app` folder).
2. Go to **github.com/FenceHole/Fence-Hole-Hub** → **Add file → Upload files**.
3. In Finder, open the `hub-app` folder, **Select All** (Cmd+A), and drag
   everything onto the upload page. GitHub keeps the folder structure.
4. Commit message: `Replace scaffold with full Hub + HQ app`, then
   **Commit changes**. Vercel auto-deploys in ~2 minutes.

## How to turn on logins (one time, ~5 minutes)

1. Go to **supabase.com/dashboard** → your project → **SQL Editor** → paste the
   contents of `supabase/schema.sql` → **Run**.
2. Go to **Authentication → Users → Add user → Create new user**. Enter your
   email and a strong password. That's your login.
3. Repeat for each team member. Done — `/hub`, `/client`, and `/hq` now require
   those passwords.

## How to turn on Hermes + the AI Router (~2 minutes)

1. Get a free key at **openrouter.ai** (sign up with email, then
   **Keys → Create Key**).
2. In Vercel → your `hub` project → **Settings → Environment Variables**, add:
   - Name: `OPENROUTER_API_KEY`
   - Value: the key you just created
3. Redeploy (Vercel → Deployments → ⋯ on the latest → Redeploy).
4. Visit `/hq/hermes`, type a task, and click **Ask Hermes**. It will pick
   Qwen 2.5 7B for simple tasks, Qwen 2.5 72B for medium tasks, and Claude 3.5
   Haiku for planning/decomposition — shown under the response along with
   token usage.

## Safety

All HQ agents are sandboxed and static: no external actions, no email, no
payments, no deploys. The `isActionAllowed()` gate is hard-coded to `false`
until Chris reviews and enables permissions. Hermes can only plan, draft,
summarize, and route — its system prompt enforces the same hard rules and
will flag (not perform) any request that needs your approval.
