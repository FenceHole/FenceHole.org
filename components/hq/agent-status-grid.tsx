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
