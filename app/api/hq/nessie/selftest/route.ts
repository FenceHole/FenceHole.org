import { NextResponse } from 'next/server'
import { chatWithTools } from '@/lib/hq/agents/llm'
import { MODEL_TIERS } from '@/lib/hq/agents/router'

// Diagnostic: does each configured model actually support tool-calling?
//
// The agentic loop is only as good as the model's willingness to emit
// tool_calls, and reasoning models in particular are inconsistent about it.
// This does ONE tiny round-trip per tier and reports what came back. It runs
// no tools and touches no data.

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

export async function GET(req: Request) {
  // ?model=a,b,c probes specific slugs instead of the configured tiers —
  // used to find a working id when OpenRouter's catalog has moved.
  const probe = new URL(req.url).searchParams.get('model')
  const tiers: [string, { id: string }][] = probe
    ? probe.split(',').map((id) => [id.trim(), { id: id.trim() }])
    : Object.entries(MODEL_TIERS)

  const results = await Promise.all(
    tiers.map(async ([tier, choice]) => {
      const started = Date.now()
      // The voice tier is deliberately called without tools in the real loop,
      // so probe it the same way rather than reporting a false failure.
      const toolsForTier = tier === 'simple' ? [] : PROBE_TOOL
      try {
        const { message, model } = await chatWithTools(
          choice.id,
          [
            { role: 'system', content: 'You have tools. Use them rather than guessing.' },
            { role: 'user', content: 'Which brand deals need my attention?' },
          ],
          toolsForTier
        )
        const calls = message.tool_calls ?? []
        return {
          tier,
          configured: choice.id,
          answered_as: model,
          supports_tools: tier === 'simple' ? Boolean(message.content) : calls.length > 0,
          note: tier === 'simple' ? 'voice tier — answers without tools by design' : undefined,
          called: calls.map((c) => c.function.name),
          ms: Date.now() - started,
        }
      } catch (err) {
        return {
          tier,
          configured: choice.id,
          supports_tools: false,
          error: err instanceof Error ? err.message.slice(0, 300) : 'unknown',
          ms: Date.now() - started,
        }
      }
    })
  )

  const healthy = results.filter((r) => r.supports_tools).map((r) => r.tier)
  return NextResponse.json({
    ok: healthy.length > 0,
    tool_calling_works_on: healthy,
    results,
  })
}
