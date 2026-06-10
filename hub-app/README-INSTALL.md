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

## Safety

All HQ agents are sandboxed and static: no external actions, no email, no
payments, no deploys. The `isActionAllowed()` gate is hard-coded to `false`
until Chris reviews and enables permissions.
