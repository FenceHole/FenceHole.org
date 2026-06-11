import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://potmeockcwrcqmwgyejx.supabase.co'
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_eQIcN2uw4zfYZ79zCgdUGA_PIeEGrDw'
export async function createClient() {
  const c = await cookies()
  return createServerClient(URL, KEY, {
    cookies: {
      getAll() { return c.getAll() },
      setAll(s: { name: string; value: string; options: CookieOptions }[]) { try { s.forEach(({ name, value, options }) => c.set(name, value, options)) } catch {} },
    },
  })
}
