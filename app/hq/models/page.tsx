'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

// Nessie's brain, swappable from here. OpenRouter's catalogue moves and new
// models land constantly; this makes trying one a thirty-second job instead of
// a code change and a deploy.

interface Tier {
  tier: string
  label: string
  default: string
  override: string | null
  active: string
  uses_tools: boolean
}

interface TestResult {
  ok: boolean
  model: string
  answered_as?: string
  supports_tools?: boolean
  called_tools?: string[]
  replied?: boolean
  error?: string
  ms: number
}

const SUGGESTIONS = [
  'x-ai/grok-4',
  'x-ai/grok-3',
  'x-ai/grok-2-1212',
  'deepseek/deepseek-chat',
  'qwen/qwen3-8b',
  'nousresearch/hermes-4-70b',
]

export default function ModelsPage() {
  const [tiers, setTiers] = useState<Tier[]>([])
  const [candidate, setCandidate] = useState('x-ai/grok-4')
  const [result, setResult] = useState<TestResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')

  async function load() {
    const res = await fetch('/api/hq/models')
    if (res.ok) setTiers((await res.json()).tiers ?? [])
  }

  useEffect(() => { load() }, [])

  async function test() {
    if (!candidate.trim()) return
    setBusy(true); setResult(null); setNote('')
    try {
      const res = await fetch('/api/hq/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test', model: candidate.trim() }),
      })
      setResult(await res.json())
    } finally {
      setBusy(false)
    }
  }

  async function assign(tier: string) {
    setBusy(true)
    try {
      await fetch('/api/hq/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set', tier, model: candidate.trim() }),
      })
      setNote(`${candidate.trim()} is now Nessie's ${tier} tier. Takes effect within 30 seconds.`)
      await load()
    } finally {
      setBusy(false)
    }
  }

  async function reset(tier: string) {
    setBusy(true)
    try {
      await fetch('/api/hq/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset', tier }),
      })
      setNote(`${tier} tier restored to its built-in default.`)
      await load()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 flex flex-col gap-8">
      <div>
        <Link href="/hq" className="text-xs text-amber-400/70 hover:text-amber-300">
          ← Back to Command Center
        </Link>
        <h1 className="font-display text-2xl text-amber-200 mt-3">Nessie&apos;s Brain</h1>
        <div className="gold-divider w-20 mt-3" />
        <p className="text-sm text-white/50 mt-3 leading-relaxed">
          Three tiers. Short messages use the voice model; real work uses the worker and
          harness models, which must support tool-calling or she can&apos;t read your data.
          Test any OpenRouter model id here before you trust it with a tier.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {tiers.map((t) => (
          <div key={t.tier} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-white/40">{t.tier}</p>
                <p className="font-mono text-sm text-white/90 mt-0.5">{t.active}</p>
              </div>
              <div className="flex items-center gap-2">
                {t.uses_tools && (
                  <span className="rounded border border-amber-400/25 bg-amber-400/10 px-2 py-0.5 text-[10px] text-amber-300">
                    needs tools
                  </span>
                )}
                {t.override && (
                  <button
                    onClick={() => reset(t.tier)}
                    disabled={busy}
                    className="rounded-lg border border-white/10 px-2.5 py-1 text-[11px] text-white/50 hover:text-white/80"
                  >
                    reset
                  </button>
                )}
              </div>
            </div>
            {t.override && (
              <p className="text-[11px] text-white/35 mt-2">default: {t.default}</p>
            )}
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 flex flex-col gap-3">
        <p className="text-[11px] uppercase tracking-widest text-white/40">Try a model</p>
        <div className="flex gap-2 flex-wrap">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => setCandidate(s)}
              className="rounded border border-white/10 bg-white/[0.04] px-2 py-1 font-mono text-[11px] text-white/60 hover:text-white/90"
            >
              {s}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            className="input font-mono text-sm"
            value={candidate}
            onChange={(e) => setCandidate(e.target.value)}
            placeholder="provider/model-id"
          />
          <button className="btn-primary whitespace-nowrap" onClick={test} disabled={busy}>
            {busy ? 'Testing…' : 'Test'}
          </button>
        </div>
        <p className="text-[11px] text-white/35">
          Exact ids are listed at openrouter.ai/models. A wrong id fails loudly rather than
          silently falling back.
        </p>

        {result && (
          <div className={`rounded-lg border p-3 text-sm ${result.ok ? 'border-emerald-400/25 bg-emerald-400/[0.06]' : 'border-red-400/25 bg-red-400/[0.06]'}`}>
            {result.ok ? (
              <>
                <p className="text-emerald-300 font-semibold">
                  Works — replied in {(result.ms / 1000).toFixed(1)}s
                </p>
                <p className="text-white/60 text-[12px] mt-1">
                  {result.supports_tools
                    ? `Called tools (${result.called_tools?.join(', ')}) — safe for any tier.`
                    : 'Answered but did not call tools — only suitable for the voice tier.'}
                </p>
                {result.answered_as && result.answered_as !== result.model && (
                  <p className="text-white/40 text-[11px] mt-1">served as {result.answered_as}</p>
                )}
                <div className="flex gap-2 mt-3 flex-wrap">
                  {tiers
                    .filter((t) => (result.supports_tools ? true : !t.uses_tools))
                    .map((t) => (
                      <button
                        key={t.tier}
                        onClick={() => assign(t.tier)}
                        disabled={busy}
                        className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-1.5 text-[11px] font-semibold text-amber-300 hover:bg-amber-400/20"
                      >
                        Use for {t.tier}
                      </button>
                    ))}
                </div>
              </>
            ) : (
              <>
                <p className="text-red-300 font-semibold">Didn&apos;t work</p>
                <p className="text-white/60 text-[12px] mt-1 whitespace-pre-wrap">{result.error}</p>
              </>
            )}
          </div>
        )}

        {note && <p className="text-[12px] text-emerald-300/80">{note}</p>}
      </div>
    </div>
  )
}
