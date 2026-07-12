'use client'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Msg {
  id: string
  author_name: string
  role: string
  body: string
  created_at: string
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Msg[]>([])
  const [text, setText] = useState('')
  const [me, setMe] = useState('Team')
  const [sending, setSending] = useState(false)
  const [nessieThinking, setNessieThinking] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const sb = createClient()

  useEffect(() => {
    let active = true
    ;(async () => {
      const { data: { user } } = await sb.auth.getUser()
      if (user) {
        const { data: p } = await sb.from('profiles').select('full_name').eq('id', user.id).single()
        if (active && p?.full_name) setMe(p.full_name.split(' ')[0])
      }
      const { data } = await sb.from('team_messages').select('*').order('created_at').limit(200)
      if (active && data) setMessages(data as Msg[])
    })()

    const channel = sb
      .channel('team_messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'team_messages' }, (payload) => {
        setMessages((prev) => (prev.some((m) => m.id === (payload.new as Msg).id) ? prev : [...prev, payload.new as Msg]))
      })
      .subscribe()

    return () => {
      active = false
      sb.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, nessieThinking])

  async function send(e: React.FormEvent) {
    e.preventDefault()
    const body = text.trim()
    if (!body || sending) return
    setSending(true)
    setText('')

    const callsNessie = /@nessie/i.test(body)
    await sb.from('team_messages').insert({ author_name: me, role: 'user', body })

    if (callsNessie) {
      setNessieThinking(true)
      try {
        await fetch('/api/hub/chat/nessie', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: body.replace(/@nessie/gi, '').trim(), from: me }),
        })
      } catch {
        /* the reply (or an error note) is inserted server-side and arrives via realtime */
      } finally {
        setNessieThinking(false)
      }
    }
    setSending(false)
  }

  return (
    <div className="page-pad" style={{ maxWidth: 780, height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flexShrink: 0 }}>
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 3, color: '#f0b429', marginBottom: 4 }}>FENCE HOLE HUB</p>
        <h1 className="font-display" style={{ fontSize: 30, fontWeight: 600, color: '#f0f0f4' }}>Team Chat</h1>
        <div className="gold-divider" style={{ width: 60, margin: '12px 0 8px' }} />
        <p style={{ fontSize: 12, color: '#44445a', marginBottom: 16 }}>
          You, Marjorie &amp; Nessie. Type <span style={{ color: '#f0b429' }}>@nessie</span> to pull her in.
        </p>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, paddingRight: 4 }}>
        {messages.length === 0 && (
          <p style={{ fontSize: 13, color: '#44445a', textAlign: 'center', marginTop: 40 }}>No messages yet — say hi 👋</p>
        )}
        {messages.map((m) => {
          const isNessie = m.role === 'nessie'
          return (
            <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isNessie ? 'flex-start' : 'flex-end' }}>
              <div style={{ maxWidth: '78%', borderRadius: 12, padding: '9px 13px',
                background: isNessie ? 'rgba(240,180,41,0.08)' : '#16162a',
                border: isNessie ? '1px solid rgba(240,180,41,0.2)' : '1px solid rgba(255,255,255,0.06)' }}>
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, marginBottom: 3,
                  color: isNessie ? '#f0b429' : '#8888aa' }}>{isNessie ? 'NESSIE' : m.author_name.toUpperCase()}</p>
                <p style={{ fontSize: 13.5, color: '#f0f0f4', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{m.body}</p>
              </div>
              <span style={{ fontSize: 10, color: '#44445a', margin: '3px 4px 0' }}>{time(m.created_at)}</span>
            </div>
          )
        })}
        {nessieThinking && (
          <div style={{ alignSelf: 'flex-start', fontSize: 12, color: '#f0b429', fontStyle: 'italic', padding: '4px 4px' }}>
            Nessie is thinking…
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form onSubmit={send} style={{ flexShrink: 0, display: 'flex', gap: 8, paddingTop: 12 }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Message the team… (@nessie to ask her)"
          style={{ flex: 1, borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)',
            padding: '11px 14px', fontSize: 14, color: '#fff', outline: 'none' }}
        />
        <button type="submit" disabled={sending || !text.trim()} className="btn-primary" style={{ opacity: sending || !text.trim() ? 0.4 : 1 }}>
          Send
        </button>
      </form>
    </div>
  )
}

function time(raw: string): string {
  const d = new Date(raw)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}
