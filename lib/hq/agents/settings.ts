// Runtime model configuration.
//
// The env vars in router.ts are the defaults. These overrides let a model be
// swapped from the Hub without a redeploy — which matters because OpenRouter's
// catalogue moves, and because "can we run model X?" is a question worth
// answering in thirty seconds rather than a deploy cycle.
//
// Stored as reserved rows in agent_memory rather than a new table, so this
// needs no migration. The category is namespaced to keep it out of anything
// Nessie recalls as an actual memory.

import { createAdminClient } from '@/lib/supabase/admin'
import { MODEL_TIERS, type TaskComplexity } from './router'

const SETTING_CATEGORY = '__model_override'
const AGENT_ID = 'nessie-chief-of-staff'

export type ModelOverrides = Partial<Record<TaskComplexity, string>>

// Model choice changes rarely and is read on every message; a short cache
// keeps it from adding a round-trip to each turn.
let cache: { at: number; value: ModelOverrides } | null = null
const CACHE_MS = 30_000

export async function getModelOverrides(): Promise<ModelOverrides> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value

  const overrides: ModelOverrides = {}
  try {
    const sb = createAdminClient()
    const { data } = await sb
      .from('agent_memory')
      .select('content,tags,updated_at')
      .eq('agent_id', AGENT_ID)
      .eq('category', SETTING_CATEGORY)
      .order('updated_at', { ascending: false })

    // content is "<tier>=<model id>"; newest row per tier wins.
    for (const row of data ?? []) {
      const [tier, ...rest] = String(row.content).split('=')
      const id = rest.join('=').trim()
      const key = tier.trim() as TaskComplexity
      if (id && key in MODEL_TIERS && !(key in overrides)) overrides[key] = id
    }
  } catch {
    // No database, no overrides — the env defaults still apply.
  }

  cache = { at: Date.now(), value: overrides }
  return overrides
}

export async function setModelOverride(tier: TaskComplexity, modelId: string): Promise<void> {
  const sb = createAdminClient()
  await sb.from('agent_memory').insert({
    agent_id: AGENT_ID,
    category: SETTING_CATEGORY,
    content: `${tier}=${modelId}`,
    tags: ['setting'],
  })
  cache = null
}

export async function clearModelOverride(tier: TaskComplexity): Promise<void> {
  const sb = createAdminClient()
  await sb
    .from('agent_memory')
    .delete()
    .eq('agent_id', AGENT_ID)
    .eq('category', SETTING_CATEGORY)
    .like('content', `${tier}=%`)
  cache = null
}

/** The model actually used for a tier: override if set, else the env default. */
export async function resolveModel(tier: TaskComplexity): Promise<string> {
  const overrides = await getModelOverrides()
  return overrides[tier] ?? MODEL_TIERS[tier].id
}
