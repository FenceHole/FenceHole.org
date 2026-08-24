// The agentic loop. Nessie calls tools, reads the results, and keeps going
// until she has an answer — instead of guessing in a single pass.
//
// Bounded by MAX_STEPS so a confused model can't spin. Every tool call is
// recorded in the trace so Chris can see exactly what she did.

import { callOpenRouter, chatWithTools, type ChatMessage } from './llm'
import { NESSIE_TOOLS, runTool } from './tools'
import { NESSIE_SYSTEM_PROMPT } from './nessie'
import { MODEL_TIERS, classifyTask } from './router'

const MAX_STEPS = 6

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
}

function parseArgs(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw || '{}')
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

export async function runNessie(input: string, context?: string): Promise<NessieRun> {
  const tier = classifyTask(input)
  const model = MODEL_TIERS[tier].id
  const prompt = context ? `${context}\n\n${input}` : input

  // The voice tier is small talk — no tools needed, and the Hermes-class model
  // it uses has no tool-use endpoint. One clean call, straight in her voice.
  if (tier === 'simple') {
    const r = await callOpenRouter(model, NESSIE_SYSTEM_PROMPT, prompt)
    return { reply: r.content.trim(), trace: [], model: r.model, steps: 1 }
  }

  const messages: ChatMessage[] = [
    { role: 'system', content: NESSIE_SYSTEM_PROMPT },
    { role: 'user', content: prompt },
  ]

  const trace: TraceEntry[] = []
  let usedModel = model

  for (let step = 0; step < MAX_STEPS; step++) {
    const { message, model: got } = await chatWithTools(model, messages, NESSIE_TOOLS)
    usedModel = got
    messages.push(message)

    const calls = message.tool_calls ?? []
    if (calls.length === 0) {
      return {
        reply: (message.content ?? '').trim(),
        trace,
        model: usedModel,
        steps: step + 1,
      }
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
  return {
    reply:
      "I hit my step limit working through that. Here's what I got to — ask me to keep going and I'll pick it up.",
    trace,
    model: usedModel,
    steps: MAX_STEPS,
  }
}
