# FenceHole Hub — Full App (verified build)

This is the complete FenceHole Hub + HQ app. It now deploys directly from this
repo (`FenceHole/FenceHole.org`) to **fencehole.org**, replacing the old
public portfolio site at that domain. The portfolio site has been moved to
`portfolio-site/` (see below) so it can be deployed to **fencehole.com**.

## What's inside

- **Login system** — `/login` and `/request-access` pages backed by Supabase Auth
- **Auth middleware** — `/hub`, `/client`, and `/hq` all redirect to `/login`
  unless you're signed in. Nothing private is reachable without a password.
- **Team Hub** — `/hub` dashboard, `/hub/brands`, `/hub/content`, `/hub/crm`
- **Client portal** — `/client`
- **FenceHole HQ** — `/hq` Command Center + `/hq/agents` sandboxed Agent Crew
- **Nessie — Chief of Staff** — `/hq/nessie`, the lead agent (your Donna):
  assesses, plans, drafts in Chris's voice, routed to the cheapest safe model
  (Qwen for most tasks, Claude for harder planning) via OpenRouter
- **Deal Desk** — `/hq/deals`: log every brand deal offer, Nessie gives a
  TAKE/COUNTER/PASS verdict, priority, and a drafted reply
- **Approvals** — `/hq/approvals`: every agent draft waits for your sign-off
- **Supabase schema** — `supabase/schema.sql` + `supabase/hq-schema.sql`
  (tables + row-level security)

## How to turn on logins (one time, ~5 minutes)

1. Go to **supabase.com/dashboard** → your project → **SQL Editor** → paste the
   contents of `supabase/schema.sql` → **Run**. Then do the same with
   `supabase/hq-schema.sql` (Deal Desk + Approvals tables).
2. Go to **Authentication → Users → Add user → Create new user**. Enter your
   email and a strong password. That's your login.
3. Repeat for each team member. Done — `/hub`, `/client`, and `/hq` now require
   those passwords.

## How to turn on Nessie + the AI Router (~2 minutes)

1. Get a free key at **openrouter.ai** (sign up with email, then
   **Keys → Create Key**).
2. In Vercel → the project that serves **fencehole.org** (`fence-hole-org`)
   → **Settings → Environment Variables**, add:
   - Name: `OPENROUTER_API_KEY`
   - Value: the key you just created
3. Redeploy (Vercel → Deployments → ⋯ on the latest → Redeploy).
4. Visit `/hq/nessie`, type a task, and click **Ask Nessie**. It will pick
   Qwen 2.5 7B for simple tasks, Qwen 2.5 72B for medium tasks, and Claude 3.5
   Haiku for planning/decomposition — shown under the response along with
   token usage.

## The portfolio site (`portfolio-site/`)

The original public portfolio (Fence Hole LLC | Cat Media Conglomerate, with
all six properties) is now in `portfolio-site/`. It's a static HTML/CSS/JS
site. To put it live at **fencehole.com**:

1. In Vercel, create a new project from this repo (`FenceHole/FenceHole.org`)
   with **Root Directory** set to `portfolio-site`, framework preset "Other"
   (no build command, output directory `.`).
2. Add **fencehole.com** (and `www.fencehole.org` if you want it pointed here
   instead of the Hub) as a custom domain on that new project.

## Safety

All HQ agents are sandboxed and static: no external actions, no email, no
payments, no deploys. The `isActionAllowed()` gate is hard-coded to `false`
until Chris reviews and enables permissions. Nessie can only plan, draft,
summarize, and route — her system prompt enforces the same hard rules and
she flags (never performs) any request that needs your approval.
