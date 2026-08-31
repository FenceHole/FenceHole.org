import { NextRequest, NextResponse } from 'next/server'
import { runNessie } from '@/lib/hq/agents/loop'
import { callOpenRouter } from '@/lib/hq/agents/llm'
import { sendWhatsApp } from '@/lib/integrations/twilio'
import { createAdminClient } from '@/lib/supabase/admin'
import { recallMemory, logMessage } from '@/lib/hq/agents/memory'

const AGENT_ID = 'nessie-chief-of-staff'

// The agentic loop makes several model calls; give it room.
export const maxDuration = 300

function authorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return req.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  try {
  // ?probe=1 — a single tiny model call, no tools, no loop, no writes. The
  // full briefing takes long enough that a failure is hard to tell apart from
  // a timeout; this answers "can she reach a model at all" in about a second.
  if (new URL(req.url).searchParams.get('probe')) {
    const { resolveModel } = await import('@/lib/hq/agents/settings')
    const out: Record<string, unknown> = {}
    // ?models=a,b,c probes specific ids instead of the configured tiers, so a
    // working combination can be found by measurement rather than by guessing.
    const explicit = new URL(req.url).searchParams.get('models')
    const targets: [string, string][] = explicit
      ? explicit.split(',').map((m) => [m.trim(), m.trim()] as [string, string])
      : await Promise.all(
          (['simple', 'standard', 'complex'] as const).map(
            async (t) => [t, await resolveModel(t)] as [string, string]
          )
        )
    for (const [tier, model] of targets) {
      const started = Date.now()
      try {
        const r = await callOpenRouter(model, 'Reply with the single word: ok', 'ping')
        out[tier] = { model, answered_as: r.model, reply: r.content.slice(0, 40), ms: Date.now() - started }
      } catch (err) {
        out[tier] = { model, error: err instanceof Error ? err.message.slice(0, 400) : 'unknown', ms: Date.now() - started }
      }
    }
    return NextResponse.json({ probe: true, tiers: out })
  }


    const sb = createAdminClient()
    const today = new Date().toISOString().slice(0, 10)

    const [{ data: tasks }, { data: drafts }, { data: deals }, memories] = await Promise.all([
      sb.from('tasks').select('title,priority,due_date,status').neq('status', 'done').order('due_date'),
      sb.from('agent_drafts').select('title,kind,status').eq('status', 'pending'),
      sb.from('deal_offers').select('brand_name,status,priority').in('status', ['new', 'assessed']),
      recallMemory(AGENT_ID, 10),
    ])

    const prompt = `Good morning, Chris. Give a tight morning briefing for ${today}. Be Donna: sharp, scannable, decide-don't-ask where you can.

  Open tasks:
  ${(tasks ?? []).map((t) => `- [${t.priority}] ${t.title}${t.due_date ? ` (due ${t.due_date})` : ''}`).join('\n') || 'none'}

  Drafts waiting on your approval (/hq/approvals):
  ${(drafts ?? []).map((d) => `- (${d.kind}) ${d.title}`).join('\n') || 'none'}

  Brand deals needing a decision (/hq/deals):
  ${(deals ?? []).map((d) => `- ${d.brand_name} [${d.status}${d.priority ? `, ${d.priority}` : ''}]`).join('\n') || 'none'}

  Recent notes/memory:
  ${memories.map((m) => `- ${m.content}`).join('\n') || 'none'}

  Structure your reply as:
  1) Top priorities for today (max 3)
  2) Anything waiting on Chris (approvals/decisions)
  3) One thing you'd flag that he might be missing`

    // Run through the agentic loop: the curated summary above is her starting
    // point, and she can pull more detail with her own tools if she needs it.
    const result = await runNessie(prompt)

    const to = process.env.CHRIS_WHATSAPP_NUMBER
    if (to) await sendWhatsApp(to, `☀️ Morning briefing — ${today}\n\n${result.reply}`)
    await logMessage(AGENT_ID, 'whatsapp', to ?? 'system', 'assistant', result.reply)

    return NextResponse.json({
      ok: true,
      sent: !!to,
      briefing: result.reply,
      steps: result.steps,
      actions: result.trace.map((t) => t.tool),
    })
  } catch (err) {
    // An unhandled throw here becomes an empty 500 with nothing in the
    // logs, indistinguishable from a timeout. Say what actually failed.
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'unknown error' },
      { status: 500 }
    )
  }
}
