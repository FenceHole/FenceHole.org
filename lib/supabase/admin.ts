import { createClient } from '@supabase/supabase-js'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://potmeockcwrcqmwgyejx.supabase.co'

// Service-role client for server-only routes (webhooks, cron) that need to
// read/write agent tables without a logged-in user session. Never import
// this from client components.
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured')
  return createClient(URL, key, { auth: { autoRefreshToken: false, persistSession: false } })
}
