import { NextRequest, NextResponse } from 'next/server'
import { pickModel } from '@/lib/hq/agents/router'
import { callOpenRouter, transcribeAudio } from '@/lib/hq/agents/llm'
import { NESSIE_SYSTEM_PROMPT } from '@/lib/hq/agents/nessie'
import { fetchTwilioMedia } from '@/lib/integrations/twilio'
import { recallMemory, remember, logMessage, getConversationHistory } from '@/lib/hq/agents/memory'

const AGENT_ID = 'nessie-chief-of-staff'
const ALLOWED = (process.env.WHATSAPP_ALLOWED_NUMBERS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

function twiml(message: string) {
  const escaped = message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escaped}</Message></Response>`, {
    headers: { 'Content-Type': 'text/xml' },
  })
}

export async function POST(req: NextRequest) {
  const form = await req.formData()
  const from = String(form.get('From') ?? '')
  const body = String(form.get('Body') ?? '').trim()
  const numMedia = parseInt(String(form.get('NumMedia') ?? '0'), 10)

  if (ALLOWED.length && !ALLOWED.includes(from)) {
    return twiml("This number isn't on Nessie's allowlist yet — ask Chris to add it in Vercel env vars (WHATSAPP_ALLOWED_NUMBERS).")
  }

  try {
    if (numMedia > 0) {
      const mediaType = String(form.get('MediaContentType0') ?? '')
      const mediaUrl = String(form.get('MediaUrl0') ?? '')

      if (mediaType.startsWith('audio/')) {
        const { buffer } = await fetchTwilioMedia(mediaUrl)
        const transcript = await transcribeAudio(buffer, mediaType)
        return await handleText(from, transcript || body)
      }

      // Photos/other media aren't handled by the Hub — marketplace listings
      // live in a separate freestanding app. Fall through to text if there's
      // a caption, otherwise say so.
      if (!body) {
        return twiml("I don't handle photos here — that lives in the separate marketplace app. Send me a message and I've got you.")
      }
    }

    return await handleText(from, body)
  } catch (err) {
    return twiml(`Nessie hit a snag: ${err instanceof Error ? err.message : 'unknown error'}`)
  }
}

async function handleText(from: string, text: string) {
  if (!text) return twiml("Didn't catch that — try again?")

  await logMessage(AGENT_ID, 'whatsapp', from, 'user', text)
  const [history, memories] = await Promise.all([
    getConversationHistory(AGENT_ID, 'whatsapp', from, 10),
    recallMemory(AGENT_ID, 15),
  ])

  const context = [
    memories.length ? `Things you remember about Chris's life/business:\n${memories.map((m) => `- [${m.category}] ${m.content}`).join('\n')}` : '',
    history.length ? `Recent WhatsApp conversation:\n${history.map((h) => `${h.role === 'user' ? 'Chris' : 'Nessie'}: ${h.content}`).join('\n')}` : '',
    `Chris just said (on WhatsApp): ${text}`,
    `\nIf anything here is worth remembering long-term (a preference, a fact about a client/brand/pet, a recurring task), end your reply with one extra line starting "MEMORY:" summarizing it in one sentence. Only do this when it's genuinely worth keeping.`,
  ].filter(Boolean).join('\n\n')

  const model = pickModel(context)
  const result = await callOpenRouter(model.id, NESSIE_SYSTEM_PROMPT, context)

  let reply = result.content
  const memMatch = reply.match(/\n+MEMORY:\s*(.+)$/i)
  if (memMatch) {
    await remember(AGENT_ID, 'whatsapp-note', memMatch[1].trim())
    reply = reply.replace(/\n+MEMORY:\s*(.+)$/i, '').trim()
  }

  await logMessage(AGENT_ID, 'whatsapp', from, 'assistant', reply)
  return twiml(reply)
}
