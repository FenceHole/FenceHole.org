// Thin client for OpenRouter — gives the AI Router access to Qwen and
// Claude models through a single API key.

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'

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

export async function callOpenRouter(
  model: string,
  systemPrompt: string,
  userPrompt: string
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
        { role: 'user', content: userPrompt },
      ],
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`OpenRouter error ${res.status}: ${text}`)
  }

  const data = await res.json()
  return {
    content: data.choices?.[0]?.message?.content ?? '',
    model: data.model ?? model,
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
    throw new Error(`OpenRouter error ${res.status}: ${text}`)
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
