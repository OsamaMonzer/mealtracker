'use client'

import { useState } from 'react'
import { createClient } from '../../utils/supabase/client'
import { useRouter } from 'next/navigation'
import { ArrowRight, Lock, Mail, UtensilsCrossed, AlertCircle } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    if (isSignUp) {
      const { error, data } = await supabase.auth.signUp({ email, password })
      if (error) setError(error.message)
      else if (data.session == null) {
         setSuccess('Registration successful! Please check your email to verify your account.')
      } else {
         router.push('/onboarding')
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
      else {
        router.push('/')
        router.refresh()
      }
    }
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg)',
      padding: '1.5rem',
      position: 'relative'
    }}>
      <div className="card animate-fade-up" style={{
        maxWidth: '420px',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: '2rem',
        padding: '2.5rem 2rem',
        boxShadow: 'var(--shadow-lg)'
      }}>
        
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', textAlign: 'center' }}>
          <div style={{ background: 'var(--accent-light)', padding: '1rem', borderRadius: '16px' }}>
            <UtensilsCrossed size={32} color="var(--accent)" strokeWidth={1.5} />
          </div>
          <div>
            <h1 className="page-title" style={{ fontSize: '2.4rem', marginBottom: '0.2rem' }}>
              Welcome back
            </h1>
            <p className="page-sub" style={{ margin: '0 auto' }}>
              {isSignUp ? 'Create a secure account to sync your data' : 'Enter your credentials to access your dashboard'}
            </p>
          </div>
        </div>

        {error && (
          <div style={{ background: 'var(--red-light)', border: '1px solid #fca5a5', padding: '1rem', borderRadius: '12px', display: 'flex', alignItems: 'flex-start', gap: '0.75rem', color: 'var(--red)', fontSize: '0.9rem' }}>
            <AlertCircle size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div style={{ background: 'var(--accent-light)', border: '1px solid var(--accent)', padding: '1rem', borderRadius: '12px', color: 'var(--accent-hover)', fontSize: '0.9rem', textAlign: 'center' }}>
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="form-group">
            <label>Email Address</label>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }}>
                <Mail size={18} />
              </div>
              <input 
                type="email" 
                className="form-input"
                style={{ paddingLeft: '3rem' }}
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
              />
            </div>
          </div>

          <div className="form-group">
            <label>Password</label>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }}>
                <Lock size={18} />
              </div>
              <input 
                type="password" 
                className="form-input"
                style={{ paddingLeft: '3rem' }}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="••••••••"
              />
            </div>
          </div>

          <button 
            type="submit" 
            className="btn btn-primary"
            disabled={loading}
            style={{ marginTop: '0.5rem', width: '100%', padding: '0.85rem', justifyContent: 'center' }}
          >
            {loading ? 'Processing...' : (isSignUp ? 'Create Account' : 'Sign In')}
            {!loading && <ArrowRight size={18} />}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '-0.5rem' }}>
          <button 
            onClick={() => { setIsSignUp(!isSignUp); setError(''); setSuccess('') }}
            style={{ background: 'none', border: 'none', color: 'var(--text-sub)', fontSize: '0.9rem', cursor: 'pointer', outline: 'none', textDecoration: 'underline' }}
          >
            {isSignUp ? 'Already have an account? Log in' : 'Need an account? Sign up'}
          </button>
        </div>
      </div>
    </div>
  )
}
