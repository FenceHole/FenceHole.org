#!/usr/bin/env bash
set -e

echo "Building FenceHole HQ — Safe Agent System MVP scaffold..."

mkdir -p lib/hq/agents
mkdir -p components/hq
mkdir -p app/hq/agents
mkdir -p data/hq

# ---------------------------------------------------------------------------
# lib/hq/agents/types.ts
# ---------------------------------------------------------------------------
cat > lib/hq/agents/types.ts << 'EOF'
export type AgentStatus = 'sandboxed' | 'inactive' | 'static'

export type AgentCapability =
  | 'plan'
  | 'summarize'
  | 'route'
  | 'draft'
  | 'decompose'
  | 'review-memory'
  | 'suggest'

export interface Agent {
  id: string
  name: string
  role: string
  description: string
  status: AgentStatus
  capabilities: AgentCapability[]
  canExecuteExternalActions: false
}

export type TaskState = 'queued' | 'in_review' | 'blocked' | 'completed'

export interface AgentTask {
  id: string
  title: string
  agentId: string
  state: TaskState
  summary: string
  requiresApproval: boolean
  createdAt: string
}

export interface SafetyGate {
  id: string
  label: string
  description: string
  blocksAction: boolean
}
EOF

# ---------------------------------------------------------------------------
# lib/hq/agents/safety.ts
# ---------------------------------------------------------------------------
cat > lib/hq/agents/safety.ts << 'EOF'
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
EOF

# ---------------------------------------------------------------------------
# lib/hq/agents/registry.ts
# ---------------------------------------------------------------------------
cat > lib/hq/agents/registry.ts << 'EOF'
import type { Agent } from './types'

export const AGENT_REGISTRY: Agent[] = [
  {
    id: 'hermes-coordinator',
    name: 'Hermes Coordinator',
    role: 'Agent Coordinator',
    description: 'Plans multi-step work and coordinates task packets across other agents.',
    status: 'sandboxed',
    capabilities: ['plan', 'route', 'decompose'],
    canExecuteExternalActions: false,
  },
  {
    id: 'brain-librarian',
    name: 'Brain Librarian',
    role: 'Memory & Knowledge',
    description: 'Indexes and summarizes notes from the second brain for quick recall.',
    status: 'sandboxed',
    capabilities: ['summarize', 'review-memory', 'suggest'],
    canExecuteExternalActions: false,
  },
  {
    id: 'safety-officer',
    name: 'Safety Officer',
    role: 'Safety & Review',
    description: 'Checks tasks against hard safety rules before anything moves forward.',
    status: 'sandboxed',
    capabilities: ['review-memory', 'suggest'],
    canExecuteExternalActions: false,
  },
  {
    id: 'outreach-drafter',
    name: 'Outreach Drafter',
    role: 'Drafting',
    description: 'Drafts outreach messages for partners, sponsors, and media — for review only.',
    status: 'sandboxed',
    capabilities: ['draft', 'suggest'],
    canExecuteExternalActions: false,
  },
  {
    id: 'care-case-organizer',
    name: 'Care Case Organizer',
    role: 'Case Management',
    description: 'Organizes pet care cases and surfaces what needs attention next.',
    status: 'sandboxed',
    capabilities: ['summarize', 'suggest', 'decompose'],
    canExecuteExternalActions: false,
  },
  {
    id: 'revenue-analyst',
    name: 'Revenue Analyst',
    role: 'Analysis',
    description: 'Summarizes revenue and fundraising signals from local data only.',
    status: 'sandboxed',
    capabilities: ['summarize', 'suggest'],
    canExecuteExternalActions: false,
  },
  {
    id: 'local-gateway-monitor',
    name: 'Local Gateway Monitor',
    role: 'Monitoring',
    description: 'Watches local gateway/OpenClaw status — read-only, no actions triggered.',
    status: 'sandboxed',
    capabilities: ['review-memory', 'suggest'],
    canExecuteExternalActions: false,
  },
  {
    id: 'cost-watcher',
    name: 'Cost Watcher',
    role: 'Token & Cost Monitoring',
    description: 'Tracks token and API cost estimates to keep routing cheap by default.',
    status: 'sandboxed',
    capabilities: ['summarize', 'suggest'],
    canExecuteExternalActions: false,
  },
]
EOF

# ---------------------------------------------------------------------------
# lib/hq/agents/tasks.ts
# ---------------------------------------------------------------------------
cat > lib/hq/agents/tasks.ts << 'EOF'
import type { AgentTask } from './types'
import agentTasksData from '@/data/hq/agent-tasks.json'

export function getAgentTasks(): AgentTask[] {
  return agentTasksData as AgentTask[]
}

export function getTasksForAgent(agentId: string): AgentTask[] {
  return getAgentTasks().filter((task) => task.agentId === agentId)
}

export function getTaskCountsByState() {
  const tasks = getAgentTasks()
  return {
    queued: tasks.filter((t) => t.state === 'queued').length,
    in_review: tasks.filter((t) => t.state === 'in_review').length,
    blocked: tasks.filter((t) => t.state === 'blocked').length,
    completed: tasks.filter((t) => t.state === 'completed').length,
  }
}
EOF

# ---------------------------------------------------------------------------
# data/hq/agent-tasks.json
# ---------------------------------------------------------------------------
cat > data/hq/agent-tasks.json << 'EOF'
[
  {
    "id": "task-001",
    "title": "Summarize this week's Brain Explorer notes",
    "agentId": "brain-librarian",
    "state": "queued",
    "summary": "Draft a short recap of new notes added to the second brain this week.",
    "requiresApproval": false,
    "createdAt": "2026-06-01T09:00:00Z"
  },
  {
    "id": "task-002",
    "title": "Draft outreach note for a potential vet partner",
    "agentId": "outreach-drafter",
    "state": "in_review",
    "summary": "Prepare a draft message for Chris to review before any contact is made.",
    "requiresApproval": true,
    "createdAt": "2026-06-02T14:30:00Z"
  },
  {
    "id": "task-003",
    "title": "Flag a task that requests external contact",
    "agentId": "safety-officer",
    "state": "blocked",
    "summary": "A drafted task attempted to reference direct contact — held for Chris approval.",
    "requiresApproval": true,
    "createdAt": "2026-06-03T11:15:00Z"
  },
  {
    "id": "task-004",
    "title": "Summarize current token usage trend",
    "agentId": "cost-watcher",
    "state": "completed",
    "summary": "Weekly cost summary generated from local usage logs only.",
    "requiresApproval": false,
    "createdAt": "2026-06-04T08:00:00Z"
  },
  {
    "id": "task-005",
    "title": "Organize open pet care cases by urgency",
    "agentId": "care-case-organizer",
    "state": "queued",
    "summary": "Sort current local case notes into a simple priority list for review.",
    "requiresApproval": false,
    "createdAt": "2026-06-05T16:45:00Z"
  }
]
EOF

# ---------------------------------------------------------------------------
# components/hq/agent-status-grid.tsx
# ---------------------------------------------------------------------------
cat > components/hq/agent-status-grid.tsx << 'EOF'
import { AGENT_REGISTRY } from '@/lib/hq/agents/registry'
import { getTasksForAgent } from '@/lib/hq/agents/tasks'

const STATUS_LABEL: Record<string, string> = {
  sandboxed: 'SANDBOXED',
  inactive: 'INACTIVE',
  static: 'STATIC',
}

export function AgentStatusGrid() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {AGENT_REGISTRY.map((agent) => {
        const taskCount = getTasksForAgent(agent.id).length
        return (
          <div
            key={agent.id}
            className="rounded-xl border border-white/10 bg-white/[0.03] p-4 flex flex-col gap-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-white">{agent.name}</h3>
                <p className="text-xs text-white/50">{agent.role}</p>
              </div>
              <span className="shrink-0 rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] font-bold tracking-wide text-amber-300">
                {STATUS_LABEL[agent.status] ?? 'SANDBOXED'}
              </span>
            </div>
            <p className="text-xs text-white/60 leading-relaxed">{agent.description}</p>
            <div className="flex flex-wrap gap-1.5">
              {agent.capabilities.map((cap) => (
                <span
                  key={cap}
                  className="rounded-md bg-white/5 px-2 py-0.5 text-[10px] text-white/50"
                >
                  {cap.replace('-', ' ')}
                </span>
              ))}
            </div>
            <div className="mt-auto flex items-center justify-between border-t border-white/5 pt-2 text-[11px] text-white/40">
              <span>{taskCount} queued task{taskCount === 1 ? '' : 's'}</span>
              <span className="text-white/30">No external actions</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
EOF

# ---------------------------------------------------------------------------
# components/hq/task-queue-panel.tsx
# ---------------------------------------------------------------------------
cat > components/hq/task-queue-panel.tsx << 'EOF'
import { AGENT_REGISTRY } from '@/lib/hq/agents/registry'
import { getAgentTasks, getTaskCountsByState } from '@/lib/hq/agents/tasks'

const STATE_STYLES: Record<string, string> = {
  queued: 'border-sky-400/30 bg-sky-400/10 text-sky-300',
  in_review: 'border-purple-400/30 bg-purple-400/10 text-purple-300',
  blocked: 'border-red-400/30 bg-red-400/10 text-red-300',
  completed: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
}

const STATE_LABEL: Record<string, string> = {
  queued: 'Queued',
  in_review: 'In Review',
  blocked: 'Blocked',
  completed: 'Completed',
}

export function TaskQueuePanel() {
  const tasks = getAgentTasks()
  const counts = getTaskCountsByState()
  const agentNameById = Object.fromEntries(AGENT_REGISTRY.map((a) => [a.id, a.name]))

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-white">Task Queue</h2>
        <div className="flex gap-2 text-[11px]">
          {Object.entries(counts).map(([state, count]) => (
            <span
              key={state}
              className={`rounded-full border px-2 py-0.5 font-medium ${STATE_STYLES[state]}`}
            >
              {STATE_LABEL[state]}: {count}
            </span>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {tasks.map((task) => (
          <div
            key={task.id}
            className="rounded-lg border border-white/5 bg-white/[0.02] p-3 flex flex-col gap-1"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-medium text-white">{task.title}</h3>
              <span
                className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${STATE_STYLES[task.state]}`}
              >
                {STATE_LABEL[task.state]}
              </span>
            </div>
            <p className="text-[11px] text-white/50">{task.summary}</p>
            <div className="flex items-center gap-3 text-[10px] text-white/35">
              <span>Agent: {agentNameById[task.agentId] ?? task.agentId}</span>
              {task.requiresApproval && (
                <span className="text-amber-300/70">Requires Chris approval</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
EOF

# ---------------------------------------------------------------------------
# app/hq/agents/page.tsx
# ---------------------------------------------------------------------------
cat > app/hq/agents/page.tsx << 'EOF'
import { AgentStatusGrid } from '@/components/hq/agent-status-grid'
import { TaskQueuePanel } from '@/components/hq/task-queue-panel'
import { AGENT_SAFETY_GATES } from '@/lib/hq/agents/safety'

export default function HQAgentsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Agent Crew</h1>
        <p className="text-sm text-white/50 mt-1">
          Every agent below is sandboxed and inactive by design. They can plan, draft,
          summarize, and suggest — never execute external actions.
        </p>
      </div>

      <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-amber-300 mb-2">
          Safety Gates Active
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {AGENT_SAFETY_GATES.map((gate) => (
            <div key={gate.id} className="text-[11px] text-white/60">
              <span className="font-medium text-white/80">{gate.label}:</span>{' '}
              {gate.description}
            </div>
          ))}
        </div>
      </div>

      <AgentStatusGrid />
      <TaskQueuePanel />
    </div>
  )
}
EOF

echo "Files created. Committing and pushing to main..."
git add lib/hq/agents components/hq/agent-status-grid.tsx components/hq/task-queue-panel.tsx app/hq/agents data/hq/agent-tasks.json
git commit -m "Add FenceHole HQ safe agent system MVP (sandboxed, no external actions)"
git push origin main

echo ""
echo "Done. Visit /hq/agents once Vercel finishes deploying."
