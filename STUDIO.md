# Studio — going live from the Hub

`/hub/studio`. OBS-style scene compositing in the browser, with live-shopping
product overlays burned into the outgoing video.

## What works today, with no setup at all

- **Camera + mic** capture at 720p30
- **Screen share**, with three layouts: camera, screen, side-by-side
- **Product overlay** — a floating card bottom-left, or full-screen hero mode
  with the presenter tucked into the corner
- **Headline banner**
- **Local recording** to a downloadable `.webm` at 6 Mbps

All of it composites onto one canvas, so **the overlay is part of the video**,
not a browser-only decoration. That canvas is the broadcast feed.

## Going live — the part that needs a decision

**A browser cannot push RTMP.** RTMP runs over a raw TCP socket, and browser
sandboxes don't allow those. This is why StreamYard, Restream Studio, and
Riverside all work the same way:

```
  browser  ──WebRTC/WHIP──►  relay server  ──RTMP──►  YouTube
  (capture,                  (transcode,              Twitch
   compositing,               fan-out)                TikTok
   overlays)                                          X / LinkedIn
                                                      Instagram
```

The stage feed is already in the right shape to hand to a relay. Two ways to
get one:

### Option A — Cloudflare Stream Live (recommended)

WHIP ingest straight from the browser, then "Live Outputs" re-broadcast the
same stream to as many RTMP destinations as you want. About **$5/month plus
usage**, and you're already using Cloudflare.

Set `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_STREAM_TOKEN`, and destinations are
managed through their API — one stream in, many platforms out.

### Option B — Restream.io

If you already pay for Restream, it gives you one ingest endpoint and handles
the fan-out to every platform including their existing integrations. Simpler
if you have it; another subscription if you don't.

### On Amazon Live specifically

Amazon Live has historically been **invite-only** through the Amazon Live
Creator app, and doesn't hand out public RTMP keys the way Twitch or YouTube
do. If your Cool Cat Stuff account has Creator access, check whether it exposes
an RTMP endpoint — if it does, it's just another destination on the relay. If
it doesn't, that platform needs their app, and no amount of code here changes
that.

## Product search

The overlay pulls from a shelf you build. Two sources:

- **Amazon Product Advertising API** — activates automatically once
  `AMAZON_ACCESS_KEY`, `AMAZON_SECRET_KEY`, and `AMAZON_PARTNER_TAG` are set in
  Vercel. Requires an **Associates account with qualifying sales**; Amazon
  gates the API behind that, which is why it can't be assumed on.
- **The Hub's own catalogue** — the fallback, searched by title.

The search endpoint says which mode it's in rather than silently returning
nothing, so an empty result is never ambiguous.

The shelf persists in your browser, so a stream setup survives a refresh.

## Honest limits

- **720p30.** Higher is possible but canvas compositing plus encoding in a
  browser tab gets expensive fast; 1080p is worth testing on your actual
  machine before promising it on air.
- **Latency** to the audience is set by the relay and the platform, typically
  10–30s. Nothing in the browser changes that.
- **Recording is local** — it lives in your browser's memory until you download
  it. A very long session will eat RAM. Uploading recordings straight to
  storage is a sensible next step.
