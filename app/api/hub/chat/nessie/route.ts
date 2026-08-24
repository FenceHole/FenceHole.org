import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { runNessie } from '@/lib/hq/agents/loop'

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
    // The visible chat log is the thread here, so recent messages are the
    // context; memory and tools come from the loop itself.
    const { data: recent } = await admin
      .from('team_messages')
      .select('author_name,role,body')
      .order('created_at', { ascending: false })
      .limit(12)
    const history = (recent ?? []).reverse()

    const framing = [
      history.length
        ? `Recent team chat:\n${history.map((h) => `${h.role === 'nessie' ? 'Nessie' : h.author_name}: ${h.body}`).join('\n')}`
        : '',
      `${from ?? 'A teammate'} just asked you this in team chat. Reply for the whole team to see — keep it tight.`,
    ].filter(Boolean).join('\n\n')

    const run = await runNessie(prompt, {
      channel: 'team-chat',
      externalId: null,
      framing,
      // The visible chat is already the history; don't replay it twice.
      historyLimit: 0,
    })

    // runNessie already saved and stripped any MEMORY: line.
    await postAsNessie(run.reply)
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
