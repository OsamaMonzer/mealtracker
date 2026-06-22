'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { ArrowLeft, Scale, TrendingDown, TrendingUp, Minus, Trash2, Camera, X, ImageIcon, Bell } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { showToast } from '../../components/ToastContainer';
import { useSupabaseRealtime } from '../../hooks/useSupabaseRealtime';

// ── Photo Preview Modal ────────────────────────────────────────────────────
function PhotoModal({ log, onClose }) {
  if (!log) return null;
  const label = new Date(log.date + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.85)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: '20px',
          maxWidth: '480px',
          width: '100%',
          overflow: 'hidden',
          boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
        }}
      >
        <div style={{ position: 'relative' }}>
          <img
            src={log.photo_url}
            alt={`Progress photo ${label}`}
            style={{ width: '100%', display: 'block', maxHeight: '70vh', objectFit: 'cover' }}
          />
          <button
            onClick={onClose}
            style={{
              position: 'absolute', top: '0.75rem', right: '0.75rem',
              background: 'rgba(0,0,0,0.5)', border: 'none',
              borderRadius: '50%', width: '36px', height: '36px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: '#fff',
            }}
          >
            <X size={18} />
          </button>
        </div>
        <div style={{ padding: '1rem 1.25rem' }}>
          <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: '1.2rem', color: '#111' }}>{label}</div>
          <div style={{ fontSize: '0.85rem', color: '#999', marginTop: '0.2rem' }}>{log.weight_kg} kg</div>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function WeightTracking() {
  const [logs, setLogs]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [photoLog, setPhotoLog] = useState(null); // log selected for photo preview
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const goalWeight = 75;

  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    weight_kg: '',
    photoFile: null,
    photoPreview: null,
  });

  // ── Friday banner logic ──────────────────────────────────────────────────
  const todayStr = new Date().toISOString().split('T')[0];
  const isFriday = new Date().getDay() === 5;
  const todayLog = logs.find(l => l.date === todayStr);
  const showFridayBanner = isFriday && (!todayLog || !todayLog.photo_url);

  useEffect(() => { fetchLogs(); }, []);
  useSupabaseRealtime(['weight_logs'], () => fetchLogs());

  async function fetchLogs() {
    try { setLogs(await (await fetch('/api/weight')).json()); }
    catch (e) { console.error(e); } finally { setLoading(false); }
  }

  function handlePhotoSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setForm(f => ({
      ...f,
      photoFile: file,
      photoPreview: URL.createObjectURL(file),
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.weight_kg) return;
    setUploading(true);

    let photo_url = null;

    // Upload photo first if selected
    if (form.photoFile) {
      const fd = new FormData();
      fd.append('file', form.photoFile);
      fd.append('date', form.date);
      const res = await fetch('/api/weight/photo', { method: 'POST', body: fd });
      const json = await res.json();
      if (json.url) photo_url = json.url;
      else showToast('Photo upload failed — weight saved without photo', 'error');
    }

    // Save weight + photo URL
    const res = await fetch('/api/weight', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: form.date, weight_kg: form.weight_kg, photo_url }),
    });

    setUploading(false);

    if (res.ok) {
      setForm({ date: new Date().toISOString().split('T')[0], weight_kg: '', photoFile: null, photoPreview: null });
      if (fileInputRef.current) fileInputRef.current.value = '';
      fetchLogs();
      showToast(photo_url ? 'Weight + photo logged ✓' : 'Weight logged ✓');
    }
  }

  async function handleDelete(id) {
    await fetch(`/api/weight/${id}`, { method: 'DELETE' });
    fetchLogs();
    showToast('Log deleted');
  }

  const sorted  = [...logs].sort((a, b) => new Date(a.date) - new Date(b.date));
  const startW  = sorted[0]?.weight_kg ?? null;
  const latestW = sorted[sorted.length - 1]?.weight_kg ?? null;
  const change  = startW && latestW ? parseFloat((latestW - startW).toFixed(1)) : 0;

  const gW = parseFloat(goalWeight);
  const hasGoal = !isNaN(gW) && startW !== null && latestW !== null;
  let toGoal = null, progressPercent = 0;
  if (hasGoal) {
    toGoal = parseFloat((latestW - gW).toFixed(1));
    const totalToLose = startW - gW;
    const amountLost  = startW - latestW;
    if (totalToLose > 0) progressPercent = Math.max(0, Math.min(100, (amountLost / totalToLose) * 100));
  }

  const chartData = sorted.slice(-20).map(L => ({
    name: new Date(L.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    Weight: L.weight_kg,
  }));

  return (
    <main>
      {photoLog && <PhotoModal log={photoLog} onClose={() => setPhotoLog(null)} />}

      <div className="page-header" style={{ marginBottom: '2.5rem' }}>
        <div>
          <p className="page-eyebrow animate-fade-up">Progress</p>
          <Link href="/" style={{ textDecoration: 'none', color: 'inherit' }}>
            <h1 className="page-title animate-fade-up" style={{ fontSize: '3rem' }}>Weight Log</h1>
          </Link>
        </div>
        <Link href="/" className="btn" style={{ marginTop: '0.5rem' }}><ArrowLeft size={15} /> Home</Link>
      </div>

      {/* Friday Banner — sticky, won't dismiss until weight + photo are logged today */}
      {showFridayBanner && (
        <div
          style={{
            background: 'linear-gradient(135deg, #fff8e1 0%, #fff3cd 100%)',
            border: '1.5px solid #f59e0b',
            borderRadius: '16px',
            padding: '1rem 1.25rem',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.85rem',
          }}
        >
          <div style={{ background: '#f59e0b', borderRadius: '50%', width: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Bell size={18} color="#fff" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#92400e' }}>📸 Friday Check-in</div>
            <div style={{ fontSize: '0.8rem', color: '#b45309', marginTop: '0.15rem' }}>
              {!todayLog ? "Log today's weight with a progress photo!" : "You logged weight — add a photo to complete your check-in!"}
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="card animate-fade-up">
        <div className="stats-row">
          <div className="stat-item">
            <div className="stat-value">{latestW ?? '—'}</div>
            <div className="stat-label">Current (kg)</div>
          </div>
          <div className="stat-item" style={{ borderLeft: '1px solid var(--border)' }}>
            <div className="stat-value" style={{ color: change > 0 ? 'var(--red)' : change < 0 ? 'var(--accent)' : 'var(--text-sub)' }}>
              {change > 0 ? `+${change}` : change === 0 ? '—' : change}
            </div>
            <div className="stat-label">Net Change (kg)</div>
          </div>
          <div className="stat-item" style={{ borderLeft: '1px solid var(--border)' }}>
            <div className="stat-value" style={{ color: 'var(--text-sub)', fontSize: '2rem' }}>{startW ?? '—'}</div>
            <div className="stat-label">Starting (kg)</div>
          </div>
          <div className="stat-item" style={{ borderLeft: '1px solid var(--border)' }}>
            <div className="stat-value" style={{ color: hasGoal && toGoal <= 0 ? 'var(--accent)' : 'var(--gold)', fontSize: '2rem' }}>
              {hasGoal ? (toGoal <= 0 ? 'Done!' : toGoal) : '—'}
            </div>
            <div className="stat-label">To Goal (kg)</div>
          </div>
        </div>

        {hasGoal && (
          <div style={{ marginTop: '2rem', borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-dim)' }}>
              <span>Start: {startW}kg</span>
              <span style={{ color: 'var(--accent)' }}>{progressPercent.toFixed(0)}% Completed</span>
              <span>Goal: {gW}kg</span>
            </div>
            <div style={{ height: '8px', background: 'var(--surface2)', borderRadius: '999px', overflow: 'hidden' }}>
              <div style={{ height: '100%', background: 'var(--accent)', width: `${progressPercent}%`, transition: 'width 1s cubic-bezier(0.4,0,0.2,1)' }} />
            </div>
          </div>
        )}
      </div>

      {/* Log form */}
      <div className="card animate-fade-up">
        <div className="section-label">New Entry</div>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'end', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <div className="form-group">
              <label>Date</label>
              <input required type="date" className="form-input" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
            </div>
            <div className="form-group" style={{ flex: 1, minWidth: '120px' }}>
              <label>Weight (kg)</label>
              <input required type="number" step="0.1" className="form-input" value={form.weight_kg}
                onChange={e => setForm({ ...form, weight_kg: e.target.value })} placeholder="82.5" />
            </div>
          </div>

          {/* Photo upload */}
          <div style={{ marginBottom: '1rem' }}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="user"
              style={{ display: 'none' }}
              onChange={handlePhotoSelect}
              id="weight-photo-input"
            />

            {!form.photoPreview ? (
              <label
                htmlFor="weight-photo-input"
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.6rem',
                  background: 'var(--surface2)', border: '1.5px dashed var(--border)',
                  borderRadius: '12px', padding: '0.85rem 1.2rem',
                  cursor: 'pointer', color: 'var(--text-sub)', fontSize: '0.875rem', fontWeight: 500,
                }}
              >
                <Camera size={18} color="var(--accent)" />
                Add progress photo (optional)
              </label>
            ) : (
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <img
                  src={form.photoPreview}
                  alt="Preview"
                  style={{ width: '100px', height: '100px', objectFit: 'cover', borderRadius: '12px', display: 'block' }}
                />
                <button
                  type="button"
                  onClick={() => { setForm(f => ({ ...f, photoFile: null, photoPreview: null })); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                  style={{
                    position: 'absolute', top: '-8px', right: '-8px',
                    background: '#ef4444', border: 'none', borderRadius: '50%',
                    width: '24px', height: '24px', cursor: 'pointer', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <X size={13} />
                </button>
                <label
                  htmlFor="weight-photo-input"
                  style={{ display: 'block', textAlign: 'center', fontSize: '0.75rem', color: 'var(--accent)', marginTop: '0.35rem', cursor: 'pointer', fontWeight: 600 }}
                >
                  Change
                </label>
              </div>
            )}
          </div>

          <button type="submit" className="btn btn-primary" style={{ height: '44px', width: '100%' }} disabled={uploading}>
            {uploading ? 'Uploading...' : form.photoFile ? '📸 Log Weight + Photo' : 'Log Weight'}
          </button>
        </form>
      </div>

      {/* Chart */}
      {chartData.length > 1 && (
        <div className="card animate-fade-up" style={{ height: '290px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
            <TrendingDown size={14} color="var(--text-dim)" />
            <span className="section-label" style={{ margin: 0 }}>Weight Trend</span>
          </div>
          <ResponsiveContainer width="100%" height="82%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-dim)', fontSize: 11, fontFamily: 'Plus Jakarta Sans' }} />
              <YAxis domain={['auto', 'auto']} axisLine={false} tickLine={false} width={34} tick={{ fill: 'var(--text-dim)', fontSize: 11 }} />
              {goalWeight && (
                <ReferenceLine y={parseFloat(goalWeight)} stroke="var(--gold)" strokeDasharray="6 4"
                  label={{ value: 'Goal', fill: 'var(--gold)', fontSize: 11, fontFamily: 'Plus Jakarta Sans' }} />
              )}
              <Tooltip contentStyle={{ background: 'white', border: '1px solid var(--border)', borderRadius: '10px', fontFamily: 'Plus Jakarta Sans', fontSize: '0.82rem', boxShadow: 'var(--shadow-md)' }} />
              <Line type="monotone" dataKey="Weight" stroke="var(--accent)" strokeWidth={2.5}
                dot={{ stroke: 'var(--accent)', fill: 'white', r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* History */}
      <div className="card animate-fade-up" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '1.5rem 2rem 0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <Scale size={14} color="var(--text-dim)" />
            <span className="section-label" style={{ margin: 0 }}>History</span>
          </div>
        </div>
        {!loading && logs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-dim)' }}>
            <Scale size={34} strokeWidth={1.4} style={{ marginBottom: '0.75rem', opacity: 0.5 }} />
            <p>No entries yet.</p>
          </div>
        ) : (
          <table className="data-table" style={{ margin: 0 }}>
            <thead><tr>
              <th style={{ paddingLeft: '2rem' }}>Date</th>
              <th>Weight</th>
              <th>Change</th>
              <th style={{ paddingRight: '2rem', textAlign: 'right' }}>Photo / Del</th>
            </tr></thead>
            <tbody>
              {[...logs].sort((a, b) => new Date(b.date) - new Date(a.date)).map((log, idx, arr) => {
                const prev = arr[idx + 1]?.weight_kg;
                const diff = prev != null ? parseFloat((log.weight_kg - prev).toFixed(1)) : null;
                const DIcon = diff == null ? Minus : diff > 0 ? TrendingUp : diff < 0 ? TrendingDown : Minus;
                const dColor = diff == null ? 'var(--text-dim)' : diff > 0 ? 'var(--red)' : diff < 0 ? 'var(--accent)' : 'var(--text-sub)';
                return (
                  <tr key={log.id}>
                    <td style={{ paddingLeft: '2rem' }}>
                      {new Date(log.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </td>
                    <td style={{ fontFamily: "'Instrument Serif', serif", fontSize: '1.2rem' }}>{log.weight_kg} kg</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: dColor, fontWeight: 600, fontSize: '0.85rem' }}>
                        <DIcon size={14} />
                        {diff != null ? (diff > 0 ? `+${diff}` : diff === 0 ? '—' : diff) : '—'} {diff != null && diff !== 0 ? 'kg' : ''}
                      </div>
                    </td>
                    <td style={{ paddingRight: '2rem', textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem' }}>
                        {log.photo_url ? (
                          <button
                            onClick={() => setPhotoLog(log)}
                            title="View photo"
                            style={{
                              background: 'var(--accent)', border: 'none',
                              borderRadius: '8px', padding: '5px 9px',
                              cursor: 'pointer', color: '#fff',
                              display: 'flex', alignItems: 'center', gap: '0.3rem',
                              fontSize: '0.75rem', fontWeight: 600,
                            }}
                          >
                            <ImageIcon size={13} /> Photo
                          </button>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-faint)', fontStyle: 'italic' }}>—</span>
                        )}
                        <button className="btn-icon-danger" onClick={() => handleDelete(log.id)}><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}
