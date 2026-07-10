import { createClient } from '@/lib/supabase/server'
import { googleConfigured, getValidAccessToken, listUpcomingEvents } from '@/lib/integrations/google'

export const dynamic = 'force-dynamic'

export default async function CalendarPage() {
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()

  const configured = googleConfigured()
  const auth = configured && user ? await getValidAccessToken(user.id) : null
  const connected = !!auth

  let events: Awaited<ReturnType<typeof listUpcomingEvents>> = []
  let loadError: string | null = null
  if (connected && user) {
    try {
      events = await listUpcomingEvents(user.id, 15)
    } catch (e) {
      loadError = e instanceof Error ? e.message : 'Failed to load calendar'
    }
  }

  return (
    <div className="page-pad" style={{ maxWidth: 820 }}>
      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 3, color: '#f0b429', marginBottom: 4 }}>FENCE HOLE HUB</p>
      <h1 className="font-display" style={{ fontSize: 32, fontWeight: 600, color: '#f0f0f4', marginBottom: 12 }}>Calendar</h1>
      <div className="gold-divider" style={{ width: 64, marginBottom: 24 }} />

      {!configured && (
        <div className="card" style={{ padding: 24 }}>
          <p style={{ fontSize: 15, fontWeight: 600, color: '#f0f0f4', marginBottom: 8 }}>Calendar isn&apos;t set up yet</p>
          <p style={{ fontSize: 13, color: '#8888aa', lineHeight: 1.6 }}>
            A Google OAuth client needs to be added first (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET).
          </p>
        </div>
      )}

      {configured && !connected && (
        <div className="card" style={{ padding: 24 }}>
          <p style={{ fontSize: 15, fontWeight: 600, color: '#f0f0f4', marginBottom: 8 }}>Connect your Google account</p>
          <p style={{ fontSize: 13, color: '#8888aa', lineHeight: 1.6, marginBottom: 16 }}>
            Bring your Google Calendar into the Hub so you and Nessie can see what&apos;s coming up.
          </p>
          <a href="/api/google/connect" className="btn-primary" style={{ display: 'inline-block', textDecoration: 'none' }}>
            Connect Google
          </a>
        </div>
      )}

      {connected && (
        <>
          <p style={{ fontSize: 12, color: '#8888aa', marginBottom: 16 }}>Upcoming for <span style={{ color: '#f0f0f4' }}>{auth?.email}</span></p>

          {loadError && (
            <div className="card" style={{ padding: 16, borderColor: 'rgba(255,120,120,0.3)' }}>
              <p style={{ fontSize: 13, color: '#ff9b9b' }}>Couldn&apos;t load calendar: {loadError}</p>
            </div>
          )}

          {!loadError && events.length === 0 && (
            <div className="card" style={{ padding: 24 }}>
              <p style={{ fontSize: 13, color: '#8888aa' }}>Nothing on the calendar coming up.</p>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {events.map((e) => (
              <a key={e.id} href={e.htmlLink} target="_blank" rel="noopener noreferrer" className="card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 14, textDecoration: 'none' }}>
                <div style={{ flexShrink: 0, width: 54, textAlign: 'center' }}>
                  <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: '#f0b429' }}>{formatWhen(e.start, e.allDay).top}</p>
                  <p style={{ fontSize: 18, fontWeight: 700, color: '#f0f0f4' }}>{formatWhen(e.start, e.allDay).day}</p>
                </div>
                <div style={{ borderLeft: '1px solid rgba(255,255,255,0.08)', paddingLeft: 14, flex: 1 }}>
                  <p style={{ fontSize: 14, fontWeight: 500, color: '#f0f0f4' }}>{e.summary}</p>
                  <p style={{ fontSize: 12, color: '#8888aa' }}>
                    {e.allDay ? 'All day' : formatTime(e.start)}
                    {e.location ? ` · ${e.location}` : ''}
                  </p>
                </div>
              </a>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function formatWhen(raw: string, allDay: boolean): { top: string; day: string } {
  const d = new Date(raw)
  if (isNaN(d.getTime())) return { top: '', day: '' }
  return {
    top: d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
    day: String(d.getDate()),
  }
}

function formatTime(raw: string): string {
  const d = new Date(raw)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}
