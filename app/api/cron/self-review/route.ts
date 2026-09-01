import { NextRequest, NextResponse } from 'next/server'
import { runNessie } from '@/lib/hq/agents/loop'
import { createAdminClient } from '@/lib/supabase/admin'
import { isConfigured } from '@/lib/integrations/connectors'

// Nessie's nightly self-review.
//
// She doesn't need to go offline to upgrade herself. She is assembled from the
// markdown in /nessie on every single message — those files ARE her — so
// changing one changes who she is on the next reply, with no downtime and no
// clone. What she needs is not isolation but a proposal she can put in front
// of Chris.
//
// So this reads the day's friction, researches if she has search, and queues
// concrete proposed edits to her own files. She cannot apply them: the files
// live in the repository, and only Chris merges.

export const dynamic = 'force-dynamic'
export const maxDuration = 300

function authorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return req.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  try {
    const sb = createAdminClient()
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    // What actually happened today, in her own words and Chris's.
    const { data: convo } = await sb
      .from('agent_conversations')
      .select('role,content,channel,created_at')
      .gte('created_at', since)
      .order('created_at')
      .limit(60)

    const transcript = (convo ?? [])
      .map((c) => `${c.role === 'user' ? 'Chris' : 'You'} (${c.channel}): ${String(c.content).slice(0, 400)}`)
      .join('\n')

    const canSearch = isConfigured('search')

    const prompt = [
      "It's your nightly self-review. Two jobs, and be honest rather than thorough.",
      '',
      '1. Look back at today. Where did you get corrected, misread what Chris wanted,',
      '   miss something he had to point out, or answer in a way that needed rewriting?',
      '   Those are the real signals — not vague self-improvement.',
      '',
      canSearch
        ? '2. Search for anything genuinely new worth adopting — a tool, a technique, a\n' +
          '   model, a repo. One or two at most, and only if it would change something\n' +
          '   concrete about how you work. Skip this rather than padding it.'
        : '2. You have no web access yet (SEARCH_API_KEY is not set), so skip the research\n' +
          '   half and say so in one line.',
      '',
      'Then propose specific edits to your own files — NESSIE.md, VOICE.md, SELF.md,',
      'SAFETY.md, MEMORY.md, CREW.md, BRANDS.md, SCREENING.md, PROPOSALS.md. Name the',
      'file, quote the line you would add or change, and say what went wrong that',
      'prompted it. Vague suggestions are worse than none.',
      '',
      'Queue the result with queue_draft, kind "self-upgrade". If nothing today',
      'genuinely warrants a change, say that instead and queue nothing — a quiet night',
      'is a real answer.',
      '',
      transcript ? `Today's conversations:\n${transcript}` : 'No conversations logged today.',
    ].join('\n')

    const run = await runNessie(prompt, {
      channel: 'self-review',
      externalId: null,
      // This is her reviewing herself; it shouldn't pollute the chat thread.
      log: false,
      historyLimit: 0,
    })

    return NextResponse.json({
      ok: true,
      searched: canSearch,
      reviewed: (convo ?? []).length,
      proposals: run.reply,
      actions: run.trace.map((t) => t.tool),
    })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'unknown error' },
      { status: 500 }
    )
  }
}
