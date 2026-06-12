import type { SafetyGate } from './types'

// Agent-specific safety gates. Every agent in the registry is bound by all
// of these regardless of its role — none of them can be bypassed by an agent.
export const AGENT_SAFETY_GATES: SafetyGate[] = [
  {
    id: 'approval-required-to-send',
    label: 'Approval Required to Send',
    description: 'Agents can chat directly with Chris (WhatsApp, Hub) and draft outward-facing replies, listings, and posts — but anything that leaves the building waits in /hq/approvals for his sign-off.',
    blocksAction: false,
  },
  {
    id: 'no-payments',
    label: 'No Payments',
    description: 'Agents cannot spend money, process payments, or manage billing without Chris explicitly saying go ahead, every time.',
    blocksAction: true,
  },
  {
    id: 'no-email-yet',
    label: 'Email — Not Yet Connected',
    description: 'No email integration is wired up yet. Until it is, agents cannot read or send email.',
    blocksAction: true,
  },
  {
    id: 'no-cloud-sync',
    label: 'No Third-Party Cloud Sync',
    description: 'Agents only persist memory to FenceHole\'s own Supabase store — no syncing to third-party cloud services.',
    blocksAction: true,
  },
  {
    id: 'no-obsidian-writes',
    label: 'No Obsidian Writes',
    description: 'Agents may read indexed notes only — no writes to the Obsidian vault.',
    blocksAction: true,
  },
  {
    id: 'no-openclaw-actions',
    label: 'No OpenClaw Actions',
    description: 'Agents cannot trigger local gateway actions until permissions exist.',
    blocksAction: true,
  },
  {
    id: 'no-vet-diagnosis',
    label: 'No Veterinary Diagnosis',
    description: 'Agents cannot give medical or diagnostic advice about animals.',
    blocksAction: true,
  },
  {
    id: 'draft-only',
    label: 'Plan, Draft, Chat & Suggest',
    description: 'Agents may plan, draft, summarize, chat directly with Chris, and route — execution beyond that requires an approved draft.',
    blocksAction: false,
  },
]

// Returns whether agents are currently allowed to send/post/spend without a
// human approval step. Stays false until Chris explicitly flips this on.
export function isActionAllowed(): boolean {
  return false
}
