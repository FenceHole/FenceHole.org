'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface MachineCommand {
  id: string
  kind: string
  payload: Record<string, unknown>
  reason: string | null
  status: string
  result: string | null
  created_at: string
}

interface AgentDraft {
  id: string
  deal_id: string | null
  kind: string
  title: string
  content: string
  status: string
  created_at: string
}

export default function ApprovalsPage() {
  const [drafts, setDrafts] = useState<AgentDraft[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'pending' | 'all'>('pending')
  const [commands, setCommands] = useState<MachineCommand[]>([])

  async function load() {
    const sb = createClient()
    let query = sb.from('agent_drafts').select('*').order('created_at', { ascending: false })
    if (filter === 'pending') query = query.eq('status', 'pending')
    const { data } = await query
    setDrafts(data ?? [])

    // Machine commands live in their own table; the table may not exist yet.
    let cq = sb.from('machine_commands').select('*').order('created_at', { ascending: false })
    if (filter === 'pending') cq = cq.eq('status', 'pending')
    const { data: cmds } = await cq
    setCommands((cmds as MachineCommand[]) ?? [])

    setLoading(false)
  }

  useEffect(() => { load() }, [filter]) // eslint-disable-line react-hooks/exhaustive-deps

  async function decide(id: string, status: 'approved' | 'declined') {
    const sb = createClient()
    await sb.from('agent_drafts').update({ status }).eq('id', id)
    load()
  }

  // Approving here is what actually lets the Mac agent pick a command up.
  async function decideCommand(id: string, status: 'approved' | 'declined') {
    const sb = createClient()
    await sb.from('machine_commands').update({ status }).eq('id', id)
    load()
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-10 flex flex-col gap-6">
      <div>
        <Link href="/hq" className="text-xs text-amber-400/70 hover:text-amber-300">
          ← Back to Command Center
        </Link>
        <h1 className="text-xl font-semibold text-white mt-2">Approvals</h1>
        <p className="text-sm text-white/50 mt-1">
          Everything the agents draft waits here for your sign-off. Approving marks it ready —
          copy the text wherever it needs to go. Nothing is ever sent automatically.
        </p>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setFilter('pending')}
          className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold border ${filter === 'pending' ? 'border-amber-400/40 bg-amber-400/10 text-amber-300' : 'border-white/10 bg-white/[0.03] text-white/40 hover:text-white/60'}`}
        >
          Pending
        </button>
        <button
          onClick={() => setFilter('all')}
          className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold border ${filter === 'all' ? 'border-amber-400/40 bg-amber-400/10 text-amber-300' : 'border-white/10 bg-white/[0.03] text-white/40 hover:text-white/60'}`}
        >
          All
        </button>
      </div>

      {commands.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-widest text-white/40">
            On your Mac
          </h2>
          {commands.map((cmd) => (
            <div key={cmd.id} className="rounded-xl border border-cyan-400/20 bg-cyan-400/[0.04] p-4 flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-white font-mono">{cmd.kind}</h3>
                <span className="shrink-0 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-300">
                  {cmd.status.toUpperCase()}
                </span>
              </div>
              {cmd.reason && <p className="text-xs text-white/60">{cmd.reason}</p>}
              <pre className="overflow-x-auto rounded-lg bg-black/40 p-2 text-[11px] text-white/60">
                {JSON.stringify(cmd.payload, null, 2)}
              </pre>
              {cmd.result && <p className="text-[11px] text-white/50">→ {cmd.result}</p>}
              {cmd.status === 'pending' && (
                <div className="flex gap-2 pt-1">
                  <button onClick={() => decideCommand(cmd.id, 'approved')} className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-1.5 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-400/20">
                    Run it
                  </button>
                  <button onClick={() => decideCommand(cmd.id, 'declined')} className="rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-1.5 text-[11px] font-semibold text-red-300 hover:bg-red-400/20">
                    Decline
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-white/40">Loading drafts…</p>
      ) : drafts.length === 0 ? (
        <p className="text-sm text-white/40">
          {filter === 'pending' ? 'Nothing waiting on you. Nice.' : 'No drafts yet.'}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {drafts.map((draft) => (
            <div key={draft.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4 flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-white">{draft.title}</h3>
                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                  draft.status === 'pending'
                    ? 'border-purple-400/30 bg-purple-400/10 text-purple-300'
                    : draft.status === 'approved'
                      ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300'
                      : 'border-red-400/30 bg-red-400/10 text-red-300'
                }`}>
                  {draft.status.toUpperCase()}
                </span>
              </div>
              <p className="text-xs text-white/70 whitespace-pre-wrap leading-relaxed">{draft.content}</p>
              {draft.status === 'pending' && (
                <div className="flex gap-2 pt-1">
                  <button onClick={() => decide(draft.id, 'approved')} className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-1.5 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-400/20">
                    Approve
                  </button>
                  <button onClick={() => decide(draft.id, 'declined')} className="rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-1.5 text-[11px] font-semibold text-red-300 hover:bg-red-400/20">
                    Decline
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
