# Nessie's Mac Agent

Gives Nessie hands on your actual machine — but only ever **one approved
command at a time.**

## How it works

The Hub runs on a server in a datacenter. It cannot reach your laptop, and
nothing on the internet can. So this small program runs on *your* Mac and
polls outward, asking the Hub: *"is there anything approved for me to do?"*

```
 Nessie wants something          You decide            Your Mac
 ──────────────────────          ──────────            ────────
 request_mac_action    ──►   pending in the Hub   ──►  agent polls
                             you tap Approve           runs it, reports back
```

**Nessie can only ever request.** She has no tool that runs anything directly.
If you never approve, nothing ever happens.

## What it can do

| Kind | Does |
|---|---|
| `notify` | Pops a macOS notification |
| `open_url` | Opens a link in your browser |
| `open_app` | Launches an app by name |
| `read_file` | Reads a file — only inside the folders below |
| `write_file` | Writes a file — only inside the folders below |

File access is confined to `~/Desktop`, `~/Documents/Nessie`, and
`~/Downloads`. Anything outside those is refused by the agent itself, not just
discouraged.

There is deliberately **no arbitrary shell command**. Adding one is a few
lines in `agent.js`, and you should think hard before you do — an AI with a
shell is an AI that can delete things. Start here, widen later if you actually
need it.

## Setup

**1.** Run `supabase/machine-commands-schema.sql` in the Supabase SQL editor
(one time — creates the queue table).

**2.** Pick a long random string as a shared secret and add it in Vercel under
Settings → Environment Variables as `NESSIE_AGENT_TOKEN` (Production), then
redeploy.

**3.** On your Mac:

```bash
cd FenceHole.org/desktop/mac-agent
NESSIE_AGENT_TOKEN=the-same-string node agent.js
```

You'll see it start watching. Leave the window open — that's it running.

The first time it opens an app or writes a file, macOS will ask for
permission. Say yes; that prompt is the OS doing its job.

## Day to day

Ask Nessie for something on your machine. It lands as **pending**. You approve
it in the Hub. Within a few seconds the agent picks it up, does it, and writes
the result back where you can see it.

To stop her having any access at all: quit the agent. Nothing can run without
it.

## Config

| Variable | Default |
|---|---|
| `NESSIE_AGENT_TOKEN` | *required* — must match Vercel |
| `NESSIE_HUB_URL` | `https://fencehole.org` |
| `NESSIE_POLL_MS` | `5000` |
