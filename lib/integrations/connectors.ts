// Nessie's connections to the outside world.
//
// One rule runs through all of it: reading is free, changing is gated. She can
// look at repositories, deployments, logs and DNS records whenever she likes —
// that's how she becomes useful for "why is the site down" instead of guessing.
// Anything that alters a live system is queued for Chris the same way a draft
// email is, because a wrong DNS record takes the storefront off the internet
// and a force-push loses work.
//
// Every connector degrades honestly: if its credentials are absent, its tools
// say so by name rather than failing with something cryptic.

export interface Connector {
  key: string
  label: string
  /** Env vars required for this connector to work. */
  env: string[]
  /** What she can do once it's connected. */
  reads: string[]
  writes: string[]
  /** Where Chris gets the credential. */
  where: string
}

export const CONNECTORS: Connector[] = [
  {
    key: 'github',
    label: 'GitHub',
    env: ['GITHUB_TOKEN'],
    reads: ['repositories', 'recent commits', 'open issues and pull requests'],
    writes: ['open an issue (queued for approval)'],
    where: 'github.com/settings/tokens — a fine-grained token, read access to your repos',
  },
  {
    key: 'vercel',
    label: 'Vercel',
    env: ['VERCEL_TOKEN'],
    reads: ['deployments and their status', 'runtime errors', 'which build is live'],
    writes: [],
    where: 'vercel.com/account/tokens',
  },
  {
    key: 'cloudflare',
    label: 'Cloudflare',
    env: ['CLOUDFLARE_API_TOKEN'],
    reads: ['zones (domains)', 'DNS records'],
    writes: ['change a DNS record (queued for approval)'],
    where: 'dash.cloudflare.com/profile/api-tokens — Zone.DNS read, plus edit only if you want her proposing changes',
  },
  {
    key: 'ionos',
    label: 'IONOS',
    env: ['IONOS_API_KEY'],
    reads: ['domains', 'DNS records'],
    writes: ['change a DNS record (queued for approval)'],
    where: 'developer.hosting.ionos.com — the key is "publicprefix.secret" in one string',
  },
  {
    key: 'search',
    label: 'Web search',
    env: ['SEARCH_API_KEY'],
    reads: ['the open web — for research and her nightly self-review'],
    writes: [],
    where: 'tavily.com or brave.com/search/api — both have free tiers',
  },
  {
    key: 'google',
    label: 'Google Workspace',
    env: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
    reads: ['email', 'calendar'],
    writes: ['draft an email (queued for approval — never sent directly)'],
    where: 'console.cloud.google.com — OAuth client, then each account connects itself',
  },
]

export function isConfigured(key: string): boolean {
  const c = CONNECTORS.find((x) => x.key === key)
  if (!c) return false
  return c.env.every((e) => Boolean(process.env[e]))
}

export function connectorStatus() {
  return CONNECTORS.map((c) => ({
    ...c,
    configured: c.env.every((e) => Boolean(process.env[e])),
    missing: c.env.filter((e) => !process.env[e]),
  }))
}

/** Thrown when a tool is called for a connector that has no credentials. */
export function notConfigured(key: string): { error: string } {
  const c = CONNECTORS.find((x) => x.key === key)
  return {
    error: c
      ? `${c.label} isn't connected yet. It needs ${c.env.join(' and ')} set in Vercel. Get it from ${c.where}.`
      : `Unknown connector: ${key}`,
  }
}

// --- GitHub ------------------------------------------------------------

const GH = 'https://api.github.com'

async function gh(path: string): Promise<unknown> {
  const res = await fetch(`${GH}${path}`, {
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${(await res.text()).slice(0, 200)}`)
  return res.json()
}

export async function githubRepos(): Promise<unknown> {
  const data = (await gh('/user/repos?sort=updated&per_page=25')) as Record<string, unknown>[]
  return data.map((r) => ({
    name: r.full_name,
    private: r.private,
    updated: r.updated_at,
    language: r.language,
    description: r.description,
    open_issues: r.open_issues_count,
  }))
}

export async function githubActivity(repo: string): Promise<unknown> {
  const [commits, prs] = await Promise.all([
    gh(`/repos/${repo}/commits?per_page=10`) as Promise<Record<string, unknown>[]>,
    gh(`/repos/${repo}/pulls?state=open&per_page=10`) as Promise<Record<string, unknown>[]>,
  ])
  return {
    commits: commits.map((c) => ({
      sha: String(c.sha).slice(0, 7),
      message: String((c.commit as Record<string, unknown>)?.message ?? '').split('\n')[0],
      date: ((c.commit as Record<string, unknown>)?.author as Record<string, unknown>)?.date,
    })),
    open_pull_requests: prs.map((p) => ({ number: p.number, title: p.title, updated: p.updated_at })),
  }
}

// --- Vercel ------------------------------------------------------------

async function vercel(path: string): Promise<unknown> {
  const res = await fetch(`https://api.vercel.com${path}`, {
    headers: { Authorization: `Bearer ${process.env.VERCEL_TOKEN}` },
  })
  if (!res.ok) throw new Error(`Vercel ${res.status}: ${(await res.text()).slice(0, 200)}`)
  return res.json()
}

export async function vercelDeployments(project?: string): Promise<unknown> {
  const q = project ? `?app=${encodeURIComponent(project)}&limit=10` : '?limit=10'
  const data = (await vercel(`/v6/deployments${q}`)) as { deployments?: Record<string, unknown>[] }
  return (data.deployments ?? []).map((d) => ({
    name: d.name,
    state: d.state,
    target: d.target,
    created: d.created ? new Date(Number(d.created)).toISOString() : null,
    url: d.url,
  }))
}

// --- Cloudflare --------------------------------------------------------

async function cf(path: string): Promise<unknown> {
  const res = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    headers: {
      Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
  })
  const json = (await res.json()) as { success?: boolean; errors?: unknown; result?: unknown }
  if (!res.ok || json.success === false) {
    throw new Error(`Cloudflare ${res.status}: ${JSON.stringify(json.errors).slice(0, 200)}`)
  }
  return json.result
}

export async function cloudflareZones(): Promise<unknown> {
  const zones = (await cf('/zones?per_page=50')) as Record<string, unknown>[]
  return zones.map((z) => ({ id: z.id, name: z.name, status: z.status }))
}

export async function cloudflareDns(zoneId: string): Promise<unknown> {
  const records = (await cf(`/zones/${zoneId}/dns_records?per_page=100`)) as Record<string, unknown>[]
  return records.map((r) => ({
    id: r.id, type: r.type, name: r.name, content: r.content, proxied: r.proxied, ttl: r.ttl,
  }))
}

// --- Web search --------------------------------------------------------

/**
 * Tavily by default — its free tier is generous and the response is already
 * summarised, which suits research more than a list of blue links.
 */
export async function webSearch(query: string, maxResults = 6): Promise<unknown> {
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: process.env.SEARCH_API_KEY,
      query,
      max_results: maxResults,
      search_depth: 'basic',
      include_answer: true,
    }),
  })
  if (!res.ok) throw new Error(`Search ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const data = (await res.json()) as { answer?: string; results?: Record<string, unknown>[] }
  return {
    answer: data.answer ?? null,
    sources: (data.results ?? []).map((r) => ({
      title: r.title,
      url: r.url,
      snippet: String(r.content ?? '').slice(0, 300),
    })),
  }
}
