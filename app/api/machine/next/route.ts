import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// The Mac agent polls this for work. It only ever hands back commands a human
// has already approved in the Hub — pending rows are invisible here.

export const dynamic = 'force-dynamic'

function authorized(req: NextRequest): boolean {
  const token = process.env.NESSIE_AGENT_TOKEN
  if (!token) return false
  return req.headers.get('authorization') === `Bearer ${token}`
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const sb = createAdminClient()
  const { data, error } = await sb
    .from('machine_commands')
    .select('id,kind,payload,reason')
    .eq('status', 'approved')
    .order('created_at')
    .limit(1)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const command = data?.[0] ?? null
  if (command) {
    // Claim it so a second agent instance can't pick up the same row.
    await sb.from('machine_commands')
      .update({ status: 'running', updated_at: new Date().toISOString() })
      .eq('id', command.id)
  }

  return NextResponse.json({ command })
}
