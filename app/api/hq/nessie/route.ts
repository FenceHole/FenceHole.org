import { NextRequest, NextResponse } from 'next/server'
import { runNessie } from '@/lib/hq/agents/loop'
import { classifyTask } from '@/lib/hq/agents/router'
import { logMessage } from '@/lib/hq/agents/memory'

const AGENT_ID = 'nessie-chief-of-staff'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const task = body?.task

  if (typeof task !== 'string' || !task.trim()) {
    return NextResponse.json({ error: 'task is required' }, { status: 400 })
  }

  try {
    const run = await runNessie(task)

    // Keep the cross-channel thread intact — web, WhatsApp and cron share it.
    await logMessage(AGENT_ID, 'web', null, 'user', task).catch(() => {})
    await logMessage(AGENT_ID, 'web', null, 'assistant', run.reply).catch(() => {})

    return NextResponse.json({
      reply: run.reply,
      model: run.model,
      tier: classifyTask(task),
      steps: run.steps,
      // What she actually did, so it can be shown rather than taken on trust.
      actions: run.trace.map((t) => ({ tool: t.tool, args: t.args })),
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
