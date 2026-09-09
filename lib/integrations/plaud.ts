// Plaud Embedded — transcription.
//
// Plaud's own ASR pipeline (language detection, noise reduction, speech-to-text,
// optional diarization), used server-side. The mobile SDKs in the Plaud skills
// are for apps that talk to the device over Bluetooth; this is the plain HTTP
// half, which is the part a web app can actually use.
//
// The base URL is required config rather than a default. The published docs
// were unreachable when this was written, and a guessed endpoint fails in a way
// that looks like a bug in this code rather than a missing setting.

const BASE = process.env.PLAUD_API_BASE // e.g. https://api.plaud.ai — see docs.plaud.ai
const CLIENT_ID = process.env.PLAUD_CLIENT_ID
const API_KEY = process.env.PLAUD_API_KEY

export function plaudConfigured(): boolean {
  return Boolean(BASE && CLIENT_ID && API_KEY)
}

function headers(): Record<string, string> {
  return {
    // Note: the api key is NOT the client secret — it comes from the developer
    // portal under App Settings > API Keys.
    'X-Client-Id': CLIENT_ID!,
    'X-Client-Api-Key': API_KEY!,
    'Content-Type': 'application/json',
  }
}

export interface TranscriptSegment {
  start: number
  end: number
  text: string
  speaker_id?: string
  language?: string
}

export interface TranscriptResult {
  status: string
  text?: string
  language?: string
  duration?: number
  segments?: TranscriptSegment[]
}

/** Plaud accepts these; anything else has to be converted first. */
export const SUPPORTED_FORMATS = ['m4a', 'mp3', 'wav'] as const

export function isSupportedAudio(nameOrType: string): boolean {
  const s = nameOrType.toLowerCase()
  return SUPPORTED_FORMATS.some((f) => s.endsWith(f) || s.includes(`/${f}`) || s.includes('mpeg'))
}

/**
 * Submit a publicly-downloadable audio URL for transcription.
 * Returns the task id to poll.
 */
export async function submitTranscription(
  fileUrl: string,
  opts: { language?: string; diarize?: boolean } = {}
): Promise<string> {
  if (!plaudConfigured()) throw new Error('Plaud is not configured')

  const res = await fetch(`${BASE}/transcription/task`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      file_url: fileUrl,
      params: {
        transcribe: { language: opts.language ?? 'auto', detection_level: 'segment' },
        // Speaker labels are the reason to use Plaud over a generic ASR, so
        // they're on by default here.
        diarization: { enabled: opts.diarize ?? true, return_embedding: false },
      },
    }),
  })

  if (!res.ok) throw new Error(`Plaud submit ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const data = (await res.json()) as Record<string, any>
  const id = data.task_id ?? data.id ?? data.data?.task_id
  if (!id) throw new Error('Plaud accepted the job but returned no task id')
  return String(id)
}

/** Poll one task. PENDING/RECEIVED/STARTED/PROGRESS mean keep waiting. */
export async function getTranscription(taskId: string): Promise<TranscriptResult> {
  if (!plaudConfigured()) throw new Error('Plaud is not configured')

  const res = await fetch(`${BASE}/transcription/task/${encodeURIComponent(taskId)}`, {
    headers: headers(),
  })
  if (!res.ok) throw new Error(`Plaud status ${res.status}: ${(await res.text()).slice(0, 200)}`)

  const body = (await res.json()) as Record<string, any>
  const status = String(body.status ?? body.data?.status ?? 'UNKNOWN')
  const data = body.data ?? {}

  return {
    status,
    text: data.text,
    language: data.language,
    duration: data.duration,
    segments: Array.isArray(data.segments) ? data.segments : undefined,
  }
}

export function isTerminalFailure(status: string): boolean {
  return status === 'FAILURE' || status === 'REVOKED'
}

export function isDone(status: string): boolean {
  return status === 'SUCCESS'
}

/** Readable transcript with speaker labels, for handing to Nessie. */
export function formatTranscript(result: TranscriptResult): string {
  if (!result.segments?.length) return result.text ?? ''
  const lines: string[] = []
  let current = ''
  let buffer: string[] = []

  for (const seg of result.segments) {
    const speaker = seg.speaker_id ? `Speaker ${seg.speaker_id}` : 'Speaker'
    if (speaker !== current) {
      if (buffer.length) lines.push(`${current}: ${buffer.join(' ')}`)
      current = speaker
      buffer = []
    }
    buffer.push(seg.text.trim())
  }
  if (buffer.length) lines.push(`${current}: ${buffer.join(' ')}`)
  return lines.join('\n')
}
