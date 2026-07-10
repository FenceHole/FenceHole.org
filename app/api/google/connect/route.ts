import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildAuthUrl, googleConfigured } from '@/lib/integrations/google'

// Kicks off the Google OAuth flow for the logged-in user.
export async function GET() {
  if (!googleConfigured()) {
    return NextResponse.json(
      { error: 'Google is not configured. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.' },
      { status: 500 },
    )
  }
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_SITE_URL || 'https://fencehole.org'))

  // state = our own user id, so the callback knows whose tokens to store.
  return NextResponse.redirect(buildAuthUrl(user.id))
}
