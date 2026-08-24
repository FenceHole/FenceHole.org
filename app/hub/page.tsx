import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { BRANDS } from '@/lib/constants'
import Link from 'next/link'

// Mission Control — the real dashboard, not the mockup. Every station below
// reads its own live count; nothing here is decorative. See nessie/HARNESS.md
// for what's actually wired vs. still coming.

export const dynamic = 'force-dynamic'

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export default async function DashboardPage() {
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()

  const [
    { data: profile },
    { data: deals },
    { data: todos },
    { data: messages },
    { data: drafts },
    { data: content },
    { data: dealOffers },
  ] = await Promise.all([
    sb.from('profiles').select('full_name').eq('id', user!.id).single(),
    sb.from('deals').select('id').in('status', ['new', 'in_talks', 'negotiating']),
    sb.from('daily_todos').select('id,done').eq('due_date', todayISO()),
    sb.from('team_messages').select('id,author_name,body,created_at').order('created_at', { ascending: false }).limit(3),
    sb.from('agent_drafts').select('id').eq('status', 'pending'),
    sb.from('content_ideas').select('id').eq('status', 'idea'),
    sb.from('deal_offers').select('id,brand_name,status,priority').in('status', ['new', 'assessed']).order('created_at', { ascending: false }).limit(4),
  ])

  // Team headcount for the chat station — reads with the service client since
  // the count of profiles isn't otherwise exposed to a logged-in team member.
  let teamCount = 2
  try {
    const admin = createAdminClient()
    const { count } = await admin.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'team')
    if (count) teamCount = count
  } catch { /* falls back to 2 if the service key isn't available here */ }

  const name = profile?.full_name?.split(' ')[0] ?? 'Team'
  const openTodos = (todos ?? []).filter((t) => !t.done).length
  const totalTodos = (todos ?? []).length
  const dealCount = deals?.length ?? 0
  const draftCount = drafts?.length ?? 0
  const ideaCount = content?.length ?? 0
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Evening'

  const stations = [
    {
      href: '/hub/chat',
      name: 'Team Channel',
      status: 'LIVE',
      detail: `${teamCount} operators aboard`,
      sub: messages?.[0] ? `${messages[0].author_name}: "${messages[0].body.slice(0, 60)}${messages[0].body.length > 60 ? '…' : ''}"` : 'No messages yet — say something.',
    },
    {
      href: '/hub/todo',
      name: 'Daily Ops',
      status: openTodos > 0 ? `${openTodos} OPEN` : 'CLEAR',
      detail: `${totalTodos} on today's list`,
      sub: openTodos > 0 ? "Today's directives, not yet closed." : 'Nothing outstanding today.',
    },
    {
      href: '/hub/crm',
      name: 'Relations · CRM',
      status: `${dealCount} ACTIVE`,
      detail: 'deals in motion',
      sub: 'Every deal and collaborator on the board.',
    },
    {
      href: '/hub/brands',
      name: 'Brand Fleet',
      status: `${BRANDS.length} PROPERTIES`,
      detail: 'the portfolio',
      sub: 'Frances & Family, Cool Cat Stuff, and the rest.',
    },
    {
      href: '/hub/content',
      name: 'Signal · Content',
      status: ideaCount > 0 ? `${ideaCount} IN PIPELINE` : 'CLEAR',
      detail: 'story ideas',
      sub: 'Idea → drafting → published.',
    },
  ]

  const rightStations = [
    {
      href: '/hub/inbox',
      name: 'Comms Array · Email',
      status: 'STANDBY',
      sub: 'Connect Google to bring this online.',
    },
    {
      href: '/hub/calendar',
      name: 'Chronometer',
      status: 'STANDBY',
      sub: 'Same uplink as email.',
    },
    {
      href: '/hq/approvals',
      name: 'Approvals Gate',
      status: draftCount > 0 ? `${draftCount} PENDING` : 'CLEAR',
      sub: draftCount > 0 ? 'Nessie is waiting on you.' : 'Nothing waiting on you.',
    },
    {
      href: '/hub/crm',
      name: 'Deal Radar',
      status: dealOffers && dealOffers.length > 0 ? `${dealOffers.length} NEW` : 'QUIET',
      sub: dealOffers?.[0] ? `Latest: ${dealOffers[0].brand_name}` : 'Nothing new to assess.',
    },
    {
      href: '/hub/me',
      name: 'Your Desk',
      status: 'OPEN',
      sub: 'What only you need to see.',
    },
  ]

  return (
    <div className="hq-bg" style={{ minHeight: '100vh', padding: '28px 20px 60px' }}>
      <header style={{ maxWidth: 1180, margin: '0 auto 28px' }}>
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 3, color: '#f0b429', marginBottom: 6 }}>
          FENCE HOLE · MISSION CONTROL
        </p>
        <h1 className="font-display" style={{ fontSize: 32, fontWeight: 600, color: '#f0f0f4' }}>
          {greeting}, {name}.
        </h1>
        <div className="gold-divider" style={{ width: 80, marginTop: 14 }} />
      </header>

      <div
        style={{
          maxWidth: 1180,
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'minmax(0,1fr) minmax(260px,340px) minmax(0,1fr)',
          gap: 20,
          alignItems: 'start',
        }}
        className="mc-grid"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {stations.map((s) => <Station key={s.href} {...s} />)}
        </div>

        <Link href="/hq/nessie" style={{ textDecoration: 'none' }}>
          <div
            className="emblem-ring"
            style={{
              background: 'radial-gradient(circle at 50% 40%, #1a1610, #0a0a0f 70%)',
              border: '1px solid rgba(240,180,41,.2)',
              borderRadius: 16,
              padding: '36px 20px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
              cursor: 'pointer',
              transition: 'transform .2s',
            }}
          >
            <div
              style={{
                width: 64, height: 64, borderRadius: '50%',
                background: 'radial-gradient(circle at 50% 40%, #ffd97a, #f0b429 45%, #6b4d12 100%)',
                boxShadow: '0 0 26px 6px rgba(240,180,41,.45), 0 0 60px 12px rgba(240,180,41,.2)',
              }}
            />
            <p className="font-display" style={{ fontSize: 26, letterSpacing: 8, color: '#ffd97a', fontWeight: 600 }}>
              NESSIE
            </p>
            <p style={{ fontSize: 10, letterSpacing: 2, color: '#4ad3a0', fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: 3, background: '#4ad3a0', boxShadow: '0 0 8px #4ad3a0' }} />
              CORE ONLINE
            </p>
            <p style={{ fontSize: 11, color: '#8888aa', textAlign: 'center', lineHeight: 1.6, maxWidth: 220 }}>
              Chief intelligence · reads your real data, calls her own tools, tells you what she&apos;d do
            </p>
          </div>
        </Link>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {rightStations.map((s) => <Station key={s.href} {...s} />)}
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .mc-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}

function Station({ href, name, status, detail, sub }: { href: string; name: string; status: string; detail?: string; sub: string }) {
  const live = status.includes('LIVE') || status.includes('CLEAR') || status.includes('OPEN')
  const alert = status.includes('OPEN') && !status.includes('CLEAR') && /^\d/.test(status)
  const color = alert ? '#f0b429' : live ? '#4ad3a0' : status === 'STANDBY' ? '#8888aa' : '#f0b429'

  return (
    <Link href={href} style={{ textDecoration: 'none' }}>
      <div
        className="card"
        style={{
          padding: '14px 16px',
          borderLeft: `2px solid ${color}66`,
          transition: 'border-color .2s, transform .2s',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <span style={{ fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', fontFamily: 'monospace', color: '#f0f0f4' }}>
            {name}
          </span>
          <span
            style={{
              fontSize: 9.5, letterSpacing: 1, textTransform: 'uppercase', fontFamily: 'monospace',
              padding: '2px 7px', borderRadius: 3, color, border: `1px solid ${color}4d`, background: `${color}14`,
              whiteSpace: 'nowrap',
            }}
          >
            {status}
          </span>
        </div>
        {detail && <p style={{ fontSize: 10, color: '#5a5a72', marginTop: 4, fontFamily: 'monospace' }}>{detail}</p>}
        <p style={{ fontSize: 12, color: '#8888aa', marginTop: 6, lineHeight: 1.4 }}>{sub}</p>
      </div>
    </Link>
  )
}
