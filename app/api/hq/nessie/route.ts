import { NextRequest, NextResponse } from 'next/server'
import { runNessie } from '@/lib/hq/agents/loop'
import { classifyTask } from '@/lib/hq/agents/router'
import { callOpenRouterVision, VISION_MODEL } from '@/lib/hq/agents/llm'
import { NESSIE_SYSTEM_PROMPT } from '@/lib/hq/agents/nessie'
import { createClient } from '@/lib/supabase/server'

export const maxDuration = 120

interface Attachment {
  name: string
  kind: 'text' | 'image'
  /** Extracted text, for text files. */
  text?: string
  /** data: URL, for images. */
  dataUrl?: string
}

// Text attachments are folded into the prompt. Generous but bounded — a long
// document shouldn't crowd out her memory and the conversation.
const MAX_TEXT_PER_FILE = 20_000

export async function POST(req: NextRequest) {
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { data: profile } = await sb.from('profiles').select('role,full_name').eq('id', user.id).single()
  if (profile?.role !== 'team') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const body = await req.json().catch(() => null)
  const task = typeof body?.task === 'string' ? body.task : ''
  const attachments: Attachment[] = Array.isArray(body?.attachments) ? body.attachments : []

  if (!task.trim() && attachments.length === 0) {
    return NextResponse.json({ error: 'task is required' }, { status: 400 })
  }

  const who = profile?.full_name?.split(' ')[0] ?? 'Chris'
  const room = typeof body?.room === 'string' ? body.room.slice(0, 120) : null

  try {
    const images = attachments.filter((a) => a.kind === 'image' && a.dataUrl)
    const texts = attachments.filter((a) => a.kind === 'text' && a.text)

    // An image needs a vision-capable model, which is a different call shape
    // than the tool loop. Handled separately and described back into the
    // conversation so the rest of the thread still has the context.
    if (images.length > 0) {
      const prompt = task.trim() || 'What is this? Be useful about it.'
      const result = await callOpenRouterVision(
        process.env.NESSIE_MODEL_VISION || VISION_MODEL,
        NESSIE_SYSTEM_PROMPT,
        prompt,
        images[0].dataUrl!
      )
      return NextResponse.json({
        reply: result.content,
        model: result.model,
        tier: 'vision',
        steps: 1,
        actions: [{ tool: 'look_at_image', args: { file: images[0].name } }],
        remembered: null,
      })
    }

    const attached = texts.length
      ? `${who} attached ${texts.length} file${texts.length === 1 ? '' : 's'}:\n\n` +
        texts
          .map((t) => `--- ${t.name} ---\n${(t.text ?? '').slice(0, MAX_TEXT_PER_FILE)}`)
          .join('\n\n')
      : ''

    const run = await runNessie(
      attached ? `${task.trim()}\n\n${attached}`.trim() : task,
      {
        channel: 'web',
        externalId: null,
        framing: room
          ? `${who} is talking to you from ${room} in the Hub.`
          : `${who} is talking to you in the Hub.`,
      }
    )

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
