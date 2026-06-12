import { NextRequest, NextResponse } from 'next/server'
import { remember, logMessage } from '@/lib/hq/agents/memory'

const AGENT_ID = 'nessie-chief-of-staff'

// Generic inbound webhook for Zapier (e.g. Plaud AI Pin notes/transcripts).
// POST { text: string, source?: string } with ?secret=ZAPIER_WEBHOOK_SECRET
export async function POST(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (process.env.ZAPIER_WEBHOOK_SECRET && secret !== process.env.ZAPIER_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const payload = await req.json().catch(() => null)
  const text = payload?.text ?? payload?.transcript ?? payload?.note
  if (typeof text !== 'string' || !text.trim()) {
    return NextResponse.json({ error: 'text is required' }, { status: 400 })
  }

  const source = typeof payload?.source === 'string' ? payload.source : 'plaud'
  await remember(AGENT_ID, source, text.trim())
  await logMessage(AGENT_ID, source, null, 'user', text.trim())

  return NextResponse.json({ ok: true })
}
