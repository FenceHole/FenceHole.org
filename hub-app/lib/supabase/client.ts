import { createBrowserClient } from '@supabase/ssr'
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://potmeockcwrcqmwgyejx.supabase.co'
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_eQIcN2uw4zfYZ79zCgdUGA_PIeEGrDw'
export function createClient() { return createBrowserClient(URL, KEY) }
