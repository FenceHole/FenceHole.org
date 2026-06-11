import type { SafetyGate } from './types'

// Agent-specific safety gates. Every agent in the registry is bound by all
// of these regardless of its role — none of them can be bypassed by an agent.
export const AGENT_SAFETY_GATES: SafetyGate[] = [
  {
    id: 'no-external-actions',
    label: 'No External Actions',
    description: 'Agents cannot send messages, make calls, or act outside this app.',
    blocksAction: true,
  },
  {
    id: 'no-email',
    label: 'No Email',
    description: 'Agents cannot send or trigger email of any kind.',
    blocksAction: true,
  },
  {
    id: 'no-payments',
    label: 'No Payments',
    description: 'Agents cannot spend money, process payments, or manage billing.',
    blocksAction: true,
  },
  {
    id: 'no-cloud-sync',
    label: 'No Cloud Sync',
    description: 'Agents cannot sync data, notes, or context to external/cloud services.',
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
    label: 'Draft & Suggest Only',
    description: 'Agents may plan, draft, summarize, and route — never execute.',
    blocksAction: false,
  },
]

// Hard-locked for the MVP: every gated action is blocked until Chris
// explicitly reviews and enables agent permissions in a future update.
export function isActionAllowed(): boolean {
  return false
}
