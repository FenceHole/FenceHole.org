'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'

// Nessie, on every screen.
//
// She reads the route so she knows which room you're standing in — asking
// "what should I do here?" on the CRM means something different than asking it
// in the Studio. Same agent, same memory as /hq/nessie; only the framing
// changes. Available to anyone on the team, not just Chris.

interface Turn {
  role: 'you' | 'nessie'
  text: string
  actions?: { tool: string }[]
  remembered?: string | null
}

const ROOM: Record<string, string> = {
  '/hub': 'the Mission Control dashboard',
  '/hub/me': 'their personal desk',
  '/hub/chat': 'the team chat',
  '/hub/todo': "the shared daily to-do list",
  '/hub/crm': 'the CRM — contacts and deals',
  '/hub/brands': 'the brand portfolio',
  '/hub/content': 'the content pipeline',
  '/hub/studio': 'the livestream studio',
  '/hub/inbox': 'the email inbox',
  '/hub/calendar': 'the calendar',
  '/hq': 'the HQ command center',
  '/hq/approvals': 'the approvals queue',
  '/hq/deals': 'the deal desk',
  '/hq/models': "the model settings page",
}

function roomFor(path: string): string {
  if (ROOM[path]) return ROOM[path]
  const seg = Object.keys(ROOM)
    .filter((k) => k !== '/hub' && path.startsWith(k))
    .sort((a, b) => b.length - a.length)[0]
  return seg ? ROOM[seg] : 'the Hub'
}

export default function NessieDock() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [task, setTask] = useState('')
  const [turns, setTurns] = useState<Turn[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Her own page already is her; no need to float over it.
  const hidden = pathname?.startsWith('/hq/nessie')

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [turns, loading])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Cmd/Ctrl+K from anywhere in the Hub.
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((v) => !v)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (hidden) return null

  async function send(e: React.FormEvent) {
    e.preventDefault()
    const text = task.trim()
    if (!text || loading) return
    setTask('')
    setError(null)
    setTurns((prev) => [...prev, { role: 'you', text }])
    setLoading(true)
    try {
      const res = await fetch('/api/hq/nessie', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task: text, room: roomFor(pathname ?? '/hub') }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Request failed')
      setTurns((prev) => [...prev, {
        role: 'nessie',
        text: data.reply,
        actions: data.actions ?? [],
        remembered: data.remembered ?? null,
      }])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Ask Nessie"
          title="Ask Nessie (⌘K)"
          style={{
            position: 'fixed', right: 18, bottom: 18, zIndex: 60,
            width: 52, height: 52, borderRadius: '50%', cursor: 'pointer',
            border: '1px solid rgba(240,180,41,.35)',
            background: 'radial-gradient(circle at 50% 40%, #ffd97a, #f0b429 45%, #6b4d12 100%)',
            boxShadow: '0 0 20px 4px rgba(240,180,41,.35), 0 6px 20px rgba(0,0,0,.5)',
          }}
        />
      )}

      {open && (
        <div
          style={{
            position: 'fixed', right: 16, bottom: 16, zIndex: 60,
            width: 'min(380px, calc(100vw - 32px))',
            maxHeight: 'min(560px, calc(100vh - 32px))',
            display: 'flex', flexDirection: 'column',
            background: '#0c0c16',
            border: '1px solid rgba(240,180,41,.22)',
            borderRadius: 14,
            boxShadow: '0 20px 60px rgba(0,0,0,.6)',
            overflow: 'hidden',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
            <span style={{ width: 8, height: 8, borderRadius: 4, background: '#f0b429', boxShadow: '0 0 8px #f0b429' }} />
            <span className="font-display" style={{ fontSize: 12, letterSpacing: 3, color: '#ffd97a' }}>NESSIE</span>
            <span style={{ fontSize: 10, color: '#5a5a72', marginLeft: 'auto', fontFamily: 'monospace' }}>
              {roomFor(pathname ?? '/hub')}
            </span>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close"
              style={{ background: 'none', border: 'none', color: '#8888aa', cursor: 'pointer', fontSize: 15, lineHeight: 1, padding: '0 2px' }}
            >
              ✕
            </button>
          </div>

          <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 10, minHeight: 120 }}>
            {turns.length === 0 && !loading && (
              <p style={{ fontSize: 12, color: '#5a5a72', lineHeight: 1.6 }}>
                She can see this page and your real data. Ask her what to do next, to draft
                something, or to add it to the list.
              </p>
            )}
            {turns.map((t, i) =>
              t.role === 'you' ? (
                <div key={i} style={{ alignSelf: 'flex-end', maxWidth: '85%', background: 'rgba(255,255,255,.06)', borderRadius: 10, padding: '7px 10px' }}>
                  <p style={{ fontSize: 12.5, color: '#d8d8e2', whiteSpace: 'pre-wrap', lineHeight: 1.45 }}>{t.text}</p>
                </div>
              ) : (
                <div key={i} style={{ border: '1px solid rgba(240,180,41,.15)', background: 'rgba(255,255,255,.02)', borderRadius: 10, padding: 10 }}>
                  {t.actions && t.actions.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
                      {t.actions.map((a, j) => (
                        <span key={j} style={{ fontSize: 9, fontFamily: 'monospace', color: '#8888aa', border: '1px solid rgba(255,255,255,.1)', borderRadius: 3, padding: '1px 5px' }}>
                          {a.tool}
                        </span>
                      ))}
                    </div>
                  )}
                  <p style={{ fontSize: 12.5, color: '#e2e2ea', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{t.text}</p>
                  {t.remembered && (
                    <p style={{ fontSize: 10, color: 'rgba(74,211,160,.7)', marginTop: 6 }}>remembered: {t.remembered}</p>
                  )}
                </div>
              )
            )}
            {loading && <p style={{ fontSize: 12, color: '#8888aa' }}>Working…</p>}
            {error && <p style={{ fontSize: 12, color: '#ff6b6b' }}>{error}</p>}
          </div>

          <form onSubmit={send} style={{ display: 'flex', gap: 8, padding: 10, borderTop: '1px solid rgba(255,255,255,.06)' }}>
            <input
              className="input"
              value={task}
              onChange={(e) => setTask(e.target.value)}
              placeholder="Ask Nessie…"
              style={{ fontSize: 13, padding: '8px 10px' }}
            />
            <button className="btn-primary" type="submit" disabled={loading} style={{ padding: '8px 14px', fontSize: 13 }}>
              {loading ? '…' : '↑'}
            </button>
          </form>
        </div>
      )}
    </>
  )
}
