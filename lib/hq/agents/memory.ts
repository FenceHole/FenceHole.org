import { createAdminClient } from '@/lib/supabase/admin'

export interface MemoryEntry {
  id: string
  agent_id: string
  category: string
  content: string
  tags: string[]
  created_at: string
  updated_at: string
}

export interface ConversationEntry {
  id: string
  agent_id: string
  channel: string
  external_id: string | null
  role: 'user' | 'assistant'
  content: string
  media_url: string | null
  created_at: string
}

export async function recallMemory(agentId: string, limit = 20): Promise<MemoryEntry[]> {
  const sb = createAdminClient()
  const { data } = await sb
    .from('agent_memory')
    .select('*')
    .eq('agent_id', agentId)
    .order('updated_at', { ascending: false })
    .limit(limit)
  return data ?? []
}

export async function remember(agentId: string, category: string, content: string, tags: string[] = []): Promise<void> {
  const sb = createAdminClient()
  await sb.from('agent_memory').insert({ agent_id: agentId, category, content, tags })
}

export async function logMessage(
  agentId: string,
  channel: string,
  externalId: string | null,
  role: 'user' | 'assistant',
  content: string,
  mediaUrl?: string
): Promise<void> {
  const sb = createAdminClient()
  await sb.from('agent_conversations').insert({ agent_id: agentId, channel, external_id: externalId, role, content, media_url: mediaUrl ?? null })
}

export async function getConversationHistory(
  agentId: string,
  channel: string,
  externalId: string | null,
  limit = 10
): Promise<ConversationEntry[]> {
  const sb = createAdminClient()
  let q = sb
    .from('agent_conversations')
    .select('*')
    .eq('agent_id', agentId)
    .eq('channel', channel)
  // A null external id means "the one shared thread on this channel" (the web
  // chat), rather than a per-phone-number thread as WhatsApp uses.
  q = externalId === null ? q.is('external_id', null) : q.eq('external_id', externalId)
  const { data } = await q.order('created_at', { ascending: false }).limit(limit)
  return (data ?? []).reverse()
}

export async function queueDraft(
  kind: string,
  title: string,
  content: string,
  payload: Record<string, unknown> = {},
  channel?: string,
  externalRef?: string,
  mediaUrl?: string
): Promise<void> {
  const sb = createAdminClient()
  await sb.from('agent_drafts').insert({ kind, title, content, payload, channel, external_ref: externalRef, media_url: mediaUrl ?? null })
}
