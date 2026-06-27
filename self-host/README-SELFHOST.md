# Running FenceHole Hub on your own hardware (self-hosted)

This puts the **whole app and database on a machine you own** — no Vercel, no
Supabase Cloud. Your CRM, content, deals, and Nessie's memory all live on your
server. You edit code on your MacBook, push it, and the server pulls and
rebuilds.

### What still needs the internet (and why)

- **WhatsApp** is Meta's service — messages always travel through Meta/Twilio's
  servers. There is no fully-offline WhatsApp. The app itself runs locally, but
  for WhatsApp to reach Nessie, the server needs an internet path (see step 6).
- **Nessie's brain** (GLM 5.2 / Qwen via OpenRouter) is a cloud API call. If you
  ever want her to think with *zero* internet, that's a separate change — swap
  OpenRouter for a local model (Ollama). Say the word and I'll wire that up.

Everything else — login, the Hub, the database, Studio — works on your LAN with
no internet at all.

---

## What you need

- A computer that stays on 24/7 — a **Mac mini**, an old Mac, or any
  Linux box works great. (Your MacBook *can* be the server, but it has to stay
  awake and plugged in, or WhatsApp stops working when the lid closes. A
  dedicated always-on box is why we picked this setup.)
- **Docker Desktop** (Mac/Windows) or **Docker Engine** (Linux) installed on
  that server.
- **Git** installed on the server.

---

## First-time setup (do this once, on the server)

```bash
# 1. Get the code
git clone https://github.com/FenceHole/FenceHole.org.git
cd FenceHole.org/self-host

# 2. Pull the Supabase stack + create env files
bash setup.sh
```

`setup.sh` downloads the official Supabase stack into `self-host/supabase/` and
creates two `.env` files for you to fill in.

### 3. Generate your Supabase keys

Self-hosted Supabase needs a **JWT secret** and two API keys derived from it.
Open the "Generate API keys" box on
<https://supabase.com/docs/guides/self-hosting/docker> — it makes a matched
`JWT_SECRET`, `ANON_KEY`, and `SERVICE_ROLE_KEY` for you.

Then edit two files:

- **`self-host/supabase/.env`** — set `POSTGRES_PASSWORD`, `JWT_SECRET`,
  `ANON_KEY`, `SERVICE_ROLE_KEY`, and a `DASHBOARD_USERNAME` /
  `DASHBOARD_PASSWORD` (that's the login for Supabase Studio).
- **`self-host/.env`** — set:
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = the same `ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY` = the same `SERVICE_ROLE_KEY`
  - `OPENROUTER_API_KEY`, `GROQ_API_KEY`, and the Twilio/WhatsApp values
    (same as the cloud `.env.example` at the repo root).

> Leave `NEXT_PUBLIC_SUPABASE_URL=http://localhost:8000` if you'll only use the
> Hub from the server itself. To use it from your phone/laptop on the same
> network, set it to the server's address, e.g. `http://192.168.1.50:8000`.

### 4. Start everything

```bash
docker compose up -d --build
```

This boots Postgres, Supabase Auth, Studio, the API gateway, **and** the Hub.
First build takes a few minutes.

### 5. Load the FenceHole tables and create your login

```bash
./migrate.sh
```

Then open **Supabase Studio** at `http://localhost:8000` (log in with the
`DASHBOARD_USERNAME`/`PASSWORD` you set) → **Authentication → Add user** → enter
your email + password and tick **Auto Confirm**. Finally, in Studio's **SQL
Editor**:

```sql
update public.profiles set role='team' where email='you@email.com';
```

Open **`http://localhost:3000`** and log in. The Hub is now running entirely on
your hardware.

### 6. Let WhatsApp reach the server (only if you want WhatsApp)

Twilio needs to POST to your server from the internet. Don't open a port on your
router — use a secure tunnel that exposes **only** the webhook:

- **Cloudflare Tunnel** (free): `cloudflared tunnel --url http://localhost:3000`
  gives you an `https://something.trycloudflare.com` URL.
- Set that as your Twilio webhook:
  `https://<your-tunnel>/api/whatsapp/webhook` (method POST).

(For a stable URL that doesn't change on restart, set up a named Cloudflare
Tunnel against a domain you own — I can walk you through it.)

---

## Shipping updates (the everyday workflow)

On your **MacBook**, edit code and push as normal (to the branch, then merge to
`main` — or whatever branch the server tracks).

On the **server**, pull and rebuild in one step:

```bash
cd FenceHole.org/self-host
./update.sh
```

Only the app container rebuilds; your database keeps running. If you changed any
`.sql` file, also run `./migrate.sh`.

---

## Handy commands

```bash
docker compose ps                 # what's running
docker compose logs -f hub        # tail the app's logs
docker compose restart hub        # restart just the app
docker compose down               # stop everything (data is kept in volumes)
```

## Backups (important — it's your data now)

Your whole database lives in the Postgres volume. Back it up regularly:

```bash
docker exec -t supabase-db pg_dumpall -U postgres > backup-$(date +%F).sql
```

Keep a copy off the server (external drive / another machine). Restoring later
is `cat backup.sql | docker exec -i supabase-db psql -U postgres`.
