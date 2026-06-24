'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // If already authenticated, go home
  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('mt_auth') === 'yes') {
      router.replace('/');
    }
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        localStorage.setItem('mt_auth', 'yes');
        router.replace('/');
      } else {
        setError('Wrong password. Try again.');
      }
    } catch {
      setError('Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg)',
      padding: '1.5rem',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '360px',
        background: 'var(--card-bg)',
        borderRadius: '20px',
        padding: '2.5rem 2rem',
        boxShadow: 'var(--shadow-md)',
        border: '1px solid var(--border)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            width: '52px', height: '52px', borderRadius: '14px',
            background: 'var(--accent-light)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 1rem',
          }}>
            <Lock size={22} color="var(--accent)" />
          </div>
          <h1 style={{
            fontFamily: "'Instrument Serif', serif",
            fontSize: '1.8rem', fontWeight: 400,
            letterSpacing: '-0.5px', margin: 0,
          }}>Osama's Kitchen</h1>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.88rem', marginTop: '0.4rem' }}>Enter password to continue</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ position: 'relative', marginBottom: '1rem' }}>
            <input
              type={showPw ? 'text' : 'password'}
              className="form-input"
              placeholder="Password"
              value={password}
              onChange={e => { setPassword(e.target.value); setError(''); }}
              style={{ paddingRight: '2.8rem', width: '100%', boxSizing: 'border-box' }}
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShowPw(s => !s)}
              style={{
                position: 'absolute', right: '0.75rem', top: '50%',
                transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-dim)', display: 'flex', padding: '4px',
              }}
            >
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {error && (
            <div style={{
              background: '#fff0f0', border: '1px solid #fca5a5',
              borderRadius: '8px', padding: '0.6rem 0.9rem',
              fontSize: '0.84rem', color: '#dc2626',
              marginBottom: '1rem',
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading || !password}
            style={{ width: '100%', padding: '0.85rem', justifyContent: 'center' }}
          >
            {loading ? 'Checking…' : 'Enter'}
          </button>
        </form>

        <p style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '1.5rem' }}>
          Browser will remember you automatically.
        </p>
      </div>
    </div>
  );
}
