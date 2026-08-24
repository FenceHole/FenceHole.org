import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Read-only login diagnostics.
//
// Password login can fail for several reasons that all surface as the same
// unhelpful message, and there is currently no way to tell them apart from
// outside. This reports the state of each account so the actual cause is
// visible. It reads only: no account is created, changed, or deleted here.
//
// Email addresses are masked — enough for the owner to recognise which row is
// whose, not enough to be worth harvesting.

export const dynamic = 'force-dynamic'
export const maxDuration = 30

function mask(email: string | undefined): string {
  if (!email) return '(none)'
  const [user, domain] = email.split('@')
  if (!domain) return '***'
  const head = user.slice(0, 2)
  const tail = user.length > 3 ? user.slice(-1) : ''
  const [d, ...rest] = domain.split('.')
  return `${head}${'*'.repeat(Math.max(1, user.length - 3))}${tail}@${d[0]}${'*'.repeat(Math.max(1, d.length - 1))}.${rest.join('.')}`
}

export async function GET() {
  const sb = createAdminClient()

  const { data: list, error } = await sb.auth.admin.listUsers({ perPage: 200 })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: profiles } = await sb.from('profiles').select('id,full_name,role')
  const byId = new Map((profiles ?? []).map((p) => [p.id, p]))

  const accounts = list.users.map((u) => {
    const providers = (u.app_metadata?.providers as string[] | undefined)
      ?? (u.app_metadata?.provider ? [u.app_metadata.provider as string] : [])
    return {
      email_masked: mask(u.email),
      email_length: u.email?.length ?? 0,
      domain: u.email?.split('@')[1] ?? null,
      role: byId.get(u.id)?.role ?? '(no profile row)',
      name: byId.get(u.id)?.full_name ?? null,
      // 'email' in providers means a password login is possible at all.
      providers,
      can_use_password: providers.includes('email'),
      email_confirmed: Boolean(u.email_confirmed_at),
      mfa_factors: (u.factors ?? []).length,
      last_sign_in: u.last_sign_in_at ?? 'never',
      created: u.created_at,
    }
  })

  const teamCount = accounts.filter((a) => a.role === 'team').length

  return NextResponse.json({
    total_accounts: accounts.length,
    team_accounts: teamCount,
    likely_problems: [
      ...(accounts.some((a) => !a.can_use_password)
        ? ['An account has no email/password identity — password login cannot work for it.']
        : []),
      ...(accounts.some((a) => !a.email_confirmed)
        ? ['An account is unconfirmed — login fails with "Email not confirmed".']
        : []),
      ...(accounts.some((a) => a.mfa_factors > 0)
        ? ['An account has 2FA enrolled — it will ask for a 6-digit code after the password.']
        : []),
      ...(accounts.some((a) => a.role !== 'team')
        ? ['An account is not role=team — it gets redirected away from the Hub.']
        : []),
      ...(teamCount === 0 ? ['No account has role=team at all.'] : []),
    ],
    accounts,
  })
}
