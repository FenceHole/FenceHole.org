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
   `supabase/hq-schema.sql` (Deal Desk + Approvals tables), then
   `supabase/hq-agents-v2-schema.sql` (Nessie's memory, conversation log, and
   WhatsApp-sourced drafts).
2. Go to **Authentication → Users → Add user → Create new user**. Enter your
   email and a strong password, and turn on **Auto Confirm User** so you don't
   need to click an email link. That's your login. Repeat for each team member
   (e.g. Marjorie).
3. Back in **SQL Editor**, run (with your real emails):
   ```sql
   update public.profiles set role='team' where email in ('your@email.com','marjorie@email.com');
   ```
   New accounts default to `role='pending'`, which blocks Hub access — this
   step is required.
4. Log in at **fencehole.org/login**. Then click **🔒 Security** in the
   sidebar (`/account/security`) to turn on two-factor auth — scan the QR
   code with Google Authenticator / 1Password / Authy and enter the 6-digit
   code. Do this for every account. Done — `/hub`, `/client`, and `/hq` now
   require password + 2FA.

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

## How to talk to Nessie on WhatsApp (~15 minutes)

This wires up text, voice notes, and photos (snap a photo → Nessie estimates
its value and drafts a marketplace listing for /hq/approvals).

1. **Service role key** (so the webhook/cron jobs can read & write memory):
   Supabase → **Settings → API** → copy the `service_role` key → add to
   Vercel as `SUPABASE_SERVICE_ROLE_KEY`. Keep this one secret.
2. **Free transcription**: sign up at **console.groq.com** → create an API
   key → add to Vercel as `GROQ_API_KEY`. Powers voice-note transcription.
3. **Twilio WhatsApp sandbox** (free): sign up at **twilio.com** →
   **Messaging → Try it out → Send a WhatsApp message** → follow the prompt
   to join the sandbox from your phone (send the given code to the Twilio
   number on WhatsApp).
   - Copy **Account SID** and **Auth Token** from the Twilio console → add as
     `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN`.
   - Add `TWILIO_WHATSAPP_NUMBER` = `whatsapp:+14155238886` (the Twilio
     sandbox number shown on that page).
   - Add `WHATSAPP_ALLOWED_NUMBERS` = your WhatsApp number(s) in the form
     `whatsapp:+15551234567` (comma-separate for Marjorie too). This stops
     random numbers from using your AI Router budget.
   - Add `CHRIS_WHATSAPP_NUMBER` = your number, same format — this is where
     morning briefings and evening recaps get sent.
4. In Twilio: **Messaging → WhatsApp sandbox settings** → set "WHEN A MESSAGE
   COMES IN" to:
   `https://fencehole.org/api/whatsapp/webhook` (method: POST).
5. Redeploy after adding the env vars. Text the Twilio sandbox number on
   WhatsApp — Nessie replies. Send a photo of something to sell to see the
   marketplace-listing flow.

> Note: the Twilio sandbox requires each phone to re-join every 72 hours by
> texting the join code again. For a permanent number with no rejoin step,
> upgrade to a paid Twilio WhatsApp sender (still cheap — a few dollars/month).

## Morning briefings & evening recaps

Vercel Cron calls `/api/cron/morning-briefing` and `/api/cron/evening-recap`
on a schedule (set in `vercel.json`, currently ~8am/8pm US Eastern — adjust
the cron times for your timezone). Requires the WhatsApp setup above. Add a
`CRON_SECRET` env var (any random string) for extra protection — Vercel sends
it automatically as a header once set.

## Plaud AI Pin / Zapier inbox

Point a Zapier "Webhooks by Zapier → POST" action at:
`https://fencehole.org/api/zapier/webhook?secret=YOUR_ZAPIER_WEBHOOK_SECRET`
with JSON body `{"text": "{{transcript}}", "source": "plaud"}`. Set
`ZAPIER_WEBHOOK_SECRET` in Vercel to match. Notes land in Nessie's memory and
show up as context the next time you talk to her.

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

Talking to Nessie directly (WhatsApp, `/hq/nessie`) is always on — that's just
a conversation with Chris. Anything that would leave the building — a reply to
a client/brand, a posted marketplace listing, published content — gets drafted
and queued in `/hq/approvals` instead of sent. `isActionAllowed()` in
`lib/hq/agents/safety.ts` stays `false` (no auto-send/auto-spend) until Chris
explicitly flips it on for a specific integration. No payments, no vet
diagnosis, no exposing secrets — ever, regardless of that flag.
