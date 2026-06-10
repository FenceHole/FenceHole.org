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
