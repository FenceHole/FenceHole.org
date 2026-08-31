// Thin client for OpenRouter — gives the AI Router access to Qwen and
// Claude models through a single API key.

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'

// Models to fall back to when the chosen one is unavailable — a wrong slug, no
// credits, or a provider the account won't use. Nessie going completely mute
// because of a catalogue change is a worse failure than answering on a
// different model, so a request walks this list before giving up.
export const FALLBACK_CHAIN = [
  process.env.NESSIE_MODEL_FALLBACK,
  'deepseek/deepseek-chat',
  'anthropic/claude-3.5-haiku',
].filter(Boolean) as string[]

/** 402 = no credits, 404 = unknown id or a provider the account disallows. */
function isAvailabilityFailure(status: number): boolean {
  return status === 402 || status === 404
}

/** Try `model`, then each fallback, stopping at the first that responds. */
async function withFallback(
  model: string,
  attempt: (m: string) => Promise<Response>
): Promise<{ res: Response; used: string }> {
  const tried = new Set<string>()
  let last: Response | null = null

  for (const candidate of [model, ...FALLBACK_CHAIN]) {
    if (tried.has(candidate)) continue
    tried.add(candidate)
    const res = await attempt(candidate)
    if (res.ok) return { res, used: candidate }
    last = res
    if (!isAvailabilityFailure(res.status)) break
  }

  return { res: last!, used: model }
}

// OpenRouter failures arrive as raw JSON blobs. Chris sees these directly in
// the Hub, so translate the ones we expect into something a human can act on.
export function explainOpenRouterError(status: number, body: string): string {
  if (status === 402) {
    return (
      'Nessie is wired up correctly, but her OpenRouter account has no credits, ' +
      'so no model will answer. Add credits at https://openrouter.ai/settings/credits ' +
      '(a few dollars covers months at this volume) and she starts talking immediately. ' +
      'To run her on a free model instead, set NESSIE_MODEL_FALLBACK to a ":free" ' +
      'model id from https://openrouter.ai/models.'
    )
  }
  if (status === 401 || status === 403) {
    return 'OpenRouter rejected the API key. Check OPENROUTER_API_KEY in Vercel (Production).'
  }
  if (status === 404) {
    // Two very different causes share this status. An allowed-providers or
    // data-policy restriction means the id is fine and the account simply
    // won't use the provider serving it — a settings fix, not a code fix.
    if (/allowed providers|allowed-providers|data policy/i.test(body)) {
      return (
        'That model is real, but your OpenRouter account will not use the provider that ' +
        'serves it. Either widen the allowed providers at ' +
        'https://openrouter.ai/settings/preferences, or pick a model from a provider you ' +
        `already allow (Nessie's Brain page can test one). OpenRouter said: ${body.slice(0, 260)}`
      )
    }
    return (
      `OpenRouter does not recognise that model id. Check it at ` +
      `https://openrouter.ai/models. OpenRouter said: ${body.slice(0, 260)}`
    )
  }
  if (status === 429) {
    return 'OpenRouter rate limit hit. Wait a moment and try again.'
  }
  return `OpenRouter error ${status}: ${body.slice(0, 300)}`
}

export interface LLMUsage {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
}

export interface LLMResult {
  content: string
  model: string
  usage?: LLMUsage
}

async function postChat(model: string, systemPrompt: string, userPrompt: string) {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    throw new Error(
      'OPENROUTER_API_KEY is not configured — Nessie has no brain connected. ' +
      'Add it in Vercel under Settings > Environment Variables (Production).'
    )
  }

  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  })

  return res
}

export async function callOpenRouter(
  model: string,
  systemPrompt: string,
  userPrompt: string
): Promise<LLMResult> {
  const { res, used } = await withFallback(model, (m) => postChat(m, systemPrompt, userPrompt))

  if (!res.ok) {
    const text = await res.text()
    throw new Error(explainOpenRouterError(res.status, text))
  }

  const data = await res.json()
  return {
    content: data.choices?.[0]?.message?.content ?? '',
    model: data.model ?? used,
    usage: data.usage,
  }
}

// Free vision-capable model — used for marketplace photo analysis from WhatsApp.
export const VISION_MODEL = 'meta-llama/llama-3.2-11b-vision-instruct:free'

export async function callOpenRouterVision(
  model: string,
  systemPrompt: string,
  userPrompt: string,
  imageDataUrl: string
): Promise<LLMResult> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not configured')
  }

  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            { type: 'text', text: userPrompt },
            { type: 'image_url', image_url: { url: imageDataUrl } },
          ],
        },
      ],
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(explainOpenRouterError(res.status, text))
  }

  const data = await res.json()
  return {
    content: data.choices?.[0]?.message?.content ?? '',
    model: data.model ?? model,
    usage: data.usage,
  }
}

// Free Whisper transcription via Groq — used for WhatsApp voice notes.
export async function transcribeAudio(buffer: ArrayBuffer, contentType: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    throw new Error('GROQ_API_KEY is not configured')
  }

  const ext = contentType.includes('ogg') ? 'ogg' : contentType.includes('mp3') ? 'mp3' : contentType.includes('wav') ? 'wav' : 'm4a'
  const form = new FormData()
  form.append('file', new Blob([buffer], { type: contentType }), `audio.${ext}`)
  form.append('model', 'whisper-large-v3-turbo')

  const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Groq transcription error ${res.status}: ${text}`)
  }

  const data = await res.json()
  return data.text ?? ''
}

// --- Tool-calling ------------------------------------------------------
// OpenRouter speaks the OpenAI chat format, so tools and tool results are
// passed through as-is. Used by the agentic loop in loop.ts.

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  tool_calls?: ToolCall[]
  tool_call_id?: string
  name?: string
}

export interface ToolCall {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

export interface ChatResult {
  message: ChatMessage
  model: string
  usage?: LLMUsage
}

export async function chatWithTools(
  model: string,
  messages: ChatMessage[],
  tools: unknown[]
): Promise<ChatResult> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    throw new Error(
      'OPENROUTER_API_KEY is not configured — Nessie has no brain connected. ' +
      'Add it in Vercel under Settings > Environment Variables (Production).'
    )
  }

  const send = (m: string) =>
    fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: m, messages, tools, tool_choice: 'auto' }),
    })

  const { res, used } = await withFallback(model, send)

  if (!res.ok) {
    const text = await res.text()
    throw new Error(explainOpenRouterError(res.status, text))
  }

  const data = await res.json()
  const choice = data.choices?.[0]?.message ?? { role: 'assistant', content: '' }
  return { message: choice as ChatMessage, model: data.model ?? used, usage: data.usage }
}
