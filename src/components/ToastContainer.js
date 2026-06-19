'use client';

import { useState, useEffect } from 'react';

// Global Event Bus for Toasts
export const toastEvent = new EventTarget();

export function showToast(message, type = 'success') {
  toastEvent.dispatchEvent(new CustomEvent('toast', { detail: { message, type } }));
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const handleToast = (e) => {
      const id = Date.now();
      setToasts(t => [...t, { id, ...e.detail }]);
      setTimeout(() => {
        setToasts(t => t.filter(toast => toast.id !== id));
      }, 3000);
    };
    toastEvent.addEventListener('toast', handleToast);
    return () => toastEvent.removeEventListener('toast', handleToast);
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div style={{ position: 'fixed', bottom: '2rem', left: '2rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', zIndex: 1000, pointerEvents: 'none' }}>
      {toasts.map(t => (
        <div key={t.id} className="animate-fade-up" style={{
          background: t.type === 'error' ? 'var(--red-light)' : 'var(--surface)',
          border: `1px solid ${t.type === 'error' ? 'var(--red)' : 'var(--accent)'}`,
          color: t.type === 'error' ? 'var(--red)' : 'var(--text-main)',
          padding: '0.75rem 1.25rem',
          borderRadius: 'var(--radius-sm)',
          boxShadow: 'var(--shadow-md)',
          fontSize: '0.85rem',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}>
          {t.type === 'error' ? '⚠' : '✓'} {t.message}
        </div>
      ))}
    </div>
  );
}
