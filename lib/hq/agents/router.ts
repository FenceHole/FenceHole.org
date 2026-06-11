// AI Router: picks the cheapest model that can safely handle a task.
// Qwen models cover the cheap/standard tiers; Claude is reserved for
// tasks that need stronger reasoning (planning, decomposition, strategy).

export type TaskComplexity = 'simple' | 'standard' | 'complex'

export interface ModelChoice {
  id: string
  label: string
  tier: TaskComplexity
  approxCostPer1kTokens: number
}

export const MODEL_TIERS: Record<TaskComplexity, ModelChoice> = {
  simple: {
    id: 'qwen/qwen-2.5-7b-instruct',
    label: 'Qwen 2.5 7B (cheap)',
    tier: 'simple',
    approxCostPer1kTokens: 0.0001,
  },
  standard: {
    id: 'qwen/qwen-2.5-72b-instruct',
    label: 'Qwen 2.5 72B',
    tier: 'standard',
    approxCostPer1kTokens: 0.0009,
  },
  complex: {
    id: 'anthropic/claude-3.5-haiku',
    label: 'Claude 3.5 Haiku',
    tier: 'complex',
    approxCostPer1kTokens: 0.0025,
  },
}

const COMPLEX_SIGNALS = /plan|decompose|strategy|architecture|multi-step|coordinate/i

export function classifyTask(input: string): TaskComplexity {
  if (COMPLEX_SIGNALS.test(input) || input.length > 600) return 'complex'
  if (input.length > 150) return 'standard'
  return 'simple'
}

export function pickModel(input: string): ModelChoice {
  return MODEL_TIERS[classifyTask(input)]
}
