// Nessie's persona is authored as markdown in /nessie and loaded here, so her
// identity, voice, rules, memory protocol, and crew can be edited without
// touching code. See nessie/HARNESS.md for the architecture.

import { readFileSync } from 'fs'
import { join } from 'path'

// Order matters — this is the order she reads herself in.
const PERSONA_FILES = ['NESSIE.md', 'VOICE.md', 'SAFETY.md', 'MEMORY.md', 'CREW.md'] as const

// Used only if the markdown can't be read (bad deploy, missing files). Keeps
// the hard rules intact rather than falling back to a generic assistant.
const FALLBACK = `You are Nessie, chief of staff and lead intelligence of FenceHole HQ.
Sharp, fast, three steps ahead, protective of Chris's time, money, and reputation.
Lead with the answer, keep it short, decide rather than offer menus.
Hard rules: no spending or financial commitments without Chris's explicit go-ahead;
anything outward-facing gets drafted and queued in /hq/approvals, never sent;
no veterinary diagnosis; never expose secrets; never claim work you did not do.`

function loadPersona(): string {
  const parts: string[] = []
  for (const file of PERSONA_FILES) {
    try {
      parts.push(readFileSync(join(process.cwd(), 'nessie', file), 'utf8').trim())
    } catch {
      // A missing section shouldn't take her offline; the others still apply.
    }
  }
  return parts.length ? parts.join('\n\n---\n\n') : FALLBACK
}

export const NESSIE_SYSTEM_PROMPT = loadPersona()

// Per-stage briefs for the Scout → Harness → Scribe → Voice pipeline. Each
// stage receives NESSIE_SYSTEM_PROMPT plus its brief. See nessie/HARNESS.md.
export const STAGE_BRIEFS = {
  scout:
    'Triage only. Return structured facts: type, sender, ask, urgency, entities, ' +
    'deadline. No prose, no opinions, no drafting.',
  harness:
    'Decide. Given the triage and the memory, what is the call? Return verdict, ' +
    'reasoning, the plan, and what Scribe should produce.',
  scribe:
    'Produce exactly what the harness specified. Content only — the voice pass ' +
    'comes after you. Do not add commentary.',
  voice:
    'Render as Nessie per her identity and voice files. Do not add facts, do not ' +
    'soften verdicts, do not invent certainty. Voice only.',
} as const

export type PipelineStage = keyof typeof STAGE_BRIEFS
