// Thin client for OpenRouter — gives the AI Router access to Qwen and
// Claude models through a single API key.

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'

// OpenRouter failures arrive as raw JSON blobs. Chris sees these directly in
// the Hub, so translate the ones we expect into something a human can act on.
export function explainOpenRouterError(status: number, body: string): string {
  if (status === 402) {
    return (
      'Nessie is wired up correctly, but her OpenRouter account has no credits, ' +
      'so no model will answer. Add credits at https://openrouter.ai/settings/credits ' +
      'and she starts talking immediately.'
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
      'OpenRouter does not recognise that model id. Check it at ' +
      `https://openrouter.ai/models. OpenRouter said: ${body.slice(0, 260)}`
    )
  }
  if (status === 429) {
    return 'OpenRouter rate limit hit. Wait a moment and try again.'
  }
  return `OpenRouter error ${status}: ${body.slice(0, 300)}`
}

// Models to fall back to when the chosen one is unavailable — a wrong slug, no
// credits, or a provider the account won't use. Nessie going completely mute
// because of a catalogue change is a worse failure than answering on a
// different model, so a request walks this list before giving up.
export const FALLBACK_CHAIN = [
  process.env.NESSIE_MODEL_FALLBACK,
  // Verified against this account rather than assumed; deepseek/deepseek-chat
  // was in this list and had itself become unreachable.
  'meta-llama/llama-3.3-70b-instruct',
  // Then out from under OpenRouter altogether. These only enter the chain when
  // their key is set, and they are last on purpose: one OpenRouter key covers
  // everything, so prefer it while it works. They exist so that a catalogue
  // change cannot leave her mute — which is what happened on 2026-09-17, when
  // hermes-4-70b and llama-3.3-70b-instruct both 404'd in the same request and
  // there was nothing reachable left to fall back to.
  'direct/deepseek',
  'direct/nebius',
  'direct/grok',
].filter(Boolean) as string[]

/** 402 = no credits, 404 = unknown id or a provider the account disallows. */
function isAvailabilityFailure(status: number): boolean {
  return status === 402 || status === 404
}

interface FallbackFailure {
  status: number
  body: string
  tried: string[]
}

/**
 * Try `model`, then each fallback, stopping at the first that responds.
 *
 * On total failure this reports the FIRST failure, not the last. The last one
 * is whatever the final fallback happened to say, which describes a model
 * nobody asked for and buries the actual cause.
 */
async function withFallback(
  model: string,
  attempt: (m: string) => Promise<Response>
): Promise<{ res: Response; used: string } | { failure: FallbackFailure }> {
  const tried: string[] = []
  let first: { status: number; body: string } | null = null

  for (const candidate of [model, ...FALLBACK_CHAIN]) {
    if (tried.includes(candidate)) continue
    tried.push(candidate)

    const res = await attempt(candidate)
    if (res.ok) return { res, used: candidate }

    const body = await res.text()
    if (!first) first = { status: res.status, body }
    // Anything other than an availability problem won't be fixed by trying a
    // different model, so stop rather than burning credits on the same error.
    if (!isAvailabilityFailure(res.status)) break
  }

  return { failure: { status: first!.status, body: first!.body, tried } }
}

/** Error text for an exhausted chain, naming what else was attempted. */
function fallbackError(f: FallbackFailure): string {
  const base = explainOpenRouterError(f.status, f.body)
  return f.tried.length > 1
    ? `${base}\n\n(Also tried: ${f.tried.slice(1).join(', ')} — none worked.)`
    : base
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

// --- Direct providers -------------------------------------------------------
// Every outage so far has had the same shape: a slug this account could reach
// gets re-pointed at a provider it can't, and the tier dies with a 404 that
// looks like a typo. Adding another OpenRouter slug to the chain only buys time
// until the next re-point, because they all sit behind the same policy layer.
//
// So: when a maker's own API key is present, go straight to them. No catalogue,
// no allowed-providers filter, nothing that can be re-pointed out from under
// us. These are the escape hatch, and they belong at the END of the chain —
// OpenRouter first while it works, because one key there covers everything.
//
// All three speak the OpenAI chat format, so only the URL and the model name
// change. Model names are env-overridable because a maker renaming their own
// model should be a config edit, not a deploy.
const DIRECT_PROVIDERS: Record<
  string,
  { url: string; keyEnv: string; model: string }
> = {
  'direct/deepseek': {
    url: 'https://api.deepseek.com/v1/chat/completions',
    keyEnv: 'DEEPSEEK_API_KEY',
    model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
  },
  'direct/grok': {
    url: 'https://api.x.ai/v1/chat/completions',
    keyEnv: 'XAI_API_KEY',
    model: process.env.XAI_MODEL || 'grok-4.6',
  },
  'direct/nebius': {
    // Nebius is who serves Hermes on OpenRouter anyway, so going direct keeps
    // the Hermes voice without the policy layer in front of it.
    url: 'https://api.studio.nebius.com/v1/chat/completions',
    keyEnv: 'NEBIUS_API_KEY',
    model: process.env.NEBIUS_MODEL || 'NousResearch/Hermes-4-405B',
  },
}

/** A direct provider is only usable if its key is actually set. */
export function directProviderReady(id: string): boolean {
  const p = DIRECT_PROVIDERS[id]
  return Boolean(p && process.env[p.keyEnv])
}

async function postChat(model: string, systemPrompt: string, userPrompt: string) {
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]

  const direct = DIRECT_PROVIDERS[model]
  if (direct) {
    const key = process.env[direct.keyEnv]
    if (!key) {
      // Reported as a 404 so withFallback treats it as an availability problem
      // and moves on, rather than aborting the whole chain.
      return new Response(
        JSON.stringify({ error: { message: `${direct.keyEnv} is not set` } }),
        { status: 404 }
      )
    }
    return fetch(direct.url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: direct.model, messages }),
    })
  }

  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    throw new Error(
      'OPENROUTER_API_KEY is not configured — Nessie has no brain connected. ' +
      'Add it in Vercel under Settings > Environment Variables (Production). ' +
      'Or set DEEPSEEK_API_KEY, XAI_API_KEY or NEBIUS_API_KEY to skip ' +
      'OpenRouter entirely.'
    )
  }

  return fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model, messages }),
  })
}

export async function callOpenRouter(
  model: string,
  systemPrompt: string,
  userPrompt: string
): Promise<LLMResult> {
  const outcome = await withFallback(model, (m) => postChat(m, systemPrompt, userPrompt))
  if ('failure' in outcome) throw new Error(fallbackError(outcome.failure))
  const { res, used } = outcome

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

  const outcome = await withFallback(model, send)
  if ('failure' in outcome) throw new Error(fallbackError(outcome.failure))
  const { res, used } = outcome

  const data = await res.json()
  const choice = data.choices?.[0]?.message ?? { role: 'assistant', content: '' }
  return { message: choice as ChatMessage, model: data.model ?? used, usage: data.usage }
}
