'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface DealOffer {
  id: string
  brand_name: string
  source: string | null
  offer_text: string
  value: number | null
  status: string
  priority: string | null
  nessie_assessment: string | null
  created_at: string
}

const STATUS_STYLES: Record<string, string> = {
  new: 'border-sky-400/30 bg-sky-400/10 text-sky-300',
  assessed: 'border-purple-400/30 bg-purple-400/10 text-purple-300',
  approved: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
  declined: 'border-red-400/30 bg-red-400/10 text-red-300',
  done: 'border-white/20 bg-white/5 text-white/50',
}

export default function DealDeskPage() {
  const [offers, setOffers] = useState<DealOffer[]>([])
  const [loading, setLoading] = useState(true)
  const [brandName, setBrandName] = useState('')
  const [source, setSource] = useState('')
  const [value, setValue] = useState('')
  const [offerText, setOfferText] = useState('')
  const [saving, setSaving] = useState(false)
  const [assessing, setAssessing] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    const sb = createClient()
    const { data } = await sb.from('deal_offers').select('*').order('created_at', { ascending: false })
    setOffers(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function addOffer(e: React.FormEvent) {
    e.preventDefault()
    if (!brandName.trim() || !offerText.trim()) return
    setSaving(true)
    const sb = createClient()
    await sb.from('deal_offers').insert({
      brand_name: brandName,
      source: source || null,
      offer_text: offerText,
      value: value ? parseFloat(value) : null,
    })
    setBrandName(''); setSource(''); setValue(''); setOfferText('')
    setSaving(false)
    load()
  }

  async function askNessie(offer: DealOffer) {
    setAssessing(offer.id)
    setError(null)
    try {
      const res = await fetch('/api/hq/nessie', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task: `Assess this brand deal offer and decompose your answer into: VERDICT (TAKE/COUNTER/PASS), WHY (2-3 bullets), PRIORITY (high/medium/low), and DRAFT REPLY in Chris's voice.\n\nBrand: ${offer.brand_name}\nSource: ${offer.source ?? 'unknown'}\nOffered value: ${offer.value ? `$${offer.value}` : 'not stated'}\n\nOffer:\n${offer.offer_text}`,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Request failed')
      const sb = createClient()
      await sb.from('deal_offers').update({ nessie_assessment: data.reply, status: 'assessed' }).eq('id', offer.id)
      await sb.from('agent_drafts').insert({
        deal_id: offer.id,
        kind: 'deal-reply',
        title: `Reply to ${offer.brand_name}`,
        content: data.reply,
      })
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setAssessing(null)
    }
  }

  async function setStatus(id: string, status: string) {
    const sb = createClient()
    await sb.from('deal_offers').update({ status }).eq('id', id)
    load()
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-10 flex flex-col gap-6">
      <div>
        <Link href="/hq" className="text-xs text-amber-400/70 hover:text-amber-300">
          ← Back to Command Center
        </Link>
        <h1 className="text-xl font-semibold text-white mt-2">Deal Desk</h1>
        <p className="text-sm text-white/50 mt-1">
          Paste every brand deal offer here. Nessie assesses it, sets a priority, and drafts
          your reply — the draft lands in Approvals for your sign-off. She never sends anything.
        </p>
      </div>

      <form onSubmit={addOffer} className="rounded-xl border border-white/10 bg-white/[0.03] p-4 flex flex-col gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-white/40">Log a new offer</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input
            value={brandName}
            onChange={(e) => setBrandName(e.target.value)}
            placeholder="Brand name *"
            required
            className="rounded-lg border border-white/10 bg-white/[0.03] p-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-amber-400/40"
          />
          <input
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="Source (email, IG DM, TikTok…)"
            className="rounded-lg border border-white/10 bg-white/[0.03] p-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-amber-400/40"
          />
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Offered $ (if stated)"
            type="number"
            className="rounded-lg border border-white/10 bg-white/[0.03] p-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-amber-400/40"
          />
        </div>
        <textarea
          value={offerText}
          onChange={(e) => setOfferText(e.target.value)}
          placeholder="Paste the full offer text / email / DM here *"
          rows={4}
          required
          className="rounded-lg border border-white/10 bg-white/[0.03] p-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-amber-400/40"
        />
        <button
          type="submit"
          disabled={saving}
          className="self-start rounded-lg border border-amber-400/30 bg-amber-400/10 px-4 py-2 text-xs font-semibold text-amber-300 hover:bg-amber-400/20 disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Add to Deal Desk'}
        </button>
      </form>

      {error && (
        <div className="rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-300">{error}</div>
      )}

      {loading ? (
        <p className="text-sm text-white/40">Loading offers…</p>
      ) : offers.length === 0 ? (
        <p className="text-sm text-white/40">No offers logged yet. Paste your first one above.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {offers.map((offer) => (
            <div key={offer.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4 flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-white">
                  {offer.brand_name}
                  {offer.value ? <span className="text-emerald-300/80 font-normal"> · ${offer.value}</span> : null}
                  {offer.source ? <span className="text-white/30 font-normal"> · via {offer.source}</span> : null}
                </h3>
                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLES[offer.status] ?? STATUS_STYLES.new}`}>
                  {offer.status.toUpperCase()}
                </span>
              </div>
              <p className="text-xs text-white/50 whitespace-pre-wrap leading-relaxed line-clamp-4">{offer.offer_text}</p>
              {offer.nessie_assessment && (
                <div className="rounded-lg border border-amber-400/20 bg-amber-400/5 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-300 mb-1">Nessie's take</p>
                  <p className="text-xs text-white/70 whitespace-pre-wrap leading-relaxed">{offer.nessie_assessment}</p>
                </div>
              )}
              <div className="flex flex-wrap gap-2 pt-1">
                {!offer.nessie_assessment && (
                  <button
                    onClick={() => askNessie(offer)}
                    disabled={assessing === offer.id}
                    className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-1.5 text-[11px] font-semibold text-amber-300 hover:bg-amber-400/20 disabled:opacity-40"
                  >
                    {assessing === offer.id ? 'Nessie is thinking…' : 'Ask Nessie'}
                  </button>
                )}
                {offer.status !== 'approved' && (
                  <button onClick={() => setStatus(offer.id, 'approved')} className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-1.5 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-400/20">
                    Take it
                  </button>
                )}
                {offer.status !== 'declined' && (
                  <button onClick={() => setStatus(offer.id, 'declined')} className="rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-1.5 text-[11px] font-semibold text-red-300 hover:bg-red-400/20">
                    Pass
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
