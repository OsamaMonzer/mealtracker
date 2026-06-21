'use client';

import { useState } from 'react';
import { showToast } from '../../components/ToastContainer';

export default function AdminPage() {
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState('');

  async function downloadBackup() {
    setLoading(true);
    try {
      const res = await fetch('/api/db/full-backup');
      if (!res.ok) throw new Error('Backup failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'meal-tracker-backup.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert('Download failed');
    } finally { setLoading(false); }
  }

  function handleUpload(e) {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    setFileName(f.name);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const txt = reader.result;
        const json = JSON.parse(txt);
        setLoading(true);
        const res = await fetch('/api/db/full-restore', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(json) });
        const data = await res.json();
        if (res.ok) { showToast('Restore complete'); setTimeout(() => location.reload(), 800); }
        else { alert('Restore failed: ' + (data.error || 'unknown')); }
      } catch (err) { console.error(err); alert('Invalid file'); }
      finally { setLoading(false); }
    };
    reader.readAsText(f);
  }

  async function runSeed() {
    setLoading(true);
    try {
      const res = await fetch('/api/seed');
      const data = await res.json();
      if (res.ok) showToast(`Seeded: ${data.added} added, ${data.skipped} skipped`);
      else alert('Seed failed: ' + (data.error || 'unknown'));
    } catch (e) { console.error(e); alert('Seed failed'); }
    finally { setLoading(false); }
  }

  return (
    <main>
      <h1 className="page-title">Admin</h1>
      <div className="card" style={{ padding: '1rem', maxWidth: '780px' }}>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <button className="btn btn-primary" onClick={downloadBackup} disabled={loading}>{loading ? 'Working...' : 'Download Full Backup'}</button>
          <label className="btn" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            Upload Full Backup
            <input type="file" accept="application/json" style={{ display: 'none' }} onChange={handleUpload} />
          </label>
          <button className="btn" onClick={runSeed} disabled={loading}>Run Seed</button>
        </div>
        <div style={{ color: 'var(--text-dim)' }}>
          - Download exports all tables to a single JSON file.<br />
          - Upload expects that JSON file to fully restore data (ingredients, recipes, logs).
        </div>
        {fileName && <div style={{ marginTop: '0.6rem' }}>Selected file: {fileName}</div>}
      </div>
    </main>
  );
}
