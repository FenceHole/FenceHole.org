import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { disconnectGoogle } from '@/lib/integrations/google'

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://fencehole.org'

export async function POST() {
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', SITE))
  await disconnectGoogle(user.id)
  return NextResponse.redirect(new URL('/hub/inbox?google=disconnected', SITE))
}
