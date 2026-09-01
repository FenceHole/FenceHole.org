// Nessie's own workspace: pages she builds, out of panels she composes.
//
// The design constraint that makes this safe to hand her: a page is DATA, not
// code. She picks panel types and data sources from a fixed allowlist and
// fills in labels. She cannot write SQL, cannot inject a query, and cannot
// render arbitrary markup — so the worst outcome of a bad idea is a page that
// looks wrong, which Chris deletes. Nothing she builds here can break the app
// or reach anything she couldn't already read through her tools.
//
// Stored as reserved rows in agent_memory (see the __ convention in
// settings.ts and call/policy.ts), so adding pages needs no migration.

import { createAdminClient } from '@/lib/supabase/admin'

const CATEGORY = '__hub_page'
const AGENT_ID = 'nessie-chief-of-staff'

/** Tables she may read from, and how each is summarised. */
export const DATA_SOURCES = {
  deals: { table: 'deals', label: 'Deals', title: 'title', order: 'created_at' },
  deal_offers: { table: 'deal_offers', label: 'Brand offers', title: 'brand_name', order: 'created_at' },
  tasks: { table: 'tasks', label: 'Tasks', title: 'title', order: 'due_date' },
  todos: { table: 'daily_todos', label: "Today's list", title: 'title', order: 'created_at' },
  contacts: { table: 'contacts', label: 'Contacts', title: 'name', order: 'created_at' },
  content: { table: 'content_ideas', label: 'Content', title: 'title', order: 'created_at' },
  drafts: { table: 'agent_drafts', label: 'Drafts awaiting approval', title: 'title', order: 'created_at' },
} as const

export type SourceKey = keyof typeof DATA_SOURCES

export type Panel =
  | { type: 'text'; title: string; body: string }
  | { type: 'stat'; title: string; source: SourceKey; where?: { field: string; equals: string } }
  | { type: 'list'; title: string; source: SourceKey; limit?: number; where?: { field: string; equals: string } }
  | { type: 'links'; title: string; items: { label: string; href: string }[] }

export interface HubPage {
  slug: string
  title: string
  description?: string
  icon?: string
  panels: Panel[]
  updatedAt: string
  /** Tombstone marker — see deletePage. */
  deleted?: boolean
}

export function isSourceKey(v: unknown): v is SourceKey {
  return typeof v === 'string' && v in DATA_SOURCES
}

/** Slugs are used in URLs and as the storage key, so keep them tame. */
export function toSlug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}

export async function listPages(): Promise<HubPage[]> {
  try {
    const sb = createAdminClient()
    const { data } = await sb
      .from('agent_memory')
      .select('content,updated_at')
      .eq('agent_id', AGENT_ID)
      .eq('category', CATEGORY)
      .order('updated_at', { ascending: false })

    const seen = new Set<string>()
    const pages: HubPage[] = []
    for (const row of data ?? []) {
      try {
        const page = JSON.parse(row.content) as HubPage
        // Newest row per slug wins; older revisions are history.
        if (page?.slug && !seen.has(page.slug)) {
          seen.add(page.slug)
          if (!page.deleted) pages.push(page)
        }
      } catch {
        // A malformed row shouldn't take the whole workspace down.
      }
    }
    return pages
  } catch {
    return []
  }
}

export async function getPage(slug: string): Promise<HubPage | null> {
  return (await listPages()).find((p) => p.slug === slug) ?? null
}

export async function savePage(page: HubPage): Promise<void> {
  const sb = createAdminClient()
  await sb.from('agent_memory').insert({
    agent_id: AGENT_ID,
    category: CATEGORY,
    content: JSON.stringify({ ...page, updatedAt: new Date().toISOString() }),
    tags: ['hub-page', page.slug],
  })
}

/** Soft delete: a tombstone revision, so a page can be recovered from history. */
export async function deletePage(slug: string): Promise<void> {
  const sb = createAdminClient()
  await sb.from('agent_memory').insert({
    agent_id: AGENT_ID,
    category: CATEGORY,
    content: JSON.stringify({ slug, deleted: true, updatedAt: new Date().toISOString() }),
    tags: ['hub-page', slug, 'deleted'],
  })
}

/** Resolve a panel's data. Only the allowlisted sources are reachable. */
export async function loadPanelData(panel: Panel): Promise<unknown> {
  if (panel.type === 'text' || panel.type === 'links') return null
  const src = DATA_SOURCES[panel.source]
  if (!src) return null

  const sb = createAdminClient()
  let q = sb.from(src.table).select('*')
  // The field is checked against real columns by Postgres; an unknown one
  // returns an error rather than widening what she can see.
  if (panel.where?.field && panel.where.equals !== undefined) {
    q = q.eq(panel.where.field, panel.where.equals)
  }

  if (panel.type === 'stat') {
    let cq = sb.from(src.table).select('id', { count: 'exact', head: true })
    if (panel.where?.field && panel.where.equals !== undefined) {
      cq = cq.eq(panel.where.field, panel.where.equals)
    }
    const { count } = await cq.then((r) => r, () => ({ count: 0 }))
    return { count: count ?? 0 }
  }

  const { data } = await q.order(src.order, { ascending: false }).limit(panel.limit ?? 8)
  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id,
    title: row[src.title] ?? '(untitled)',
    status: row.status ?? null,
    extra: row.priority ?? row.value ?? row.company ?? null,
  }))
}
