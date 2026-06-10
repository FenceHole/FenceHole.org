'use client'

import { useState } from 'react'
import Link from 'next/link'

const TIER_LABEL: Record<string, string> = {
  simple: 'Qwen 2.5 7B (cheap)',
  standard: 'Qwen 2.5 72B',
  complex: 'Claude 3.5 Haiku',
}

export default function HermesPage() {
  const [task, setTask] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [plan, setPlan] = useState<string | null>(null)
  const [tier, setTier] = useState<string | null>(null)
  const [model, setModel] = useState<string | null>(null)
  const [usage, setUsage] = useState<{ prompt_tokens: number; completion_tokens: number; total_tokens: number } | null>(null)

  async function ask(e: React.FormEvent) {
    e.preventDefault()
    if (!task.trim()) return
    setLoading(true)
    setError(null)
    setPlan(null)
    try {
      const res = await fetch('/api/hq/hermes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Request failed')
      setPlan(data.plan)
      setTier(data.tier)
      setModel(data.model)
      setUsage(data.usage ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-10 flex flex-col gap-6">
      <div>
        <Link href="/hq" className="text-xs text-amber-400/70 hover:text-amber-300">
          ← Back to Command Center
        </Link>
        <h1 className="text-xl font-semibold text-white mt-2">Hermes Coordinator</h1>
        <p className="text-sm text-white/50 mt-1">
          Describe a task and Hermes will draft a plan, routed through the cheapest safe model.
          Drafts only — nothing here takes external action.
        </p>
      </div>

      <form onSubmit={ask} className="flex flex-col gap-3">
        <textarea
          value={task}
          onChange={(e) => setTask(e.target.value)}
          placeholder="e.g. Organize this week's pet care cases by urgency and summarize what needs attention."
          rows={5}
          className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-amber-400/40"
        />
        <button
          type="submit"
          disabled={loading || !task.trim()}
          className="self-start rounded-lg border border-amber-400/30 bg-amber-400/10 px-4 py-2 text-xs font-semibold text-amber-300 hover:bg-amber-400/20 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? 'Thinking…' : 'Ask Hermes'}
        </button>
      </form>

      {error && (
        <div className="rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-300">
          {error}
          {error.includes('OPENROUTER_API_KEY') && (
            <p className="mt-2 text-red-300/70">
              Add OPENROUTER_API_KEY in Vercel → Project → Settings → Environment Variables, then redeploy.
            </p>
          )}
        </div>
      )}

      {plan && (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 font-semibold text-amber-300">
              {tier ? TIER_LABEL[tier] ?? tier : ''}
            </span>
            {model && <span className="text-white/40">model: {model}</span>}
            {usage && (
              <span className="text-white/40">
                tokens: {usage.total_tokens} ({usage.prompt_tokens} in / {usage.completion_tokens} out)
              </span>
            )}
          </div>
          <p className="text-sm text-white/80 whitespace-pre-wrap leading-relaxed">{plan}</p>
        </div>
      )}
    </div>
  )
}
