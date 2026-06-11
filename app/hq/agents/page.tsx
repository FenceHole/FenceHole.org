import Link from 'next/link'
import { AgentStatusGrid } from '@/components/hq/agent-status-grid'
import { TaskQueuePanel } from '@/components/hq/task-queue-panel'
import { AGENT_SAFETY_GATES } from '@/lib/hq/agents/safety'

export default function HQAgentsPage() {
  return (
    <div className="max-w-6xl mx-auto px-6 py-10 flex flex-col gap-6">
      <div>
        <Link href="/hq" className="text-xs text-amber-400/70 hover:text-amber-300">
          ← Back to Command Center
        </Link>
        <h1 className="text-xl font-semibold text-white mt-2">Agent Crew</h1>
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
