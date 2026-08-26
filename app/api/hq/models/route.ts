import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { chatWithTools } from '@/lib/hq/agents/llm'
import { MODEL_TIERS, type TaskComplexity } from '@/lib/hq/agents/router'
import { getModelOverrides, setModelOverride, clearModelOverride } from '@/lib/hq/agents/settings'

// Model management for the Hub: see what Nessie is running, test whether a
// model actually works with her tools, and switch a tier without a redeploy.
// Team-only — this spends OpenRouter credits and changes how she behaves.

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const PROBE_TOOL = [
  {
    type: 'function',
    function: {
      name: 'list_deals',
      description: 'List brand deal offers awaiting a decision.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
]

async function requireTeam() {
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return null
  const { data: p } = await sb.from('profiles').select('role').eq('id', user.id).single()
  return p?.role === 'team' ? user : null
}

export async function GET() {
  if (!(await requireTeam())) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const overrides = await getModelOverrides()
  const tiers = (Object.keys(MODEL_TIERS) as TaskComplexity[]).map((tier) => ({
    tier,
    label: MODEL_TIERS[tier].label,
    default: MODEL_TIERS[tier].id,
    override: overrides[tier] ?? null,
    active: overrides[tier] ?? MODEL_TIERS[tier].id,
    uses_tools: tier !== 'simple',
  }))

  return NextResponse.json({ tiers })
}

export async function POST(req: NextRequest) {
  if (!(await requireTeam())) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const body = await req.json().catch(() => null)
  const action = body?.action

  if (action === 'test') {
    const model = String(body?.model ?? '').trim()
    if (!model) return NextResponse.json({ error: 'model is required' }, { status: 400 })
    // Tool-capable models are the only ones that can drive the working tiers,
    // so probe with a tool present and report whether it actually called it.
    const withTools = body?.tools !== false
    const started = Date.now()
    try {
      const { message, model: answered } = await chatWithTools(
        model,
        [
          { role: 'system', content: 'You have tools. Use them rather than guessing.' },
          { role: 'user', content: 'Which brand deals need my attention?' },
        ],
        withTools ? PROBE_TOOL : []
      )
      const calls = message.tool_calls ?? []
      return NextResponse.json({
        ok: true,
        model,
        answered_as: answered,
        called_tools: calls.map((c) => c.function.name),
        supports_tools: calls.length > 0,
        replied: Boolean(message.content),
        ms: Date.now() - started,
      })
    } catch (err) {
      return NextResponse.json({
        ok: false,
        model,
        error: err instanceof Error ? err.message : 'unknown error',
        ms: Date.now() - started,
      })
    }
  }

  if (action === 'set') {
    const tier = body?.tier as TaskComplexity
    const model = String(body?.model ?? '').trim()
    if (!(tier in MODEL_TIERS)) return NextResponse.json({ error: 'unknown tier' }, { status: 400 })
    if (!model) return NextResponse.json({ error: 'model is required' }, { status: 400 })
    await setModelOverride(tier, model)
    return NextResponse.json({ ok: true, tier, model })
  }

  if (action === 'reset') {
    const tier = body?.tier as TaskComplexity
    if (!(tier in MODEL_TIERS)) return NextResponse.json({ error: 'unknown tier' }, { status: 400 })
    await clearModelOverride(tier)
    return NextResponse.json({ ok: true, tier, model: MODEL_TIERS[tier].id })
  }

  return NextResponse.json({ error: 'unknown action' }, { status: 400 })
}
