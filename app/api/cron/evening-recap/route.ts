import { NextRequest, NextResponse } from 'next/server'
import { callOpenRouter } from '@/lib/hq/agents/llm'
import { NESSIE_SYSTEM_PROMPT } from '@/lib/hq/agents/nessie'
import { sendWhatsApp } from '@/lib/integrations/twilio'
import { createAdminClient } from '@/lib/supabase/admin'
import { recallMemory, logMessage } from '@/lib/hq/agents/memory'

const AGENT_ID = 'nessie-chief-of-staff'

function authorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return req.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const sb = createAdminClient()
  const today = new Date().toISOString().slice(0, 10)
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const [{ data: tasks }, { data: drafts }, { data: recentConvo }, memories] = await Promise.all([
    sb.from('tasks').select('title,priority,due_date,status').neq('status', 'done').order('due_date'),
    sb.from('agent_drafts').select('title,kind,status').eq('status', 'pending'),
    sb.from('agent_conversations').select('role,content,channel').gte('created_at', since).order('created_at'),
    recallMemory(AGENT_ID, 10),
  ])

  const prompt = `It's evening on ${today}. Give Chris a short recap and set him up for tomorrow. Be Donna: warm but efficient, no fluff.

Still open / not done:
${(tasks ?? []).map((t) => `- [${t.priority}] ${t.title}${t.due_date ? ` (due ${t.due_date})` : ''}`).join('\n') || 'none'}

Still waiting on his approval (/hq/approvals):
${(drafts ?? []).map((d) => `- (${d.kind}) ${d.title}`).join('\n') || 'none'}

Today's conversation across channels (${(recentConvo ?? []).length} messages):
${(recentConvo ?? []).slice(-20).map((c) => `- [${c.channel}/${c.role}] ${c.content.slice(0, 140)}`).join('\n') || 'quiet day'}

Recent notes/memory:
${memories.map((m) => `- ${m.content}`).join('\n') || 'none'}

Structure your reply as:
1) What moved today (1-3 bullets)
2) What's still open and needs attention
3) Tomorrow's #1 priority — your pick, stated plainly`

  const result = await callOpenRouter('anthropic/claude-3.5-haiku', NESSIE_SYSTEM_PROMPT, prompt)

  const to = process.env.CHRIS_WHATSAPP_NUMBER
  if (to) await sendWhatsApp(to, `🌙 Evening recap — ${today}\n\n${result.content}`)
  await logMessage(AGENT_ID, 'whatsapp', to ?? 'system', 'assistant', result.content)

  return NextResponse.json({ ok: true, sent: !!to, recap: result.content })
}
