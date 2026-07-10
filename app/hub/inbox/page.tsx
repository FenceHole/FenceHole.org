import { createClient } from '@/lib/supabase/server'
import { googleConfigured, getValidAccessToken, listRecentEmail } from '@/lib/integrations/google'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

const STATUS_NOTE: Record<string, string> = {
  connected: 'Google connected. Your inbox is below.',
  disconnected: 'Google disconnected.',
  auth_mismatch: "That sign-in didn't match your session — try connecting again.",
  exchange_failed: "Couldn't finish connecting to Google. Try again.",
  missing_code: 'Google sent back an incomplete response. Try again.',
}

export default async function InboxPage({ searchParams }: { searchParams: Promise<{ google?: string }> }) {
  const sp = await searchParams
  const note = sp.google ? STATUS_NOTE[sp.google] ?? `Google: ${sp.google}` : null

  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()

  const configured = googleConfigured()
  const auth = configured && user ? await getValidAccessToken(user.id) : null
  const connected = !!auth

  let emails: Awaited<ReturnType<typeof listRecentEmail>> = []
  let loadError: string | null = null
  if (connected && user) {
    try {
      emails = await listRecentEmail(user.id, 20)
    } catch (e) {
      loadError = e instanceof Error ? e.message : 'Failed to load email'
    }
  }

  return (
    <div className="page-pad" style={{ maxWidth: 820 }}>
      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 3, color: '#f0b429', marginBottom: 4 }}>FENCE HOLE HUB</p>
      <h1 className="font-display" style={{ fontSize: 32, fontWeight: 600, color: '#f0f0f4', marginBottom: 12 }}>Inbox</h1>
      <div className="gold-divider" style={{ width: 64, marginBottom: 24 }} />

      {note && (
        <div style={{ marginBottom: 20, padding: '10px 14px', borderRadius: 10, background: 'rgba(240,180,41,0.08)', border: '1px solid rgba(240,180,41,0.2)', fontSize: 13, color: '#f0d488' }}>
          {note}
        </div>
      )}

      {!configured && (
        <div className="card" style={{ padding: 24 }}>
          <p style={{ fontSize: 15, fontWeight: 600, color: '#f0f0f4', marginBottom: 8 }}>Email isn&apos;t set up yet</p>
          <p style={{ fontSize: 13, color: '#8888aa', lineHeight: 1.6 }}>
            A Google OAuth client needs to be added (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET).
            Once that&apos;s in place, you&apos;ll be able to connect your Gmail here.
          </p>
        </div>
      )}

      {configured && !connected && (
        <div className="card" style={{ padding: 24 }}>
          <p style={{ fontSize: 15, fontWeight: 600, color: '#f0f0f4', marginBottom: 8 }}>Connect your Google account</p>
          <p style={{ fontSize: 13, color: '#8888aa', lineHeight: 1.6, marginBottom: 16 }}>
            See your email and calendar right here in the Hub, and let Nessie draft replies for you.
            Your inbox stays private — nothing sends without your approval.
          </p>
          <a href="/api/google/connect" className="btn-primary" style={{ display: 'inline-block', textDecoration: 'none' }}>
            Connect Google
          </a>
        </div>
      )}

      {connected && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <p style={{ fontSize: 12, color: '#8888aa' }}>Connected as <span style={{ color: '#f0f0f4' }}>{auth?.email}</span></p>
            <form action="/api/google/disconnect" method="post">
              <button type="submit" style={{ fontSize: 11, color: '#8888aa', background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>Disconnect</button>
            </form>
          </div>

          {loadError && (
            <div className="card" style={{ padding: 16, borderColor: 'rgba(255,120,120,0.3)' }}>
              <p style={{ fontSize: 13, color: '#ff9b9b' }}>Couldn&apos;t load email: {loadError}</p>
            </div>
          )}

          {!loadError && emails.length === 0 && (
            <div className="card" style={{ padding: 24 }}>
              <p style={{ fontSize: 13, color: '#8888aa' }}>No recent inbox messages.</p>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {emails.map((m) => (
              <div key={m.id} className="card" style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <span style={{ fontSize: 13, fontWeight: m.unread ? 700 : 500, color: '#f0f0f4', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.from}</span>
                  <span style={{ fontSize: 11, color: '#44445a', flexShrink: 0 }}>{formatDate(m.date)}</span>
                </div>
                <span style={{ fontSize: 13, color: m.unread ? '#f0d488' : '#c8c8d4' }}>{m.subject}</span>
                <span style={{ fontSize: 12, color: '#8888aa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.snippet}</span>
              </div>
            ))}
          </div>

          <p style={{ marginTop: 20, fontSize: 12, color: '#44445a' }}>
            Want Nessie to draft a reply? <Link href="/hq/nessie" style={{ color: '#f0b429' }}>Ask her in HQ</Link> — drafts wait for your OK in Approvals.
          </p>
        </>
      )}
    </div>
  )
}

function formatDate(raw: string): string {
  if (!raw) return ''
  const d = new Date(raw)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
