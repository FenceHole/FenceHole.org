// Nessie's hands. Each tool is exposed to the model as an OpenAI-style
// function; the executor here is the only thing that actually touches data.
//
// The split enforces SAFETY.md in code rather than in prose:
//   - read tools see everything
//   - write tools only ever touch internal state (todos, memory, assessments)
//   - anything outward-facing can ONLY be queued as a draft for approval;
//     there is deliberately no tool that sends, posts, publishes, or spends.

import { createAdminClient } from '@/lib/supabase/admin'
import { listPages, getPage, savePage, deletePage, toSlug, DATA_SOURCES, type Panel } from '@/lib/hub/modules'
import {
  isConfigured, notConfigured, connectorStatus,
  githubRepos, githubActivity, vercelDeployments,
  cloudflareZones, cloudflareDns, webSearch,
} from '@/lib/integrations/connectors'

export interface ToolDef {
  type: 'function'
  function: { name: string; description: string; parameters: Record<string, unknown> }
}

function tool(name: string, description: string, properties: Record<string, unknown>, required: string[] = []): ToolDef {
  return {
    type: 'function',
    function: { name, description, parameters: { type: 'object', properties, required } },
  }
}

const str = (description: string) => ({ type: 'string', description })

export const NESSIE_TOOLS: ToolDef[] = [
  tool('list_deals', 'Brand deal offers with their status, value and any assessment already made.', {
    status: str("Optional filter: new, assessed, approved, declined or done."),
  }),
  tool('list_todos', "The shared daily to-do list.", {
    date: str('Optional ISO date (YYYY-MM-DD). Defaults to today.'),
  }),
  tool('list_tasks', 'Longer-running tasks with priority, due date and status.', {
    status: str('Optional filter: todo, in_progress or done.'),
  }),
  tool('list_contacts', 'People in the CRM.', {
    query: str('Optional text to match against name, company or email.'),
  }),
  tool('list_content', 'Content pipeline items.', {
    status: str('Optional filter: idea, writing, review or published.'),
  }),
  tool('list_pending_drafts', 'Drafts already queued and waiting for Chris to approve.', {}),
  tool('recall_memory', 'Your own long-term memory: preferences, prices, history, corrections.', {
    query: str('Optional text to match within stored memories.'),
  }),

  tool('add_todo', "Add an item to today's shared list.", { title: str('The item.') }, ['title']),
  tool('remember', 'Store a durable fact worth recalling in future conversations.', {
    category: str('Short bucket, e.g. pricing, preference, client, deal.'),
    content: str('One sentence that still makes sense read cold in six months.'),
  }, ['category', 'content']),
  tool('assess_deal', 'Record your verdict on a deal offer.', {
    deal_id: str('The deal id from list_deals.'),
    assessment: str('Your reasoning and verdict.'),
    priority: str('low, medium or high.'),
  }, ['deal_id', 'assessment']),
  tool('add_content_idea', 'Add an idea to the content pipeline.', {
    title: str('The idea.'), notes: str('Optional detail.'),
  }, ['title']),

  tool(
    'build_hub_page',
    'Create or replace a page in the Hub, built from panels. This is how you ' +
    'customise your own environment — if Chris asks for a view, dashboard or ' +
    'checklist, build it rather than describing it. Pages appear in the sidebar ' +
    'immediately. Re-calling with the same title replaces that page.',
    {
      title: str('Page name, e.g. "Deal Room" or "Weekly Review".'),
      description: str('Optional one-line subtitle.'),
      icon: str('Optional single emoji.'),
      panels: {
        type: 'array',
        description:
          'Panels, in order. Each is one of: ' +
          '{type:"text",title,body} · ' +
          '{type:"stat",title,source} · ' +
          '{type:"list",title,source,limit} · ' +
          '{type:"links",title,items:[{label,href}]}. ' +
          `Valid sources: ${Object.keys(DATA_SOURCES).join(', ')}.`,
        items: { type: 'object' },
      },
    },
    ['title', 'panels']
  ),
  tool('list_hub_pages', 'The pages you have built, with their panels.', {}),
  tool('delete_hub_page', 'Remove a page you built.', { slug: str('Its slug.') }, ['slug']),

  tool('search_web', 'Search the open web. Use it for research, checking a claim, or ' +
    'looking up what changed in a tool — not for anything you already know.', {
    query: str('What to search for.'),
  }, ['query']),
  tool('list_connections', 'Which outside services you are connected to, and what each ' +
    'one still needs. Use this when Chris asks what you can reach.', {}),
  tool('github_repos', "Chris's repositories, most recently updated first.", {}),
  tool('github_activity', 'Recent commits and open pull requests for one repository.', {
    repo: str('owner/name, e.g. FenceHole/FenceHole.org'),
  }, ['repo']),
  tool('vercel_deployments', 'Recent deployments and whether they succeeded. Useful when ' +
    'something on a site is broken.', {
    project: str('Optional project name to filter by.'),
  }),
  tool('cloudflare_zones', 'Domains on Cloudflare.', {}),
  tool('cloudflare_dns', 'DNS records for one zone. Read-only — changing a record goes ' +
    'through request_infra_change.', {
    zone_id: str('The zone id from cloudflare_zones.'),
  }, ['zone_id']),
  tool(
    'request_infra_change',
    'Propose a change to live infrastructure — DNS, a repository, a deployment. Like ' +
    'queue_draft this only REQUESTS: it is written down for Chris to approve and nothing ' +
    'happens until he does. A wrong DNS record takes a site off the internet, so say ' +
    'plainly what would change and what it would affect.',
    {
      service: str('github, vercel, cloudflare or ionos.'),
      summary: str('One line: what would change.'),
      detail: str('The specifics — exact record, repo, or setting, and the new value.'),
      why: str('Why you want it, and what breaks if it goes wrong.'),
    },
    ['service', 'summary', 'detail', 'why']
  ),

  tool(
    'request_mac_action',
    "Ask to do something on Chris's Mac. Like queue_draft, this only REQUESTS — " +
    'the command waits for him to approve it in the Hub, and the Mac agent has to be ' +
    'running. Use it for opening things, notifications, and reading or writing files ' +
    'in his Nessie folders. Tell him it is waiting for approval.',
    {
      kind: str('notify, open_url, open_app, read_file or write_file.'),
      payload: {
        type: 'object',
        description:
          'notify: {title,text} · open_url: {url} · open_app: {app} · ' +
          'read_file: {path} · write_file: {path,content}',
      },
      reason: str('One line: why you want this. Chris sees it when approving.'),
    },
    ['kind', 'payload']
  ),

  tool(
    'queue_draft',
    'Queue anything outward-facing for Chris to approve. This is the ONLY way to produce ' +
    'an email, reply, post, listing or proposal — it is saved for sign-off and is never sent. ' +
    'Say plainly in your answer that it is waiting for approval.',
    {
      kind: str('reply, email, post, listing, proposal or outreach.'),
      title: str('Short label Chris will see in the approvals queue.'),
      content: str('The full draft, written in Chris\'s voice.'),
      deal_id: str('Optional deal id this draft relates to.'),
    },
    ['kind', 'title', 'content']
  ),
]

const AGENT_ID = 'nessie-chief-of-staff'

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Runs one tool call and returns a compact result the model can read. */
export async function runTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const sb = createAdminClient()

  switch (name) {
    case 'list_deals': {
      let q = sb.from('deal_offers').select('id,brand_name,value,status,priority,offer_text,nessie_assessment')
      if (typeof args.status === 'string') q = q.eq('status', args.status)
      const { data } = await q.order('created_at', { ascending: false }).limit(25)
      return data ?? []
    }
    case 'list_todos': {
      const date = typeof args.date === 'string' ? args.date : todayISO()
      const { data } = await sb.from('daily_todos').select('id,title,done,created_by_name')
        .eq('due_date', date).order('created_at')
      return data ?? []
    }
    case 'list_tasks': {
      let q = sb.from('tasks').select('id,title,status,priority,due_date')
      if (typeof args.status === 'string') q = q.eq('status', args.status)
      else q = q.neq('status', 'done')
      const { data } = await q.order('due_date').limit(25)
      return data ?? []
    }
    case 'list_contacts': {
      let q = sb.from('contacts').select('id,name,email,company,title,notes')
      if (typeof args.query === 'string' && args.query.trim()) {
        const t = args.query.trim()
        q = q.or(`name.ilike.%${t}%,company.ilike.%${t}%,email.ilike.%${t}%`)
      }
      const { data } = await q.limit(25)
      return data ?? []
    }
    case 'list_content': {
      let q = sb.from('content_ideas').select('id,title,status,notes,published_url')
      if (typeof args.status === 'string') q = q.eq('status', args.status)
      const { data } = await q.order('created_at', { ascending: false }).limit(25)
      return data ?? []
    }
    case 'list_pending_drafts': {
      const { data } = await sb.from('agent_drafts').select('id,kind,title,content')
        .eq('status', 'pending').order('created_at', { ascending: false }).limit(15)
      return data ?? []
    }
    case 'recall_memory': {
      let q = sb.from('agent_memory').select('category,content,updated_at').eq('agent_id', AGENT_ID)
      if (typeof args.query === 'string' && args.query.trim()) q = q.ilike('content', `%${args.query.trim()}%`)
      const { data } = await q.order('updated_at', { ascending: false }).limit(25)
      return data ?? []
    }

    case 'add_todo': {
      const title = String(args.title ?? '').trim()
      if (!title) return { error: 'title is required' }
      const { error } = await sb.from('daily_todos')
        .insert({ title, due_date: todayISO(), created_by_name: 'Nessie', source: 'nessie' })
      return error ? { error: error.message } : { ok: true, added: title }
    }
    case 'remember': {
      const content = String(args.content ?? '').trim()
      if (!content) return { error: 'content is required' }
      const { error } = await sb.from('agent_memory')
        .insert({ agent_id: AGENT_ID, category: String(args.category ?? 'note'), content, tags: [] })
      return error ? { error: error.message } : { ok: true, remembered: content }
    }
    case 'assess_deal': {
      const id = String(args.deal_id ?? '')
      if (!id) return { error: 'deal_id is required' }
      const patch: Record<string, unknown> = {
        nessie_assessment: String(args.assessment ?? ''),
        status: 'assessed',
      }
      if (typeof args.priority === 'string') patch.priority = args.priority
      const { error } = await sb.from('deal_offers').update(patch).eq('id', id)
      return error ? { error: error.message } : { ok: true, assessed: id }
    }
    case 'add_content_idea': {
      const title = String(args.title ?? '').trim()
      if (!title) return { error: 'title is required' }
      const { error } = await sb.from('content_ideas')
        .insert({ title, notes: args.notes ? String(args.notes) : null })
      return error ? { error: error.message } : { ok: true, added: title }
    }

    case 'build_hub_page': {
      const title = String(args.title ?? '').trim()
      if (!title) return { error: 'title is required' }
      const slug = toSlug(title)
      if (!slug) return { error: 'that title does not make a usable page name' }

      // Validate every panel before saving. A page that half-renders is worse
      // than a refusal that says which panel was wrong.
      const raw = Array.isArray(args.panels) ? args.panels : []
      const panels: Panel[] = []
      for (const [i, p] of raw.entries()) {
        const panel = p as Record<string, unknown>
        const pTitle = String(panel.title ?? '').trim() || 'Untitled'
        const type = String(panel.type ?? '')

        if (type === 'text') {
          panels.push({ type: 'text', title: pTitle, body: String(panel.body ?? '') })
        } else if (type === 'stat' || type === 'list') {
          const source = String(panel.source ?? '')
          if (!(source in DATA_SOURCES)) {
            return { error: `panel ${i + 1}: "${source}" is not a valid source. Use one of: ${Object.keys(DATA_SOURCES).join(', ')}` }
          }
          panels.push(
            type === 'stat'
              ? { type: 'stat', title: pTitle, source: source as keyof typeof DATA_SOURCES }
              : {
                  type: 'list',
                  title: pTitle,
                  source: source as keyof typeof DATA_SOURCES,
                  limit: Math.min(Number(panel.limit) || 8, 25),
                }
          )
        } else if (type === 'links') {
          const items = Array.isArray(panel.items) ? panel.items : []
          panels.push({
            type: 'links',
            title: pTitle,
            items: items
              .map((it) => it as Record<string, unknown>)
              .filter((it) => it.label && it.href)
              // Only http(s) and in-app paths — no javascript: or data: URLs.
              .filter((it) => /^(https?:\/\/|\/)/i.test(String(it.href)))
              .map((it) => ({ label: String(it.label).slice(0, 80), href: String(it.href).slice(0, 300) })),
          })
        } else {
          return { error: `panel ${i + 1}: unknown type "${type}". Use text, stat, list or links.` }
        }
      }

      await savePage({
        slug,
        title,
        description: args.description ? String(args.description) : undefined,
        icon: args.icon ? String(args.icon).slice(0, 4) : undefined,
        panels,
        updatedAt: new Date().toISOString(),
      })
      return { ok: true, slug, url: `/hub/x/${slug}`, panels: panels.length, note: 'Live now and in the sidebar.' }
    }

    case 'list_hub_pages': {
      const pages = await listPages()
      return pages.map((p) => ({ slug: p.slug, title: p.title, panels: p.panels.length, url: `/hub/x/${p.slug}` }))
    }

    case 'delete_hub_page': {
      const slug = String(args.slug ?? '').trim()
      if (!slug) return { error: 'slug is required' }
      if (!(await getPage(slug))) return { error: `no page called "${slug}"` }
      await deletePage(slug)
      return { ok: true, deleted: slug }
    }

    case 'search_web': {
      if (!isConfigured('search')) return notConfigured('search')
      const q = String(args.query ?? '').trim()
      if (!q) return { error: 'query is required' }
      try { return await webSearch(q) } catch (e) { return { error: String(e).slice(0, 300) } }
    }

    case 'list_connections': {
      return connectorStatus().map((c) => ({
        service: c.label,
        connected: c.configured,
        can_read: c.reads,
        can_change: c.writes.length ? c.writes : ['nothing'],
        needs: c.configured ? null : `${c.missing.join(', ')} — from ${c.where}`,
      }))
    }

    case 'github_repos': {
      if (!isConfigured('github')) return notConfigured('github')
      try { return await githubRepos() } catch (e) { return { error: String(e).slice(0, 300) } }
    }

    case 'github_activity': {
      if (!isConfigured('github')) return notConfigured('github')
      const repo = String(args.repo ?? '').trim()
      if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) return { error: 'repo must look like owner/name' }
      try { return await githubActivity(repo) } catch (e) { return { error: String(e).slice(0, 300) } }
    }

    case 'vercel_deployments': {
      if (!isConfigured('vercel')) return notConfigured('vercel')
      try {
        return await vercelDeployments(args.project ? String(args.project) : undefined)
      } catch (e) { return { error: String(e).slice(0, 300) } }
    }

    case 'cloudflare_zones': {
      if (!isConfigured('cloudflare')) return notConfigured('cloudflare')
      try { return await cloudflareZones() } catch (e) { return { error: String(e).slice(0, 300) } }
    }

    case 'cloudflare_dns': {
      if (!isConfigured('cloudflare')) return notConfigured('cloudflare')
      const zone = String(args.zone_id ?? '').trim()
      if (!/^[a-f0-9]{16,40}$/i.test(zone)) return { error: 'zone_id looks wrong — get it from cloudflare_zones' }
      try { return await cloudflareDns(zone) } catch (e) { return { error: String(e).slice(0, 300) } }
    }

    case 'request_infra_change': {
      const service = String(args.service ?? '').trim()
      const summary = String(args.summary ?? '').trim()
      if (!service || !summary) return { error: 'service and summary are required' }
      // Deliberately a draft, not an action. There is no tool anywhere in this
      // file that mutates live infrastructure directly.
      const { error } = await sb.from('agent_drafts').insert({
        kind: `infra:${service}`,
        title: summary,
        content: [
          `Service: ${service}`,
          `Change: ${args.detail ?? ''}`,
          '',
          `Why: ${args.why ?? ''}`,
          '',
          'Nessie cannot apply this. Approving marks it ready for Chris to do.',
        ].join('\n'),
        status: 'pending',
      })
      return error
        ? { error: error.message }
        : { ok: true, queued: summary, note: 'In /hq/approvals. Nothing has changed yet.' }
    }

    case 'request_mac_action': {
      const kind = String(args.kind ?? '')
      const allowed = ['notify', 'open_url', 'open_app', 'read_file', 'write_file']
      if (!allowed.includes(kind)) {
        return { error: `kind must be one of: ${allowed.join(', ')}` }
      }
      const payload = typeof args.payload === 'object' && args.payload !== null ? args.payload : {}
      const { error } = await sb.from('machine_commands').insert({
        kind,
        payload,
        reason: args.reason ? String(args.reason) : null,
        status: 'pending',
        requested_by: 'nessie',
      })
      return error
        ? { error: error.message }
        : {
            ok: true,
            queued: kind,
            note: 'Waiting for Chris to approve in the Hub. NOT run yet, and it needs the Mac agent running.',
          }
    }

    case 'queue_draft': {
      const title = String(args.title ?? '').trim()
      const content = String(args.content ?? '').trim()
      if (!title || !content) return { error: 'title and content are required' }
      const row: Record<string, unknown> = {
        kind: String(args.kind ?? 'reply'),
        title,
        content,
        status: 'pending',
      }
      if (typeof args.deal_id === 'string' && args.deal_id) row.deal_id = args.deal_id
      const { error } = await sb.from('agent_drafts').insert(row)
      return error
        ? { error: error.message }
        : { ok: true, queued: title, note: 'Saved to /hq/approvals. NOT sent — needs Chris to approve.' }
    }

    default:
      return { error: `unknown tool: ${name}` }
  }
}
