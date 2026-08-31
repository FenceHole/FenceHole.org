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
// Test any candidate on /hq/models before trusting a tier to it — and note
// that an id being valid is not enough: the account's allowed-providers
// setting also has to permit whoever serves it.
//
// NOTE: this account restricts OpenRouter to an allowed-providers list, and
// OpenRouter re-points slugs at new provider variants without warning —
// deepseek-chat became deepseek-chat-v3 (streamlake/deepinfra) and qwen3-8b
// became qwen3-8b-04-28 (alibaba), neither permitted. That is why every tier
// died at once with no code change.
//
// Both defaults below were measured against this account, not guessed:
//   nousresearch/hermes-4-70b          ok, 879ms (nebius)
//   meta-llama/llama-3.3-70b-instruct  ok, 519ms (meta)
// Re-measure on /hq/models before changing either.
const VOICE_MODEL = process.env.NESSIE_MODEL_VOICE || 'nousresearch/hermes-4-70b'
const HARNESS_MODEL = process.env.NESSIE_MODEL_HARNESS || 'meta-llama/llama-3.3-70b-instruct'
const WORKER_MODEL = process.env.NESSIE_MODEL_WORKER || 'meta-llama/llama-3.3-70b-instruct'

export const MODEL_TIERS: Record<TaskComplexity, ModelChoice> = {
  // Quick path — small talk and one-liners go straight to the voice layer.
  simple: {
    id: VOICE_MODEL,
    label: 'Hermes (voice)',
    role: 'voice',
    tier: 'simple',
    approxCostPer1kTokens: 0.0004,
  },
  // Standard path — the worker model handles triage and drafting.
  standard: {
    id: WORKER_MODEL,
    label: 'Llama 3.3 70B (worker)',
    role: 'worker',
    tier: 'standard',
    approxCostPer1kTokens: 0.0001,
  },
  // Full path — anything carrying a judgment goes through the harness.
  complex: {
    id: HARNESS_MODEL,
    label: 'Llama 3.3 70B (harness)',
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
