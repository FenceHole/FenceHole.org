'use client'
import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

// Step 1 of the reset flow: ask Supabase to email a recovery link.
// The link lands on /reset/confirm, where the new password is set.

export default function ResetPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const sb = createClient()
    const { error: err } = await sb.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      { redirectTo: `${window.location.origin}/reset/confirm` }
    )

    setLoading(false)
    // Don't reveal whether an address has an account — say the same thing
    // either way, and let the inbox be the source of truth.
    if (err && !/rate/i.test(err.message)) setSent(true)
    else if (err) setError(err.message)
    else setSent(true)
  }

  return (
    <div className="hq-bg" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div className="card" style={{ width: '100%', maxWidth: 380, padding: 28 }}>
        <h1 className="font-display" style={{ fontSize: 22, color: '#f0f0f4', marginBottom: 6 }}>
          Reset your password
        </h1>
        <div className="gold-divider" style={{ margin: '8px 0 14px', maxWidth: 120 }} />

        {sent ? (
          <>
            <p style={{ fontSize: 14, color: '#8888aa', lineHeight: 1.6 }}>
              If there&apos;s an account for <span style={{ color: '#f0b429' }}>{email}</span>, a reset
              link is on its way. Open it on this device and you&apos;ll be asked for a new password.
            </p>
            <p style={{ fontSize: 12, color: '#5a5a72', marginTop: 12, lineHeight: 1.6 }}>
              Nothing after a few minutes? Check spam — and if it still hasn&apos;t arrived, the
              account&apos;s password can be set directly from the Supabase dashboard.
            </p>
          </>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p style={{ fontSize: 13, color: '#8888aa', lineHeight: 1.6 }}>
              Enter your email and we&apos;ll send a link to set a new one.
            </p>
            <div>
              <label className="label">Email</label>
              <input
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@fencehole.com"
                required
              />
            </div>
            {error && <p style={{ fontSize: 13, color: '#ff6b6b' }}>{error}</p>}
            <button className="btn-primary" type="submit" disabled={loading}>
              {loading ? 'Sending…' : 'Send reset link'}
            </button>
          </form>
        )}

        <p style={{ marginTop: 18, fontSize: 13 }}>
          <Link href="/login" style={{ color: '#8888aa', textDecoration: 'none' }}>
            ← Back to login
          </Link>
        </p>
      </div>
    </div>
  )
}
