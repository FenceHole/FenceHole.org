// Nessie's hands. Each tool is exposed to the model as an OpenAI-style
// function; the executor here is the only thing that actually touches data.
//
// The split enforces SAFETY.md in code rather than in prose:
//   - read tools see everything
//   - write tools only ever touch internal state (todos, memory, assessments)
//   - anything outward-facing can ONLY be queued as a draft for approval;
//     there is deliberately no tool that sends, posts, publishes, or spends.

import { createAdminClient } from '@/lib/supabase/admin'

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
