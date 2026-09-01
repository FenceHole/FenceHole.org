'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { speak, stopSpeaking, pickVoice, listVoices, setVoice } from '@/lib/voice'

const TIER_LABEL: Record<string, string> = {
  simple: 'Hermes · voice',
  standard: 'Qwen3 8B · worker',
  complex: 'DeepSeek · harness',
}

interface Turn {
  role: 'you' | 'nessie'
  text: string
  actions?: { tool: string }[]
  tier?: string
  model?: string
  remembered?: string | null
}

export default function NessiePage() {
  const [task, setTask] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [turns, setTurns] = useState<Turn[]>([])
  const lastReply = [...turns].reverse().find((t) => t.role === 'nessie')?.text ?? null

  const [listening, setListening] = useState(false)
  const [voiceSupported, setVoiceSupported] = useState(false)
  const [voiceOut, setVoiceOut] = useState(true)
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [voiceName, setVoiceName] = useState<string>('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<{ name: string; kind: 'text' | 'image'; text?: string; dataUrl?: string }[]>([])
  const recognitionRef = useRef<any>(null)

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    setVoiceSupported(!!SR && 'speechSynthesis' in window)

    // Chrome populates the voice list asynchronously, so the first read is
    // usually empty — hence the voiceschanged listener as well.
    const load = () => {
      const list = listVoices()
      setVoices(list)
      const best = pickVoice()
      if (best) setVoiceName(best.name)
    }
    load()
    if ('speechSynthesis' in window) {
      window.speechSynthesis.addEventListener('voiceschanged', load)
      return () => window.speechSynthesis.removeEventListener('voiceschanged', load)
    }
  }, [])

  useEffect(() => {
    if (!lastReply || !voiceOut) return
    speak(lastReply)
  }, [lastReply, voiceOut])

  // Keep the newest turn in view — the whole point is reading her latest
  // reply without hunting for it.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [turns, loading])

  const TEXT_EXT = /\.(md|markdown|txt|csv|json|ya?ml|ts|tsx|js|jsx|py|html|css|sql|log)$/i

  async function addFiles(list: FileList | null) {
    if (!list) return
    const next: typeof files = []
    for (const f of Array.from(list)) {
      const isImage = f.type.startsWith('image/')
      const isText = f.type.startsWith('text/') || TEXT_EXT.test(f.name) || f.type === 'application/json'
      if (isImage) {
        const dataUrl = await new Promise<string>((res) => {
          const r = new FileReader()
          r.onload = () => res(String(r.result))
          r.readAsDataURL(f)
        })
        next.push({ name: f.name, kind: 'image', dataUrl })
      } else if (isText) {
        next.push({ name: f.name, kind: 'text', text: await f.text() })
      } else {
        // PDFs and binaries would need parsing she doesn't have yet; say so
        // rather than attaching something she'll silently ignore.
        setError(`${f.name}: only images and text files (.md, .txt, .csv, .json, code) are supported right now.`)
      }
    }
    if (next.length) setFiles((prev) => [...prev, ...next])
  }

  async function runAsk(text: string) {
    if (!text.trim() && files.length === 0) return
    setLoading(true)
    setError(null)
    setTurns((prev) => [...prev, {
      role: 'you',
      text: files.length ? `${text}\n\n📎 ${files.map((f) => f.name).join(', ')}` : text,
    }])
    setTask('')
    setFiles([])
    try {
      const res = await fetch('/api/hq/nessie', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task: text, attachments: files }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Request failed')
      setTurns((prev) => [...prev, {
        role: 'nessie',
        text: data.reply,
        actions: data.actions ?? [],
        tier: data.tier,
        model: data.model,
        remembered: data.remembered ?? null,
      }])
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
    stopSpeaking()

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

          <input
            ref={fileRef}
            type="file"
            multiple
            accept="image/*,text/*,.md,.markdown,.txt,.csv,.json,.yaml,.yml,.ts,.tsx,.js,.jsx,.py,.html,.css,.sql,.log"
            className="hidden"
            onChange={(e) => { addFiles(e.target.files); e.target.value = '' }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold text-white/50 hover:text-white/80 hover:border-amber-400/30"
            title="Attach images or files"
          >
            📎 Attach
          </button>
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
          {voiceSupported && voices.length > 0 && (
            <select
              value={voiceName}
              onChange={(e) => {
                const v = voices.find((x) => x.name === e.target.value) ?? null
                setVoice(v)
                setVoiceName(e.target.value)
                if (v) speak('Okay — this is how I sound now.')
              }}
              className="rounded-lg border border-white/10 bg-[#111120] px-2 py-2 text-xs text-white/60 hover:border-amber-400/30"
              title="Her speaking voice — the browser default is the robotic one"
            >
              {voices.map((v) => (
                <option key={v.name} value={v.name}>{v.name}</option>
              ))}
            </select>
          )}
        </div>
        {files.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {files.map((f, i) => (
              <span key={i} className="flex items-center gap-2 rounded-lg border border-amber-400/25 bg-amber-400/[0.06] px-2.5 py-1 text-[11px] text-amber-200/90">
                {f.kind === 'image' ? '🖼' : '📄'} {f.name}
                <button
                  type="button"
                  onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                  className="text-white/40 hover:text-white/80"
                  aria-label={`Remove ${f.name}`}
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}
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
          <div ref={bottomRef} />
        </div>
      )}

      {turns.length > 0 && (
        <div className="flex flex-col gap-4">
          {turns.map((t, i) =>
            t.role === 'you' ? (
              <div key={i} className="self-end max-w-[85%] rounded-xl border border-sky-400/25 bg-sky-400/[0.07] px-4 py-2.5">
                <p className="text-[10px] tracking-widest text-sky-300/70 mb-1">YOU</p>
                <p className="text-sm text-white/85 whitespace-pre-wrap leading-relaxed">{t.text}</p>
              </div>
            ) : (
              <div key={i} className="self-start max-w-[92%] rounded-xl border-l-2 border-l-amber-400/60 border border-amber-400/20 bg-amber-400/[0.04] p-4 flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                  <span className="font-display text-amber-300/80 tracking-widest text-[10px]">NESSIE</span>
                  {t.tier && (
                    <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 font-semibold text-amber-300">
                      {TIER_LABEL[t.tier] ?? t.tier}
                    </span>
                  )}
                  {t.model && <span className="text-white/40">{t.model}</span>}
                </div>
                {t.actions && t.actions.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                    <span className="text-white/30 tracking-widest">DID</span>
                    {t.actions.map((a, j) => (
                      <span key={j} className="rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-mono text-white/55">
                        {a.tool}
                      </span>
                    ))}
                  </div>
                )}
                <p className="text-sm text-white/80 whitespace-pre-wrap leading-relaxed">{t.text}</p>
                {t.remembered && (
                  <p className="text-[10px] text-emerald-300/60 border-t border-white/5 pt-2">
                    remembered: {t.remembered}
                  </p>
                )}
              </div>
            )
          )}
        </div>
      )}
    </div>
  )
}
