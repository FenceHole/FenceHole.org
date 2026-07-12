import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { pickModel } from '@/lib/hq/agents/router'
import { callOpenRouter } from '@/lib/hq/agents/llm'
import { NESSIE_SYSTEM_PROMPT } from '@/lib/hq/agents/nessie'
import { recallMemory, remember } from '@/lib/hq/agents/memory'

const AGENT_ID = 'nessie-chief-of-staff'

export async function POST(req: NextRequest) {
  // Only a signed-in team member can summon Nessie into the chat.
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { data: profile } = await sb.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'team') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { prompt, from } = await req.json()
  const admin = createAdminClient()

  async function postAsNessie(body: string) {
    await admin.from('team_messages').insert({ author_name: 'Nessie', role: 'nessie', body })
  }

  try {
    const [{ data: recent }, memories] = await Promise.all([
      admin.from('team_messages').select('author_name,role,body').order('created_at', { ascending: false }).limit(12),
      recallMemory(AGENT_ID, 12),
    ])
    const history = (recent ?? []).reverse()

    const context = [
      memories.length
        ? `Things you remember about Chris's life/business:\n${memories.map((m) => `- [${m.category}] ${m.content}`).join('\n')}`
        : '',
      history.length
        ? `Recent team chat:\n${history.map((h) => `${h.role === 'nessie' ? 'Nessie' : h.author_name}: ${h.body}`).join('\n')}`
        : '',
      `${from ?? 'A teammate'} just asked you (in team chat): ${prompt}`,
      `\nReply for the whole team to see. Keep it tight. If something here is worth remembering long-term, end with one line starting "MEMORY:".`,
    ].filter(Boolean).join('\n\n')

    const model = pickModel(context)
    const result = await callOpenRouter(model.id, NESSIE_SYSTEM_PROMPT, context)

    let reply = result.content
    const memMatch = reply.match(/\n+MEMORY:\s*(.+)$/i)
    if (memMatch) {
      await remember(AGENT_ID, 'team-chat-note', memMatch[1].trim())
      reply = reply.replace(/\n+MEMORY:\s*(.+)$/i, '').trim()
    }

    await postAsNessie(reply)
    return NextResponse.json({ ok: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown error'
    if (msg.includes('OPENROUTER_API_KEY')) {
      await postAsNessie("I'm not connected to my brain yet — someone needs to add OPENROUTER_API_KEY in Vercel and redeploy.")
    } else {
      await postAsNessie(`I hit a snag: ${msg}`)
    }
    return NextResponse.json({ ok: false, error: msg })
  }
}
