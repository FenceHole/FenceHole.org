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
