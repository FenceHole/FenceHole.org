// AI Router — OpenClaw body, Hermes voice, DeepSeek harness, two Qwen3-8B
// workers. Picks the cheapest path that can safely handle a task.
// Full architecture: nessie/HARNESS.md

export type TaskComplexity = 'simple' | 'standard' | 'complex'

/** The four roles in the pipeline. */
export type ModelRole = 'voice' | 'harness' | 'worker'

export interface ModelChoice {
  id: string
  label: string
  role: ModelRole
  tier: TaskComplexity
  approxCostPer1kTokens: number
}

// Model IDs are env-overridable so a model can be swapped without a deploy.
// Every default below has been confirmed working against OpenRouter by
// GET /api/hq/nessie/selftest — do not change one without re-running it.
//
// The voice tier is a Hermes-class model (see nessie/HARNESS.md). Hermes has
// no tool-use endpoint on OpenRouter, which is fine: this tier handles small
// talk and one-liners, and the loop deliberately calls it WITHOUT tools.
const VOICE_MODEL = process.env.NESSIE_MODEL_VOICE || 'nousresearch/hermes-4-70b'
const HARNESS_MODEL = process.env.NESSIE_MODEL_HARNESS || 'deepseek/deepseek-chat'
const WORKER_MODEL = process.env.NESSIE_MODEL_WORKER || 'qwen/qwen3-8b'

export const MODEL_TIERS: Record<TaskComplexity, ModelChoice> = {
  // Quick path — small talk and one-liners go straight to the voice layer.
  simple: {
    id: VOICE_MODEL,
    label: 'Hermes (voice)',
    role: 'voice',
    tier: 'simple',
    approxCostPer1kTokens: 0.0004,
  },
  // Standard path — the Qwen workers handle triage and drafting.
  standard: {
    id: WORKER_MODEL,
    label: 'Qwen3 8B (worker)',
    role: 'worker',
    tier: 'standard',
    approxCostPer1kTokens: 0.0001,
  },
  // Full path — anything carrying a judgment goes through the harness.
  complex: {
    id: HARNESS_MODEL,
    label: 'DeepSeek V3 (harness)',
    role: 'harness',
    tier: 'complex',
    approxCostPer1kTokens: 0.0022,
  },
}

/** The two Qwen3-8B workers: same model, two jobs, run independently. */
export const WORKERS = {
  scout: { id: WORKER_MODEL, label: 'Qwen3 8B · Scout', role: 'worker' as const },
  scribe: { id: WORKER_MODEL, label: 'Qwen3 8B · Scribe', role: 'worker' as const },
} as const

export type WorkerName = keyof typeof WORKERS

// Anything asking for a decision, a plan, or a verdict needs the harness.
const COMPLEX_SIGNALS =
  /plan|decompose|strategy|architecture|multi-step|coordinate|decide|should i|worth it|counter|negotiat|priorit/i

// Pure chat that doesn't need a worker at all.
const QUICK_SIGNALS = /^(hey|hi|hello|thanks|thank you|yes|no|ok|okay|got it|morning|night)\b/i

export function classifyTask(input: string): TaskComplexity {
  const text = input.trim()
  if (COMPLEX_SIGNALS.test(text) || text.length > 600) return 'complex'
  if (QUICK_SIGNALS.test(text) && text.length < 60) return 'simple'
  if (text.length > 150) return 'standard'
  return 'simple'
}

export function pickModel(input: string): ModelChoice {
  return MODEL_TIERS[classifyTask(input)]
}

/** Which stages a given input should run through once the pipeline is chained. */
export function pipelineFor(input: string): Array<'scout' | 'harness' | 'scribe' | 'voice'> {
  const tier = classifyTask(input)
  if (tier === 'complex') return ['scout', 'harness', 'scribe', 'voice']
  if (tier === 'standard') return ['scout', 'scribe', 'voice']
  return ['voice']
}
