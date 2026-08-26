// The agentic loop. Nessie calls tools, reads the results, and keeps going
// until she has an answer — instead of guessing in a single pass.
//
// Memory and conversation history live here rather than in each route, so
// every channel (web, WhatsApp, team chat, cron) gets the same Nessie: one
// that both remembers and can act. Previously the channels that remembered
// couldn't use tools, and the one with tools remembered nothing.
//
// Bounded by MAX_STEPS so a confused model can't spin. Every tool call is
// recorded in the trace so Chris can see exactly what she did.

import { callOpenRouter, chatWithTools, type ChatMessage } from './llm'
import { NESSIE_TOOLS, runTool } from './tools'
import { NESSIE_SYSTEM_PROMPT } from './nessie'
import { classifyTask } from './router'
import { recallMemory, remember, logMessage, getConversationHistory } from './memory'
import { resolveModel } from './settings'

const MAX_STEPS = 6
export const AGENT_ID = 'nessie-chief-of-staff'

// She is told to end a reply with this when something is worth keeping. It is
// saved and stripped before anyone sees it — see nessie/MEMORY.md.
const MEMORY_LINE = /\n+MEMORY:\s*(.+)\s*$/i

export interface TraceEntry {
  tool: string
  args: Record<string, unknown>
  result: unknown
}

export interface NessieRun {
  reply: string
  trace: TraceEntry[]
  model: string
  steps: number
  remembered?: string
}

export interface RunOptions {
  /** Which surface this came from — keeps threads separate. */
  channel?: string
  /** Per-thread key (a phone number for WhatsApp); null = one shared thread. */
  externalId?: string | null
  /** Channel-specific framing prepended to the user's message. */
  framing?: string
  /** How many prior turns to replay. */
  historyLimit?: number
  /** Write both sides of the exchange to agent_conversations. */
  log?: boolean
}

function parseArgs(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw || '{}')
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

/** Pull out a trailing MEMORY: line, save it, and return the clean reply. */
async function captureMemory(reply: string, category: string): Promise<{ reply: string; remembered?: string }> {
  const match = reply.match(MEMORY_LINE)
  if (!match) return { reply: reply.trim() }
  const note = match[1].trim()
  try {
    await remember(AGENT_ID, category, note)
  } catch {
    // Losing a memory is not worth failing the reply over.
  }
  return { reply: reply.replace(MEMORY_LINE, '').trim(), remembered: note }
}

export async function runNessie(input: string, opts: RunOptions = {}): Promise<NessieRun> {
  const {
    channel = 'web',
    externalId = null,
    framing,
    historyLimit = 10,
    log = true,
  } = opts

  const tier = classifyTask(input)

  const [model, memories, history] = await Promise.all([
    // A Hub override wins over the env default, so a model can be swapped live.
    resolveModel(tier),
    recallMemory(AGENT_ID, 15).catch(() => []),
    getConversationHistory(AGENT_ID, channel, externalId, historyLimit).catch(() => []),
  ])

  const preamble = memories.length
    ? `What you remember about Chris's life and business:\n${memories
        .map((m) => `- [${m.category}] ${m.content}`)
        .join('\n')}`
    : ''

  const messages: ChatMessage[] = [
    { role: 'system', content: preamble ? `${NESSIE_SYSTEM_PROMPT}\n\n---\n\n${preamble}` : NESSIE_SYSTEM_PROMPT },
    // Real prior turns, so she can follow a thread rather than restarting.
    ...history.map((h) => ({
      role: h.role === 'assistant' ? ('assistant' as const) : ('user' as const),
      content: h.content,
    })),
    { role: 'user', content: framing ? `${framing}\n\n${input}` : input },
  ]

  if (log) await logMessage(AGENT_ID, channel, externalId, 'user', input).catch(() => {})

  const finish = async (reply: string, trace: TraceEntry[], usedModel: string, steps: number) => {
    const { reply: clean, remembered } = await captureMemory(reply, `${channel}-note`)
    if (log) await logMessage(AGENT_ID, channel, externalId, 'assistant', clean).catch(() => {})
    return { reply: clean, trace, model: usedModel, steps, remembered }
  }

  // The voice tier is small talk — no tools needed, and the Hermes-class model
  // it uses has no tool-use endpoint. One clean call, straight in her voice.
  if (tier === 'simple') {
    const r = await callOpenRouter(
      model,
      messages[0].content ?? NESSIE_SYSTEM_PROMPT,
      [...history.map((h) => `${h.role === 'assistant' ? 'You' : 'Chris'}: ${h.content}`), input].join('\n')
    )
    return finish(r.content, [], r.model, 1)
  }

  const trace: TraceEntry[] = []
  let usedModel = model

  for (let step = 0; step < MAX_STEPS; step++) {
    const { message, model: got } = await chatWithTools(model, messages, NESSIE_TOOLS)
    usedModel = got
    messages.push(message)

    const calls = message.tool_calls ?? []
    if (calls.length === 0) {
      return finish(message.content ?? '', trace, usedModel, step + 1)
    }

    // Run every tool the model asked for this turn, then feed results back.
    for (const call of calls) {
      const args = parseArgs(call.function.arguments)
      let result: unknown
      try {
        result = await runTool(call.function.name, args)
      } catch (err) {
        result = { error: err instanceof Error ? err.message : 'tool failed' }
      }
      trace.push({ tool: call.function.name, args, result })
      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        name: call.function.name,
        content: JSON.stringify(result).slice(0, 4000),
      })
    }
  }

  // Ran out of steps — say so rather than inventing a conclusion.
  return finish(
    "I hit my step limit working through that. Here's what I got to — ask me to keep going and I'll pick it up.",
    trace,
    usedModel,
    MAX_STEPS
  )
}
