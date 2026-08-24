'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

// Step 2: the recovery link puts a session in place, so updateUser() can set
// the new password. Without that session there is nothing to update, which is
// what the "link expired" state covers.

export default function ResetConfirmPage() {
  const router = useRouter()
  const [ready, setReady] = useState<boolean | null>(null)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    const sb = createClient()
    ;(async () => {
      const { data: { session } } = await sb.auth.getSession()
      setReady(Boolean(session))
    })()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { setError('Those two passwords don’t match.') ; return }
    if (password.length < 8) { setError('Use at least 8 characters.') ; return }

    setLoading(true)
    setError('')
    const sb = createClient()
    const { error: err } = await sb.auth.updateUser({ password })
    setLoading(false)

    if (err) { setError(err.message); return }
    setDone(true)
    setTimeout(() => router.replace('/login'), 2500)
  }

  return (
    <div className="hq-bg" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div className="card" style={{ width: '100%', maxWidth: 380, padding: 28 }}>
        <h1 className="font-display" style={{ fontSize: 22, color: '#f0f0f4', marginBottom: 6 }}>
          Set a new password
        </h1>
        <div className="gold-divider" style={{ margin: '8px 0 14px', maxWidth: 120 }} />

        {ready === null && <p style={{ fontSize: 13, color: '#8888aa' }}>Checking your link…</p>}

        {ready === false && (
          <p style={{ fontSize: 14, color: '#8888aa', lineHeight: 1.6 }}>
            This link has expired or was already used.{' '}
            <Link href="/reset" style={{ color: '#f0b429', textDecoration: 'none' }}>
              Request a new one
            </Link>
            .
          </p>
        )}

        {ready && done && (
          <p style={{ fontSize: 14, color: '#4ad3a0', lineHeight: 1.6 }}>
            Password updated. Taking you to the login page…
          </p>
        )}

        {ready && !done && (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label className="label">New password</label>
              <input className="input" type="password" value={password}
                onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
            </div>
            <div>
              <label className="label">Confirm it</label>
              <input className="input" type="password" value={confirm}
                onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" required />
            </div>
            {error && <p style={{ fontSize: 13, color: '#ff6b6b' }}>{error}</p>}
            <button className="btn-primary" type="submit" disabled={loading}>
              {loading ? 'Saving…' : 'Save password'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
