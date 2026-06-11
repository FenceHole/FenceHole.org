import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://potmeockcwrcqmwgyejx.supabase.co'
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_eQIcN2uw4zfYZ79zCgdUGA_PIeEGrDw'

export async function middleware(request: NextRequest) {
  let res = NextResponse.next({ request })
  const supabase = createServerClient(SUPABASE_URL, KEY, {
    cookies: {
      getAll() { return request.cookies.getAll() },
      setAll(s: { name: string; value: string; options: CookieOptions }[]) {
        s.forEach(({ name, value }) => request.cookies.set(name, value))
        res = NextResponse.next({ request })
        s.forEach(({ name, value, options }) => res.cookies.set(name, value, options))
      },
    },
  })
  const { data: { user } } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname
  if ((path.startsWith('/hub') || path.startsWith('/client') || path.startsWith('/hq')) && !user)
    return NextResponse.redirect(new URL('/login', request.url))
  return res
}
export const config = { matcher: ['/hub/:path*', '/client/:path*', '/hq/:path*'] }
