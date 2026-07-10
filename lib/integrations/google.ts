// Google integration — Gmail + Calendar for the Hub.
//
// Uses a standard OAuth2 authorization-code flow. Each team member connects
// their own Google account once; we store the refresh token in the
// `google_accounts` table (service-role only) and mint fresh access tokens
// as needed. No Google client library — plain fetch against the REST APIs so
// there are no extra dependencies to maintain.
//
// Required env:
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET  (Google Cloud OAuth client)
//   GOOGLE_REDIRECT_URI                      (defaults to <site>/api/google/callback)
//   NEXT_PUBLIC_SITE_URL                     (e.g. https://fencehole.org)

import { createAdminClient } from '@/lib/supabase/admin'

const OAUTH_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token'

// Read to display, send/create so Nessie can act once a draft is approved.
export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.readonly',
].join(' ')

export function googleConfigured(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
}

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || 'https://fencehole.org'
}

function redirectUri(): string {
  return process.env.GOOGLE_REDIRECT_URI || `${siteUrl()}/api/google/callback`
}

// Build the consent-screen URL. `state` carries the app's own user id so the
// callback knows whose tokens to store.
export function buildAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope: GOOGLE_SCOPES,
    access_type: 'offline',
    include_granted_scopes: 'true',
    prompt: 'consent',
    state,
  })
  return `${OAUTH_AUTH_URL}?${params.toString()}`
}

interface TokenResponse {
  access_token: string
  refresh_token?: string
  expires_in: number
  scope: string
  token_type: string
}

// Exchange the one-time code from the callback for tokens and persist them.
export async function exchangeCodeAndStore(code: string, userId: string): Promise<string> {
  const res = await fetch(OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri(),
      grant_type: 'authorization_code',
    }),
  })
  if (!res.ok) throw new Error(`Google token exchange failed: ${res.status} ${await res.text()}`)
  const tok = (await res.json()) as TokenResponse

  const email = await fetchUserEmail(tok.access_token)
  const expiry = new Date(Date.now() + (tok.expires_in - 60) * 1000).toISOString()

  const sb = createAdminClient()
  await sb.from('google_accounts').upsert({
    user_id: userId,
    email,
    access_token: tok.access_token,
    // Google only returns a refresh_token on the first consent; keep the old
    // one if this response doesn't include a new one.
    ...(tok.refresh_token ? { refresh_token: tok.refresh_token } : {}),
    scope: tok.scope,
    token_type: tok.token_type,
    expiry,
    updated_at: new Date().toISOString(),
  })
  return email
}

async function fetchUserEmail(accessToken: string): Promise<string> {
  const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) return ''
  const data = await res.json()
  return data.email ?? ''
}

interface StoredAccount {
  email: string | null
  access_token: string | null
  refresh_token: string | null
  expiry: string | null
}

// Returns a valid access token for the user, refreshing if expired. Returns
// null if the user hasn't connected Google. Server-only (uses admin client).
export async function getValidAccessToken(userId: string): Promise<{ token: string; email: string | null } | null> {
  const sb = createAdminClient()
  const { data } = await sb
    .from('google_accounts')
    .select('email,access_token,refresh_token,expiry')
    .eq('user_id', userId)
    .maybeSingle<StoredAccount>()

  if (!data || !data.refresh_token) return null

  const stillValid = data.access_token && data.expiry && new Date(data.expiry).getTime() > Date.now()
  if (stillValid) return { token: data.access_token!, email: data.email }

  // Refresh.
  const res = await fetch(OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: data.refresh_token,
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) throw new Error(`Google token refresh failed: ${res.status} ${await res.text()}`)
  const tok = (await res.json()) as TokenResponse
  const expiry = new Date(Date.now() + (tok.expires_in - 60) * 1000).toISOString()

  await sb.from('google_accounts').update({
    access_token: tok.access_token,
    expiry,
    updated_at: new Date().toISOString(),
  }).eq('user_id', userId)

  return { token: tok.access_token, email: data.email }
}

export async function disconnectGoogle(userId: string): Promise<void> {
  const sb = createAdminClient()
  await sb.from('google_accounts').delete().eq('user_id', userId)
}

// ---- Gmail ----

export interface EmailSummary {
  id: string
  threadId: string
  from: string
  subject: string
  snippet: string
  date: string
  unread: boolean
}

export async function listRecentEmail(userId: string, max = 15): Promise<EmailSummary[]> {
  const auth = await getValidAccessToken(userId)
  if (!auth) return []
  const headers = { Authorization: `Bearer ${auth.token}` }

  const listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${max}&labelIds=INBOX`,
    { headers },
  )
  if (!listRes.ok) throw new Error(`Gmail list failed: ${listRes.status}`)
  const { messages = [] } = await listRes.json()

  const summaries = await Promise.all(
    messages.map(async (m: { id: string }) => {
      const r = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
        { headers },
      )
      if (!r.ok) return null
      const msg = await r.json()
      const h = (name: string) =>
        msg.payload?.headers?.find((x: { name: string; value: string }) => x.name === name)?.value ?? ''
      return {
        id: msg.id,
        threadId: msg.threadId,
        from: h('From'),
        subject: h('Subject') || '(no subject)',
        snippet: msg.snippet ?? '',
        date: h('Date'),
        unread: Array.isArray(msg.labelIds) && msg.labelIds.includes('UNREAD'),
      } as EmailSummary
    }),
  )
  return summaries.filter(Boolean) as EmailSummary[]
}

// Send an email as the connected user. This is the "leaves the building"
// action — callers must gate it behind an approved draft.
export async function sendEmail(userId: string, to: string, subject: string, body: string): Promise<void> {
  const auth = await getValidAccessToken(userId)
  if (!auth) throw new Error('Google is not connected for this user')

  const raw = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'Content-Type: text/plain; charset=utf-8',
    '',
    body,
  ].join('\r\n')
  const encoded = Buffer.from(raw).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw: encoded }),
  })
  if (!res.ok) throw new Error(`Gmail send failed: ${res.status} ${await res.text()}`)
}

// ---- Calendar ----

export interface CalendarEvent {
  id: string
  summary: string
  start: string
  end: string
  location: string
  allDay: boolean
  htmlLink: string
}

export async function listUpcomingEvents(userId: string, max = 10): Promise<CalendarEvent[]> {
  const auth = await getValidAccessToken(userId)
  if (!auth) return []

  const params = new URLSearchParams({
    timeMin: new Date().toISOString(),
    maxResults: String(max),
    singleEvents: 'true',
    orderBy: 'startTime',
  })
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`,
    { headers: { Authorization: `Bearer ${auth.token}` } },
  )
  if (!res.ok) throw new Error(`Calendar list failed: ${res.status}`)
  const { items = [] } = await res.json()

  return items.map((e: {
    id: string
    summary?: string
    location?: string
    htmlLink?: string
    start?: { dateTime?: string; date?: string }
    end?: { dateTime?: string; date?: string }
  }) => ({
    id: e.id,
    summary: e.summary ?? '(no title)',
    start: e.start?.dateTime ?? e.start?.date ?? '',
    end: e.end?.dateTime ?? e.end?.date ?? '',
    location: e.location ?? '',
    allDay: !e.start?.dateTime,
    htmlLink: e.htmlLink ?? '',
  }))
}
