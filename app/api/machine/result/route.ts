import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// The Mac agent reports back here once it has run a command.

export const dynamic = 'force-dynamic'

function authorized(req: NextRequest): boolean {
  const token = process.env.NESSIE_AGENT_TOKEN
  if (!token) return false
  return req.headers.get('authorization') === `Bearer ${token}`
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const id = body?.id
  const status = body?.status === 'failed' ? 'failed' : 'done'

  if (typeof id !== 'string' || !id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  const sb = createAdminClient()
  const { error } = await sb
    .from('machine_commands')
    .update({
      status,
      result: typeof body?.result === 'string' ? body.result.slice(0, 4000) : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
