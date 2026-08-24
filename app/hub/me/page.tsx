import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

// My Desk — the one section of the Hub that belongs to a single person.
// Chris and Marjorie each see only their own, scoped by auth.uid(). It reads
// existing tables rather than adding new ones, so there's nothing to migrate.

export const dynamic = 'force-dynamic'

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function Card({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section style={{ background: '#101019', border: '1px solid #22223a', borderRadius: 12, padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
        <h2 style={{ fontSize: 13, letterSpacing: 1.5, textTransform: 'uppercase', color: '#8888aa', fontWeight: 600 }}>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 13, color: '#5a5a72' }}>{children}</p>
}

export default async function MyDeskPage() {
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await sb.from('profiles').select('full_name,email').eq('id', user.id).single()
  const fullName = profile?.full_name ?? profile?.email ?? 'Team'
  const first = fullName.split(' ')[0]

  const [{ data: myTodos }, { data: messages }, { data: drafts }] = await Promise.all([
    sb.from('daily_todos').select('id,title,done,due_date')
      .eq('created_by', user.id).eq('due_date', todayISO()).order('created_at'),
    sb.from('team_messages').select('id,author_name,body,created_at')
      .order('created_at', { ascending: false }).limit(60),
    sb.from('agent_drafts').select('id,title,kind,status')
      .eq('status', 'pending').order('created_at', { ascending: false }).limit(6),
  ])

  // Anything addressed to this person by first name, from someone else.
  const needle = first.toLowerCase()
  const mentions = (messages ?? [])
    .filter((m) => m.body?.toLowerCase().includes(needle) && m.author_name !== fullName)
    .slice(0, 5)

  const todos = myTodos ?? []
  const openTodos = todos.filter((t) => !t.done)
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Evening'

  return (
    <div style={{ padding: '28px 20px', maxWidth: 1100, margin: '0 auto' }}>
      <header style={{ marginBottom: 24 }}>
        <h1 className="font-display" style={{ fontSize: 30, color: '#f0f0f4', marginBottom: 4 }}>
          {greeting}, {first}.
        </h1>
        <div className="gold-divider" style={{ margin: '10px 0 12px', maxWidth: 180 }} />
        <p style={{ fontSize: 13, color: '#8888aa' }}>
          Your desk — only you see this. {openTodos.length > 0
            ? `${openTodos.length} thing${openTodos.length === 1 ? '' : 's'} still open today.`
            : 'Nothing open today.'}
        </p>
      </header>

      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))' }}>
        <Card
          title="My list today"
          action={<Link href="/hub/todo" style={{ fontSize: 12, color: '#f0b429', textDecoration: 'none' }}>Open →</Link>}
        >
          {todos.length === 0 ? (
            <Empty>Nothing on your list yet. Add one in Daily To-Do and it shows up here.</Empty>
          ) : (
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {todos.map((t) => (
                <li key={t.id} style={{ display: 'flex', gap: 9, alignItems: 'flex-start', fontSize: 14 }}>
                  <span style={{ color: t.done ? '#4ad3a0' : '#55556e', lineHeight: '20px' }}>{t.done ? '✓' : '○'}</span>
                  <span style={{ color: t.done ? '#5a5a72' : '#e8e8ee', textDecoration: t.done ? 'line-through' : 'none' }}>
                    {t.title}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          title="Where you were mentioned"
          action={<Link href="/hub/chat" style={{ fontSize: 12, color: '#f0b429', textDecoration: 'none' }}>Chat →</Link>}
        >
          {mentions.length === 0 ? (
            <Empty>No one has asked for you in Team Chat recently.</Empty>
          ) : (
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {mentions.map((m) => (
                <li key={m.id}>
                  <p style={{ fontSize: 11, color: '#8888aa', marginBottom: 2 }}>{m.author_name}</p>
                  <p style={{ fontSize: 13, color: '#d8d8e2', lineHeight: 1.45 }}>
                    {m.body.length > 160 ? `${m.body.slice(0, 160)}…` : m.body}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          title="Waiting on a decision"
          action={<Link href="/hq/approvals" style={{ fontSize: 12, color: '#f0b429', textDecoration: 'none' }}>Approvals →</Link>}
        >
          {(drafts ?? []).length === 0 ? (
            <Empty>Nothing queued. Nessie has nothing waiting on you.</Empty>
          ) : (
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 9 }}>
              {(drafts ?? []).map((d) => (
                <li key={d.id} style={{ display: 'flex', gap: 9, alignItems: 'baseline', fontSize: 14 }}>
                  <span style={{ fontSize: 10, color: '#f0b429', letterSpacing: 1, textTransform: 'uppercase' }}>{d.kind}</span>
                  <span style={{ color: '#e8e8ee' }}>{d.title}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Ask Nessie" action={<Link href="/hq/nessie" style={{ fontSize: 12, color: '#f0b429', textDecoration: 'none' }}>Open →</Link>}>
          <p style={{ fontSize: 13, color: '#8888aa', lineHeight: 1.55 }}>
            She knows your deals, your drafts, and what you told her last time.
            Ask her what to do next and she will tell you — not give you options.
          </p>
        </Card>
      </div>
    </div>
  )
}
