'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Lock } from 'lucide-react'
import { createClient } from '../../utils/supabase/client'
import { showToast } from '../../components/ToastContainer'

// Reached from the password-reset email (via /auth/callback, which signs the user in).
export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (password.length < 8) return setError('Use at least 8 characters.')
    if (password !== confirm) return setError("Passwords don't match.")
    setLoading(true)
    const { error } = await createClient().auth.updateUser({ password })
    setLoading(false)
    if (error) return setError(error.message)
    showToast('Password updated ✓')
    router.push('/')
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: '1.5rem' }}>
      <div className="card animate-fade-up" style={{ maxWidth: '420px', width: '100%', display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '2.5rem 2rem' }}>
        <div style={{ textAlign: 'center' }}>
          <h1 className="page-title" style={{ fontSize: '2.2rem', marginBottom: '0.2rem' }}>New password</h1>
          <p className="page-sub" style={{ margin: '0 auto' }}>Choose a new password for your account.</p>
        </div>
        {error && <div style={{ background: 'var(--red-light)', border: '1px solid #fca5a5', padding: '0.85rem', borderRadius: '12px', color: 'var(--red)', fontSize: '0.9rem' }}>{error}</div>}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {[['New password', password, setPassword], ['Confirm password', confirm, setConfirm]].map(([label, value, set]) => (
            <div className="form-group" key={label}>
              <label>{label}</label>
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }}><Lock size={18} /></div>
                <input type="password" className="form-input" style={{ paddingLeft: '3rem' }} value={value} onChange={e => set(e.target.value)} required autoComplete="new-password" />
              </div>
            </div>
          ))}
          <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%', padding: '0.85rem', justifyContent: 'center' }}>
            {loading ? 'Saving…' : 'Save password'}
          </button>
        </form>
      </div>
    </div>
  )
}
