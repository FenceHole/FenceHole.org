'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

const TIER_LABEL: Record<string, string> = {
  simple: 'Qwen 2.5 7B (cheap)',
  standard: 'Qwen 2.5 72B',
  complex: 'GLM 5.2',
}

export default function NessiePage() {
  const [task, setTask] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reply, setReply] = useState<string | null>(null)
  const [tier, setTier] = useState<string | null>(null)
  const [model, setModel] = useState<string | null>(null)
  const [usage, setUsage] = useState<{ prompt_tokens: number; completion_tokens: number; total_tokens: number } | null>(null)

  const [listening, setListening] = useState(false)
  const [voiceSupported, setVoiceSupported] = useState(false)
  const [voiceOut, setVoiceOut] = useState(true)
  const recognitionRef = useRef<any>(null)

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    setVoiceSupported(!!SR && 'speechSynthesis' in window)
  }, [])

  useEffect(() => {
    if (!reply || !voiceOut || !('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(reply))
  }, [reply, voiceOut])

  async function runAsk(text: string) {
    if (!text.trim()) return
    setLoading(true)
    setError(null)
    setReply(null)
    try {
      const res = await fetch('/api/hq/nessie', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task: text }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Request failed')
      setReply(data.reply)
      setTier(data.tier)
      setModel(data.model)
      setUsage(data.usage ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  function ask(e: React.FormEvent) {
    e.preventDefault()
    runAsk(task)
  }

  function toggleListening() {
    if (listening) {
      recognitionRef.current?.stop()
      return
    }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) return
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()

    const recognition = new SR()
    recognition.lang = 'en-US'
    recognition.interimResults = true
    recognition.maxAlternatives = 1
    recognition.onresult = (e: any) => {
      let transcript = ''
      for (let i = 0; i < e.results.length; i++) transcript += e.results[i][0].transcript
      setTask(transcript)
      if (e.results[e.results.length - 1].isFinal) {
        recognition.stop()
        runAsk(transcript)
      }
    }
    recognition.onend = () => setListening(false)
    recognition.onerror = () => setListening(false)
    recognitionRef.current = recognition
    setTask('')
    recognition.start()
    setListening(true)
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 flex flex-col gap-8">
      <div>
        <Link href="/hq" className="text-xs text-amber-400/70 hover:text-amber-300">
          ← Back to Command Center
        </Link>
      </div>

      <div className="flex flex-col items-center text-center gap-4">
        <div className="emblem-ring w-24 h-24 sm:w-28 sm:h-28 overflow-hidden bg-black/40">
          <img src="/nessie-emblem.jpg" alt="Nessie" className="w-full h-full object-cover" />
        </div>
        <h1 className="font-display text-3xl sm:text-4xl font-semibold text-amber-200">NESSIE</h1>
        <div className="gold-divider w-20" />
      </div>

      <form onSubmit={ask} className="flex flex-col gap-3">
        <textarea
          value={task}
          onChange={(e) => setTask(e.target.value)}
          placeholder="e.g. Here's a brand deal offer I got today — tell me if it's worth it and draft my reply…"
          rows={5}
          className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-amber-400/40"
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={loading || !task.trim()}
            className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-4 py-2 text-xs font-semibold text-amber-300 hover:bg-amber-400/20 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? 'Thinking…' : 'Ask Nessie'}
          </button>

          {voiceSupported && (
            <button
              type="button"
              onClick={toggleListening}
              disabled={loading}
              className={`rounded-lg border px-4 py-2 text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed ${
                listening
                  ? 'border-red-400/40 bg-red-400/10 text-red-300 animate-pulse'
                  : 'border-white/10 bg-white/[0.03] text-white/70 hover:border-amber-400/30 hover:text-amber-300'
              }`}
            >
              {listening ? '● Listening… (tap to stop)' : '🎤 Speak to Nessie'}
            </button>
          )}

          {voiceSupported && (
            <button
              type="button"
              onClick={() => setVoiceOut((v) => !v)}
              className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold text-white/50 hover:text-white/80 hover:border-amber-400/30"
              title="Toggle Nessie speaking her replies aloud"
            >
              {voiceOut ? '🔊 Voice replies on' : '🔇 Voice replies off'}
            </button>
          )}
        </div>
        {!voiceSupported && (
          <p className="text-[11px] text-white/30">
            Voice conversation isn't supported in this browser — try Chrome or Safari.
          </p>
        )}
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

      {reply && (
        <div className="rounded-xl border border-amber-400/15 bg-white/[0.03] p-4 flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="font-display text-amber-300/80 tracking-widest text-[10px]">NESSIE</span>
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
          <p className="text-sm text-white/80 whitespace-pre-wrap leading-relaxed">{reply}</p>
        </div>
      )}
    </div>
  )
}
