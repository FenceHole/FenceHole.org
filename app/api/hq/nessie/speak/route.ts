import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Nessie's real voice.
//
// Browser speech synthesis has a hard ceiling — even the best installed voice
// is concatenative and sounds it. This proxies a neural TTS engine instead,
// server-side so the API key never reaches the browser.
//
// Whichever key is present wins. With none, this returns 503 and the client
// falls back to browser speech, so the feature degrades rather than breaking.

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Sensible defaults; both overridable without a deploy.
const ELEVEN_VOICE = process.env.ELEVENLABS_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL' // "Sarah" — warm, measured
const ELEVEN_MODEL = process.env.ELEVENLABS_MODEL || 'eleven_flash_v2_5'      // low latency, for conversation
const OPENAI_VOICE = process.env.OPENAI_TTS_VOICE || 'nova'

export async function POST(req: NextRequest) {
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { data: p } = await sb.from('profiles').select('role').eq('id', user.id).single()
  if (p?.role !== 'team') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const body = await req.json().catch(() => null)
  const text = String(body?.text ?? '').trim().slice(0, 4000)
  if (!text) return NextResponse.json({ error: 'text is required' }, { status: 400 })

  try {
    if (process.env.ELEVENLABS_API_KEY) {
      const res = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${ELEVEN_VOICE}?output_format=mp3_44100_128`,
        {
          method: 'POST',
          headers: {
            'xi-api-key': process.env.ELEVENLABS_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text,
            model_id: ELEVEN_MODEL,
            voice_settings: {
              // Stability low enough to carry inflection, high enough not to
              // wander between sentences.
              stability: 0.45,
              similarity_boost: 0.8,
              style: 0.3,
              use_speaker_boost: true,
            },
          }),
        }
      )
      if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 200)}`)
      return new NextResponse(await res.arrayBuffer(), {
        headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' },
      })
    }

    if (process.env.OPENAI_API_KEY) {
      const res = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ model: 'tts-1', voice: OPENAI_VOICE, input: text, speed: 1.05 }),
      })
      if (!res.ok) throw new Error(`OpenAI TTS ${res.status}: ${(await res.text()).slice(0, 200)}`)
      return new NextResponse(await res.arrayBuffer(), {
        headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' },
      })
    }

    // No engine configured. 503 rather than an error the caller can't act on —
    // the client reads this and falls back to browser speech.
    return NextResponse.json(
      {
        error: 'no_tts_configured',
        message:
          'No neural voice is connected. Set ELEVENLABS_API_KEY (best) or OPENAI_API_KEY in Vercel.',
      },
      { status: 503 }
    )
  } catch (err) {
    return NextResponse.json(
      { error: 'tts_failed', message: err instanceof Error ? err.message : 'unknown error' },
      { status: 502 }
    )
  }
}
