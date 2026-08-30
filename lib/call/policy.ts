// Who is allowed to show their face.
//
// This is a property of the account, resolved on the server and handed to the
// client as a prop — not a checkbox in the call UI. That matters: a setting
// the user has to remember to switch on is a setting that will eventually be
// forgotten, and the cost of forgetting here is someone's face on a call they
// were promised it wouldn't be on.
//
// Stored as reserved rows in agent_memory so this needs no migration.

import { createAdminClient } from '@/lib/supabase/admin'
import type { CameraMode } from './camera'

const CATEGORY = '__camera_policy'
const AGENT_ID = 'nessie-chief-of-staff'

export interface CameraPolicy {
  /** Modes this account may use. Without 'clear', the face can never show. */
  allowed: CameraMode[]
  /** What the call opens with. */
  initial: CameraMode
  /** True when the account is permanently barred from clear video. */
  faceLocked: boolean
}

const LOCKED: CameraPolicy = {
  allowed: ['blur', 'avatar', 'off'],
  initial: 'avatar',
  faceLocked: true,
}

// Default-deny: a call opens protected even for accounts that may show their
// face. Going clear is a deliberate click, never the default state.
const OPEN: CameraPolicy = {
  allowed: ['blur', 'avatar', 'off', 'clear'],
  initial: 'blur',
  faceLocked: false,
}

export async function getCameraPolicy(userId: string): Promise<CameraPolicy> {
  try {
    const sb = createAdminClient()
    const { data } = await sb
      .from('agent_memory')
      .select('content')
      .eq('agent_id', AGENT_ID)
      .eq('category', CATEGORY)
      .like('content', `${userId}=%`)
      .limit(1)

    const row = data?.[0]
    if (row && String(row.content).split('=')[1]?.trim() === 'locked') return LOCKED
  } catch {
    // If the lookup fails we cannot prove this account is unlocked, so we do
    // not grant clear video. Erring here costs a blurred call; erring the
    // other way costs a broken promise.
    return LOCKED
  }
  return OPEN
}

/**
 * Permanently bar an account from clear video. There is deliberately no
 * unlock function: reversing this should require a direct, deliberate database
 * change, not a button that can be hit by accident or on someone else's behalf.
 */
export async function lockFace(userId: string): Promise<void> {
  const sb = createAdminClient()
  const { data } = await sb
    .from('agent_memory')
    .select('id')
    .eq('agent_id', AGENT_ID)
    .eq('category', CATEGORY)
    .like('content', `${userId}=%`)
    .limit(1)

  if (data?.[0]) return
  await sb.from('agent_memory').insert({
    agent_id: AGENT_ID,
    category: CATEGORY,
    content: `${userId}=locked`,
    tags: ['policy'],
  })
}
