import Link from 'next/link'
import { connectorStatus } from '@/lib/integrations/connectors'

// What Nessie can reach, and exactly what each missing piece needs. Written to
// be read by Chris when he's deciding what to go and fetch.

export const dynamic = 'force-dynamic'

export default function ConnectionsPage() {
  const connectors = connectorStatus()
  const live = connectors.filter((c) => c.configured)

  return (
    <div style={{ padding: '28px 20px 60px', maxWidth: 900, margin: '0 auto' }}>
      <header style={{ marginBottom: 24 }}>
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 3, color: '#f0b429' }}>NESSIE</p>
        <h1 className="font-display" style={{ fontSize: 28, color: '#f0f0f4', marginTop: 4 }}>
          What she can reach
        </h1>
        <div className="gold-divider" style={{ width: 70, margin: '12px 0' }} />
        <p style={{ fontSize: 13, color: '#8888aa', lineHeight: 1.6 }}>
          {live.length} of {connectors.length} connected. She can <strong style={{ color: '#d8d8e2' }}>read</strong> from
          anything connected. Nothing here lets her <strong style={{ color: '#d8d8e2' }}>change</strong> a
          live system directly — every change is queued in{' '}
          <Link href="/hq/approvals" style={{ color: '#f0b429', textDecoration: 'none' }}>approvals</Link> first.
        </p>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {connectors.map((c) => (
          <section
            key={c.key}
            className="card"
            style={{ padding: 16, borderLeft: `2px solid ${c.configured ? '#4ad3a0' : '#44445a'}` }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: 15, fontWeight: 600, color: '#f0f0f4' }}>{c.label}</h2>
              <span
                style={{
                  fontSize: 9.5, letterSpacing: 1, textTransform: 'uppercase', fontFamily: 'monospace',
                  padding: '2px 7px', borderRadius: 3,
                  color: c.configured ? '#4ad3a0' : '#8888aa',
                  border: `1px solid ${c.configured ? 'rgba(74,211,160,.35)' : 'rgba(255,255,255,.12)'}`,
                  background: c.configured ? 'rgba(74,211,160,.08)' : 'transparent',
                }}
              >
                {c.configured ? 'connected' : 'not connected'}
              </span>
            </div>

            <p style={{ fontSize: 12.5, color: '#8888aa', marginTop: 8, lineHeight: 1.55 }}>
              <span style={{ color: '#5a5a72' }}>Reads:</span> {c.reads.join(' · ')}
            </p>
            {c.writes.length > 0 && (
              <p style={{ fontSize: 12.5, color: '#8888aa', marginTop: 3, lineHeight: 1.55 }}>
                <span style={{ color: '#5a5a72' }}>Can propose:</span> {c.writes.join(' · ')}
              </p>
            )}

            {!c.configured && (
              <div style={{ marginTop: 10, padding: 10, borderRadius: 8, background: 'rgba(255,255,255,.03)' }}>
                <p style={{ fontSize: 12, color: '#d8d8e2' }}>
                  Needs <code style={{ color: '#f0b429' }}>{c.missing.join(', ')}</code> in Vercel
                </p>
                <p style={{ fontSize: 11.5, color: '#5a5a72', marginTop: 4, lineHeight: 1.5 }}>{c.where}</p>
              </div>
            )}
          </section>
        ))}
      </div>

      <p style={{ marginTop: 24, fontSize: 11.5, color: '#44445a', lineHeight: 1.6 }}>
        Add a variable in Vercel under Settings → Environment Variables (Production), then redeploy.
        Nessie picks it up on the next message — ask her &ldquo;what are you connected to?&rdquo; to confirm.
      </p>
    </div>
  )
}
