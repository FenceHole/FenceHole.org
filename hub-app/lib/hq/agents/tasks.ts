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
