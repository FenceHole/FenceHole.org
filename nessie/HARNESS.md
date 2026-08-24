# HARNESS — The Machine Nessie Runs On

**OpenClaw body · Hermes voice · DeepSeek spine · two Qwen3-8B hands.**

This file documents the architecture. It is *not* injected into the system
prompt — it describes the rig that renders everything else.

## The idea

Most assistants are one model doing every job badly-ish: reasoning, drafting,
triage, and personality all smeared into a single expensive call. Nessie splits
those jobs across models that are each good (and cheap) at their own thing, and
then puts one voice on the front so it all sounds like one person.

```
                  ┌──────────────────────────────────────────┐
   WhatsApp ─┐    │            OPENCLAW GATEWAY              │
   Hub chat ─┼───►│  channel-agnostic · memory · skills      │
   Orb      ─┤    └───────────────────┬──────────────────────┘
   Cron     ─┘                        │
                                      ▼
                        ┌─────────────────────────┐
                        │   QWEN3-8B  ·  SCOUT    │  triage, extract,
                        │   (worker 1, parallel)  │  classify, tag
                        └────────────┬────────────┘
                                     ▼
                        ┌─────────────────────────┐
                        │   DEEPSEEK  ·  HARNESS  │  plan, decide,
                        │   reasoning + reduce    │  decompose, verdict
                        └────────────┬────────────┘
                                     ▼
                        ┌─────────────────────────┐
                        │   QWEN3-8B  ·  SCRIBE   │  draft, summarize,
                        │   (worker 2, parallel)  │  format, expand
                        └────────────┬────────────┘
                                     ▼
                        ┌─────────────────────────┐
                        │   HERMES  ·  VOICE      │  persona pass —
                        │   renders it as Nessie  │  NESSIE.md + VOICE.md
                        └────────────┬────────────┘
                                     ▼
                              Chris / approvals
```

## The four roles

### OpenClaw — the body
The gateway pattern: one agent, many channels, one memory. WhatsApp, the Hub,
the desktop orb, and the cron briefings are doors into the *same* Nessie, not
separate bots. Persona and rules live in editable files (this folder), memory
lives in Postgres, and the whole thing is self-hostable — see `self-host/`.

### Hermes — the voice
The final pass. Everything that reaches Chris goes through a persona render
governed by `NESSIE.md` and `VOICE.md`. Hermes-class models hold a character
under pressure without slipping into corporate-assistant defaults, which is
exactly the failure mode this layer exists to prevent. Reasoning happens
elsewhere; this layer only decides *how it sounds*.

### DeepSeek — the harness
The spine. Plans, decomposes, weighs, and decides — and reduces both workers'
output into a single verdict. Anything with a *judgment* in it (deal calls,
prioritization, strategy, multi-step work) routes here. It is the most
expensive hop, so it is used deliberately, not by default.

### Qwen3-8B ×2 — the hands
Two cheap, fast workers running the mechanical half:

- **Scout** — inbound triage: what is this, who is it from, what does it want,
  what's the urgency, what fields matter.
- **Scribe** — outbound production: drafts, summaries, reformatting, list
  cleanup, expansion.

They are the same model, deliberately given two different jobs and two
different prompts. Splitting them means triage and drafting can run in
parallel on separate turns instead of queueing behind one context.

## Routing

Not every message deserves the full pipeline.

| Path | Route | For |
|---|---|---|
| **Quick** | Hermes only | Small talk, acknowledgements, one-liners |
| **Standard** | Scout → Scribe → Hermes | Summaries, drafts, formatting, lookups |
| **Full** | Scout → DeepSeek → Scribe → Hermes | Judgment: deals, plans, strategy, anything with a verdict |

`lib/hq/agents/router.ts` classifies each input and picks the path. Cheapest
path that can do the job safely, always.

## Model IDs

Set in `lib/hq/agents/router.ts`, all overridable by environment variable so a
model can be swapped without a code change:

| Role | Env var | Default |
|---|---|---|
| Voice | `NESSIE_MODEL_VOICE` | `nousresearch/hermes-4-70b` |
| Harness | `NESSIE_MODEL_HARNESS` | `deepseek/deepseek-r1` |
| Workers | `NESSIE_MODEL_WORKER` | `qwen/qwen3-8b` |

All served through OpenRouter on one `OPENROUTER_API_KEY`.

> **Verify the IDs before trusting them.** OpenRouter's catalog changes;
> confirm each slug at <https://openrouter.ai/models> and override via env if
> one has moved. A wrong slug fails loudly at call time — it does not fall back
> silently.

## What she can actually do

Nessie runs a **tool-calling loop**: she calls a tool, reads the result,
decides what to do next, and keeps going until she has an answer. Bounded at
six steps; if she hits the ceiling she says so rather than inventing a
conclusion. Every call is recorded and shown in the Hub.

Her tools (`lib/hq/agents/tools.ts`) are split so that `SAFETY.md` is enforced
by the toolset rather than by asking the model to behave:

| Group | Tools |
|---|---|
| **Read** | `list_deals` `list_todos` `list_tasks` `list_contacts` `list_content` `list_pending_drafts` `recall_memory` |
| **Internal writes** | `add_todo` `remember` `assess_deal` `add_content_idea` |
| **Requests only** | `queue_draft` (→ `/hq/approvals`) · `request_mac_action` (→ the Mac agent) |

There is deliberately **no tool that sends, posts, publishes, or spends.** The
worst case is an unwanted draft sitting in a queue.

## Implementation status — read this honestly

| Piece | State |
|---|---|
| Persona files as the live system prompt | **Implemented** — `lib/hq/agents/nessie.ts` |
| Three-path router + env-overridable model IDs | **Implemented** — `lib/hq/agents/router.ts` |
| One brain across WhatsApp / Hub / orb / cron | **Implemented** — shared prompt + `agent_memory` |
| Agentic tool loop with the approval gate in code | **Implemented** — `lib/hq/agents/loop.ts`, `tools.ts` |
| Hands on the Mac, one approved command at a time | **Implemented** — `desktop/mac-agent/`, needs install + token |
| Scout → DeepSeek → Scribe → Hermes chained as four distinct stages | **Not built** — the loop uses one model per request, chosen by tier, and lets it call tools repeatedly. That turned out to matter more than staging four models, so it was built first. The stage prompts below remain the spec if the split is ever worth doing. |

Tool-calling depends on the model actually emitting `tool_calls`, and reasoning
models are inconsistent about it. `GET /api/hq/nessie/selftest` probes every
tier and reports which ones work, so a silent failure surfaces as a diagnosis
instead of as Nessie quietly behaving oddly.

## Stage prompts

Each stage gets the persona files **plus** its own brief:

- **Scout** — "Triage only. Return structured facts: type, sender, ask,
  urgency, entities, deadline. No prose, no opinions, no drafting."
- **Harness** — "Decide. Given the triage and the memory, what is the call?
  Return verdict, reasoning, the plan, and what Scribe should produce."
- **Scribe** — "Produce exactly what the harness specified. Content only —
  the voice pass comes after you. Do not add commentary."
- **Voice** — "Render as Nessie per `NESSIE.md` and `VOICE.md`. Do not add
  facts, do not soften verdicts, do not invent certainty. Voice only."

The voice pass never introduces information. That separation is what keeps
personality from quietly becoming hallucination.
