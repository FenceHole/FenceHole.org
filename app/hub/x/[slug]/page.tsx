import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPage, loadPanelData, DATA_SOURCES, type Panel } from '@/lib/hub/modules'

// Renders a page Nessie built. Everything here comes from her stored panel
// data — there is no code path where she supplies markup or a query, so a
// badly-designed page is just a badly-designed page.

export const dynamic = 'force-dynamic'

interface Row { id: string; title: string; status: string | null; extra: string | null }

export default async function NessiePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const page = await getPage(slug)
  if (!page) notFound()

  const data = await Promise.all(page.panels.map((p) => loadPanelData(p).catch(() => null)))

  return (
    <div style={{ padding: '28px 20px 60px', maxWidth: 1100, margin: '0 auto' }}>
      <header style={{ marginBottom: 24 }}>
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 3, color: '#f0b429' }}>
          BUILT BY NESSIE
        </p>
        <h1 className="font-display" style={{ fontSize: 30, color: '#f0f0f4', marginTop: 4 }}>
          {page.icon ? `${page.icon} ` : ''}{page.title}
        </h1>
        <div className="gold-divider" style={{ width: 70, margin: '12px 0' }} />
        {page.description && (
          <p style={{ fontSize: 13, color: '#8888aa', lineHeight: 1.6 }}>{page.description}</p>
        )}
      </header>

      {page.panels.length === 0 ? (
        <p style={{ fontSize: 13, color: '#5a5a72' }}>
          This page has no panels yet. Ask Nessie to add one.
        </p>
      ) : (
        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))' }}>
          {page.panels.map((panel, i) => (
            <PanelCard key={i} panel={panel} data={data[i]} />
          ))}
        </div>
      )}

      <p style={{ marginTop: 28, fontSize: 11, color: '#44445a' }}>
        Updated {new Date(page.updatedAt).toLocaleString()} ·{' '}
        <Link href="/hub" style={{ color: '#8888aa', textDecoration: 'none' }}>Back to Mission Control</Link>
      </p>
    </div>
  )
}

function PanelCard({ panel, data }: { panel: Panel; data: unknown }) {
  return (
    <section className="card" style={{ padding: 16 }}>
      <h2 style={{ fontSize: 11, letterSpacing: 1.6, textTransform: 'uppercase', color: '#8888aa', marginBottom: 10 }}>
        {panel.title}
      </h2>

      {panel.type === 'text' && (
        <p style={{ fontSize: 13.5, color: '#d8d8e2', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
          {panel.body}
        </p>
      )}

      {panel.type === 'stat' && (
        <>
          <p style={{ fontSize: 34, fontWeight: 700, color: '#f0b429', lineHeight: 1.1 }}>
            {(data as { count?: number } | null)?.count ?? 0}
          </p>
          <p style={{ fontSize: 12, color: '#8888aa', marginTop: 4 }}>
            {DATA_SOURCES[panel.source]?.label ?? panel.source}
          </p>
        </>
      )}

      {panel.type === 'list' && (
        Array.isArray(data) && (data as Row[]).length > 0 ? (
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(data as Row[]).map((row) => (
              <li key={row.id} style={{ display: 'flex', gap: 8, alignItems: 'baseline', fontSize: 13 }}>
                <span style={{ color: '#e2e2ea', flex: 1, minWidth: 0 }}>{row.title}</span>
                {row.status && (
                  <span style={{ fontSize: 10, color: '#f0b429', textTransform: 'uppercase', letterSpacing: 1 }}>
                    {row.status}
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p style={{ fontSize: 12.5, color: '#5a5a72' }}>Nothing here right now.</p>
        )
      )}

      {panel.type === 'links' && (
        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 7 }}>
          {panel.items.map((item, i) => (
            <li key={i}>
              {/* External links open away; internal ones route in-app. */}
              {/^https?:\/\//i.test(item.href) ? (
                <a href={item.href} target="_blank" rel="noopener noreferrer"
                   style={{ fontSize: 13, color: '#f0b429', textDecoration: 'none' }}>
                  {item.label} ↗
                </a>
              ) : (
                <Link href={item.href} style={{ fontSize: 13, color: '#f0b429', textDecoration: 'none' }}>
                  {item.label} →
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
