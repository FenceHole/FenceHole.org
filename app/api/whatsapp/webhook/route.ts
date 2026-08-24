import { NextRequest, NextResponse } from 'next/server'
import { callOpenRouter, transcribeAudio } from '@/lib/hq/agents/llm'
import { NESSIE_SYSTEM_PROMPT } from '@/lib/hq/agents/nessie'
import { fetchTwilioMedia } from '@/lib/integrations/twilio'
import { runNessie } from '@/lib/hq/agents/loop'

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

  // One Nessie: the loop carries memory, per-number history, her tools, and
  // the MEMORY: protocol — and logs both sides of the exchange itself.
  // WhatsApp used to remember but had no ability to act.
  const run = await runNessie(text, {
    channel: 'whatsapp',
    externalId: from,
    framing: 'Chris just said this to you on WhatsApp. Keep it short enough to read on a phone.',
  })

  return twiml(run.reply)
}
