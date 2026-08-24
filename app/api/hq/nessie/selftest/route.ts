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

export async function GET() {
  const tiers = Object.entries(MODEL_TIERS)

  const results = await Promise.all(
    tiers.map(async ([tier, choice]) => {
      const started = Date.now()
      try {
        const { message, model } = await chatWithTools(
          choice.id,
          [
            { role: 'system', content: 'You have tools. Use them rather than guessing.' },
            { role: 'user', content: 'Which brand deals need my attention?' },
          ],
          PROBE_TOOL
        )
        const calls = message.tool_calls ?? []
        return {
          tier,
          configured: choice.id,
          answered_as: model,
          supports_tools: calls.length > 0,
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
