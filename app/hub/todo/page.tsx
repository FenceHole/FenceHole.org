'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Todo {
  id: string
  title: string
  done: boolean
  due_date: string
  created_by_name: string | null
  source: string
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function TodoPage() {
  const [todos, setTodos] = useState<Todo[]>([])
  const [title, setTitle] = useState('')
  const [me, setMe] = useState('Team')
  const [loading, setLoading] = useState(true)
  const sb = createClient()

  useEffect(() => {
    let active = true
    ;(async () => {
      const { data: { user } } = await sb.auth.getUser()
      if (user) {
        const { data: p } = await sb.from('profiles').select('full_name').eq('id', user.id).single()
        if (active && p?.full_name) setMe(p.full_name.split(' ')[0])
      }
      const { data } = await sb.from('daily_todos').select('*').eq('due_date', todayISO()).order('created_at')
      if (active) { setTodos((data as Todo[]) ?? []); setLoading(false) }
    })()
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function add(e: React.FormEvent) {
    e.preventDefault()
    const t = title.trim()
    if (!t) return
    setTitle('')
    const { data: { user } } = await sb.auth.getUser()
    const { data } = await sb.from('daily_todos')
      .insert({ title: t, due_date: todayISO(), created_by: user?.id ?? null, created_by_name: me, source: 'hub' })
      .select('*').single()
    if (data) setTodos((p) => [...p, data as Todo])
  }

  async function toggle(id: string, done: boolean) {
    setTodos((p) => p.map((t) => (t.id === id ? { ...t, done: !done } : t)))
    await sb.from('daily_todos').update({ done: !done }).eq('id', id)
  }

  async function remove(id: string) {
    setTodos((p) => p.filter((t) => t.id !== id))
    await sb.from('daily_todos').delete().eq('id', id)
  }

  const openCount = todos.filter((t) => !t.done).length
  const dateLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <div className="page-pad" style={{ maxWidth: 640 }}>
      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 3, color: '#f0b429', marginBottom: 4 }}>FENCE HOLE HUB</p>
      <h1 className="font-display" style={{ fontSize: 30, fontWeight: 600, color: '#f0f0f4' }}>Daily To-Do</h1>
      <div className="gold-divider" style={{ width: 60, margin: '12px 0 6px' }} />
      <p style={{ fontSize: 12.5, color: '#8888aa', marginBottom: 20 }}>
        {dateLabel} · <span style={{ color: openCount ? '#f0d488' : '#34d399' }}>{openCount ? `${openCount} open` : 'all clear'}</span>
      </p>

      <form onSubmit={add} style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add something to today…"
          style={{ flex: 1, borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)',
            padding: '11px 14px', fontSize: 14, color: '#fff', outline: 'none' }}
        />
        <button type="submit" disabled={!title.trim()} className="btn-primary" style={{ opacity: title.trim() ? 1 : 0.4 }}>Add</button>
      </form>

      {loading ? (
        <p style={{ fontSize: 13, color: '#44445a' }}>Loading…</p>
      ) : todos.length === 0 ? (
        <div className="card" style={{ padding: 24, textAlign: 'center' }}>
          <p style={{ fontSize: 13, color: '#8888aa' }}>Nothing for today yet. Add the first thing above.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {todos.map((t) => (
            <div key={t.id} className="card" style={{ padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <button onClick={() => toggle(t.id, t.done)} aria-label="Toggle done"
                style={{ width: 20, height: 20, borderRadius: 6, flexShrink: 0, cursor: 'pointer',
                  border: t.done ? 'none' : '1.5px solid #44445a',
                  background: t.done ? '#34d399' : 'transparent', color: '#08080f', fontSize: 13, lineHeight: 1 }}>
                {t.done ? '✓' : ''}
              </button>
              <span style={{ flex: 1, fontSize: 14, color: t.done ? '#44445a' : '#f0f0f4',
                textDecoration: t.done ? 'line-through' : 'none' }}>{t.title}</span>
              {t.source === 'nessie' && (
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, color: '#f0b429',
                  border: '1px solid rgba(240,180,41,0.3)', borderRadius: 100, padding: '2px 7px' }}>NESSIE</span>
              )}
              {t.created_by_name && t.source !== 'nessie' && (
                <span style={{ fontSize: 10, color: '#44445a' }}>{t.created_by_name}</span>
              )}
              <button onClick={() => remove(t.id)} aria-label="Delete"
                style={{ background: 'none', border: 'none', color: '#44445a', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
