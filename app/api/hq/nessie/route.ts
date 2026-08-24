import { NextRequest, NextResponse } from 'next/server'
import { runNessie } from '@/lib/hq/agents/loop'
import { classifyTask } from '@/lib/hq/agents/router'
import { createClient } from '@/lib/supabase/server'

export const maxDuration = 120

export async function POST(req: NextRequest) {
  // Nessie costs money to run and reads the whole business — team only.
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { data: profile } = await sb.from('profiles').select('role,full_name').eq('id', user.id).single()
  if (profile?.role !== 'team') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const body = await req.json().catch(() => null)
  const task = body?.task

  if (typeof task !== 'string' || !task.trim()) {
    return NextResponse.json({ error: 'task is required' }, { status: 400 })
  }

  try {
    const who = profile?.full_name?.split(' ')[0] ?? 'Chris'
    const run = await runNessie(task, {
      channel: 'web',
      externalId: null,
      framing: `${who} is talking to you in the Hub.`,
    })

    return NextResponse.json({
      reply: run.reply,
      model: run.model,
      tier: classifyTask(task),
      steps: run.steps,
      remembered: run.remembered ?? null,
      actions: run.trace.map((t) => ({ tool: t.tool, args: t.args })),
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
