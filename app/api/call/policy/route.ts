import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCameraPolicy, lockFace } from '@/lib/call/policy'

// Resolves what the signed-in account is allowed to do with its camera.
// Server-side on purpose: the client is told what it may do, it doesn't decide.

export const dynamic = 'force-dynamic'

export async function GET() {
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { data: p } = await sb.from('profiles').select('role,full_name').eq('id', user.id).single()
  if (p?.role !== 'team') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const policy = await getCameraPolicy(user.id)
  return NextResponse.json({
    policy,
    me: user.id,
    name: p?.full_name?.split(' ')[0] ?? 'Team',
  })
}

export async function POST(req: NextRequest) {
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { data: p } = await sb.from('profiles').select('role').eq('id', user.id).single()
  if (p?.role !== 'team') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const body = await req.json().catch(() => null)
  // You can only lock your own camera, and there is no unlock here by design —
  // reversing it should take a deliberate database change, not a stray click.
  if (body?.lock !== true) return NextResponse.json({ error: 'unknown action' }, { status: 400 })

  await lockFace(user.id)
  return NextResponse.json({ ok: true, policy: await getCameraPolicy(user.id) })
}
