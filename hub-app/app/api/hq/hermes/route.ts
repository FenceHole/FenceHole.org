import { NextRequest, NextResponse } from 'next/server'
import { pickModel } from '@/lib/hq/agents/router'
import { callOpenRouter } from '@/lib/hq/agents/llm'
import { HERMES_SYSTEM_PROMPT } from '@/lib/hq/agents/hermes'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const task = body?.task

  if (typeof task !== 'string' || !task.trim()) {
    return NextResponse.json({ error: 'task is required' }, { status: 400 })
  }

  const model = pickModel(task)

  try {
    const result = await callOpenRouter(model.id, HERMES_SYSTEM_PROMPT, task)
    return NextResponse.json({
      plan: result.content,
      model: result.model,
      tier: model.tier,
      usage: result.usage,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
