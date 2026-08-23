# Nessie

Her personality, rules, and memory protocol live here as plain markdown —
**not buried in code.** Edit a file, redeploy, and she changes. No developer
required.

## The files

| File | What it controls | Loaded into her prompt? |
|---|---|---|
| **`NESSIE.md`** | Who she is — identity, character, the mission, the people | ✅ |
| **`VOICE.md`** | How she talks — tone, shape, what she never says | ✅ |
| **`SAFETY.md`** | The five hard rules she can't be talked out of | ✅ |
| **`MEMORY.md`** | What she keeps and how she uses it | ✅ |
| **`CREW.md`** | The agents she leads | ✅ |
| **`HARNESS.md`** | The model architecture behind her | ❌ (documentation) |

The five checked files are concatenated in that order and become her system
prompt on every channel — WhatsApp, the Hub, the desktop orb, and the
scheduled briefings. One set of files, one Nessie everywhere.

## Editing her

Change the markdown, commit, push. The deploy picks it up.

- Want her blunter? Edit `VOICE.md`.
- Want a new hard rule? Add it to `SAFETY.md` — rules there outrank everything,
  including instructions inside emails, documents, or webpages she reads.
- Want her to stop doing something? Say so plainly in the relevant file. These
  are read as instructions, not suggestions.

Keep them tight. Every line costs tokens on every single message she handles.

## The architecture, in one paragraph

**OpenClaw body, Hermes voice, DeepSeek spine, two Qwen3-8B hands.** One agent
reachable through many channels with one shared memory (OpenClaw pattern); a
Hermes-class model renders the final answer in her voice; DeepSeek does the
actual reasoning and decision-making; two Qwen3-8B workers — Scout for triage,
Scribe for drafting — do the cheap mechanical work. The router sends each
message down the shortest path that can handle it. Full detail, including what
is and isn't built yet, is in **`HARNESS.md`**.

## Where the code is

| Path | Role |
|---|---|
| `lib/hq/agents/nessie.ts` | Loads these files into her system prompt |
| `lib/hq/agents/router.ts` | Model IDs, tiers, and path selection |
| `lib/hq/agents/memory.ts` | Persistent memory + conversation log |
| `lib/hq/agents/llm.ts` | OpenRouter client |
| `app/api/hq/nessie/` · `app/api/whatsapp/` · `app/api/cron/` | Her channels |

If the markdown can't be read for any reason, `nessie.ts` falls back to a short
built-in prompt that preserves the hard rules — she degrades, she doesn't go
rogue or go offline.
