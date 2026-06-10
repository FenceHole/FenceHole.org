import Link from 'next/link'

const SAFETY_RULES = [
  'No external actions without Chris approval',
  'No email, payments, or spending',
  'No file deletion or production deploys',
  'No veterinary diagnosis or medical advice',
  'No cloud sync of private notes or secrets',
  'Local-first and cheap by default',
]

const MODULES = [
  { id: 'command-center', name: 'Command Center', desc: 'Mission overview and daily operating picture.', href: '/hq', live: true },
  { id: 'brain', name: 'Brain Explorer', desc: 'Browse and search second-brain memory.', href: '/hq', live: false },
  { id: 'obsidian', name: 'Obsidian Second Brain', desc: 'Read-only vault index — the memory source of truth.', href: '/hq', live: false },
  { id: 'ai-router', name: 'AI Router', desc: 'Routes tasks to the cheapest safe model (Qwen/Claude).', href: '/hq/nessie', live: true },
  { id: 'nessie', name: 'Nessie — Chief of Staff', desc: 'Your Donna. Lead agent: assesses, plans, drafts, decides.', href: '/hq/nessie', live: true },
  { id: 'agents', name: 'Agent Crew', desc: '8 sandboxed agents — suggest and draft only.', href: '/hq/agents', live: true },
  { id: 'cases', name: 'Pet Care Cases', desc: 'Organize care cases toward free pet healthcare.', href: '/hq', live: false },
  { id: 'partners', name: 'Vet Partner Network', desc: 'Track potential vet partners. Drafts only.', href: '/hq', live: false },
  { id: 'deals', name: 'Deal Desk', desc: 'Brand deal offers in, Nessie verdicts + drafted replies out.', href: '/hq/deals', live: true },
  { id: 'approvals', name: 'Approvals', desc: 'Every agent draft waits here for your sign-off.', href: '/hq/approvals', live: true },
  { id: 'revenue', name: 'Revenue Engine', desc: 'Revenue signals across the brand portfolio.', href: '/hq', live: false },
  { id: 'safety', name: 'Safety Rules', desc: 'Hard rules every agent and tool obeys.', href: '/hq', live: false },
  { id: 'gateway', name: 'Local Agent Gateway', desc: 'Local action gateway — disabled by default.', href: '/hq', live: false },
  { id: 'openclaw', name: 'OpenClaw Gateway', desc: 'Safe local actions, permission-gated. Offline.', href: '/hq', live: false },
  { id: 'archive', name: 'Third Place Archive', desc: 'Long-term archive of mission knowledge.', href: '/hq', live: false },
  { id: 'costs', name: 'Token / Cost Monitor', desc: 'Watch token spend and keep routing cheap.', href: '/hq', live: false },
]

export default function HQPage() {
  return (
    <div>
      <div className="border-b border-amber-400/20 bg-amber-400/5 px-6 py-2">
        <p className="text-[11px] text-amber-300/90 text-center font-medium tracking-wide">
          SAFETY MODE — All agents sandboxed. No external actions, email, spending, or deploys without Chris approval.
        </p>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="mb-8">
          <p className="text-xs font-semibold tracking-[0.2em] text-amber-400/80 uppercase mb-2">FenceHole HQ</p>
          <h1 className="text-3xl font-bold">Command Center</h1>
          <p className="text-white/50 mt-2 max-w-2xl text-sm leading-relaxed">
            Private, local-first operating dashboard for the mission: bringing free pet healthcare to life.
            Obsidian is memory. Hermes coordinates. The router keeps it cheap. Humans approve anything external.
          </p>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 mb-8">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-white/40 mb-3">Hard Safety Rules</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {SAFETY_RULES.map((rule) => (
              <div key={rule} className="flex items-start gap-2 text-[12px] text-white/60">
                <span className="text-amber-400/70 mt-0.5">●</span>
                {rule}
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {MODULES.map((mod) => (
            <Link
              key={mod.id}
              href={mod.href}
              className="group rounded-xl border border-white/10 bg-white/[0.03] p-4 hover:border-amber-400/40 hover:bg-white/[0.05] transition-colors flex flex-col gap-2"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">{mod.name}</h3>
                <span
                  className={`rounded-full px-2 py-0.5 text-[9px] font-bold tracking-wide ${
                    mod.live
                      ? 'border border-emerald-400/30 bg-emerald-400/10 text-emerald-300'
                      : 'border border-white/10 bg-white/5 text-white/30'
                  }`}
                >
                  {mod.live ? 'LIVE' : 'PLANNED'}
                </span>
              </div>
              <p className="text-[12px] text-white/50 leading-relaxed">{mod.desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
