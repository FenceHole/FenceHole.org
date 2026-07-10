import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { exchangeCodeAndStore } from '@/lib/integrations/google'

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://fencehole.org'

// Google redirects back here with ?code and ?state (the app's user id).
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  const state = req.nextUrl.searchParams.get('state')
  const error = req.nextUrl.searchParams.get('error')

  if (error) return NextResponse.redirect(new URL(`/hub/inbox?google=${encodeURIComponent(error)}`, SITE))
  if (!code || !state) return NextResponse.redirect(new URL('/hub/inbox?google=missing_code', SITE))

  // Make sure the person completing the flow is the same logged-in user the
  // state claims to be — don't let a stray callback bind tokens to someone else.
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user || user.id !== state) {
    return NextResponse.redirect(new URL('/hub/inbox?google=auth_mismatch', SITE))
  }

  try {
    await exchangeCodeAndStore(code, user.id)
    return NextResponse.redirect(new URL('/hub/inbox?google=connected', SITE))
  } catch {
    return NextResponse.redirect(new URL('/hub/inbox?google=exchange_failed', SITE))
  }
}
