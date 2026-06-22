'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, UtensilsCrossed, Sunrise, Sun, Moon, Apple, Plus, Trash2 } from 'lucide-react';
import { showToast } from '../../components/ToastContainer';
import { useSupabaseRealtime } from '../../hooks/useSupabaseRealtime';

const MEAL_ICONS = { Breakfast: Sunrise, Lunch: Sun, Dinner: Moon, Snack: Apple };

export default function DailyTracking() {
  const [logs, setLogs]       = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(true);
  const [isQuickAdd, setIsQuickAdd] = useState(false);
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    meal_type: 'Breakfast', recipe_id: '', portions_eaten: '1',
    quick_add_name: '', quick_add_calories: ''
  });

  async function fetchData() {
    try {
      const [logs, recipes] = await Promise.all([
        fetch('/api/daily').then(r => r.json()),
        fetch('/api/recipes').then(r => r.json()),
      ]);
      setLogs(logs);
      setRecipes(recipes);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchData(); }, []);

  useSupabaseRealtime(
    ['daily_logs', 'recipes', 'recipe_ingredients', 'ingredients'],
    fetchData
  );

  async function handleSubmit(e) {
    e.preventDefault();
    if (!isQuickAdd && !form.recipe_id) return;
    
    const payload = isQuickAdd 
        ? { ...form, recipe_id: 'QUICK_ADD', portions_eaten: '1' } 
        : form;

    const res = await fetch('/api/daily', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (res.ok) { 
      const newLogs = await (await fetch('/api/daily')).json(); 
      setLogs(newLogs); 
      showToast('Meal logged');
      setForm(f => ({ ...f, quick_add_name: '', quick_add_calories: '', recipe_id: '' }));
    }
  }

  async function handleDelete(id) {
    await fetch(`/api/daily/${id}`, { method: 'DELETE' });
    setLogs(logs.filter(l => l.id !== id));
    showToast('Meal deleted');
  }

  const grouped = logs.reduce((acc, log) => {
    if (!acc[log.date]) acc[log.date] = { cals: 0, p: 0, c: 0, f: 0, entries: [] };
    acc[log.date].cals += log.calories; acc[log.date].p += log.protein;
    acc[log.date].c += log.carbs;       acc[log.date].f += log.fat;
    acc[log.date].entries.push(log);
    return acc;
  }, {});

  return (
    <main>
      <div className="page-header" style={{ marginBottom: '2.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link href="/" className="btn-icon"><ArrowLeft size={18} /></Link>
          <Link href="/" style={{ textDecoration: 'none', color: 'inherit' }}>
            <h1 className="page-title animate-fade-up" style={{ fontSize: '3rem' }}>Daily Tracking</h1>
          </Link>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(s => !s)}>
          {showForm ? 'Hide Form' : <><Plus size={15} /> Log Meal</>}
        </button>
      </div>

      {showForm && (
        <div className="card animate-slide-down">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
             <div className="section-label" style={{ margin: 0 }}>Log a Meal</div>
             <div style={{ display: 'flex', gap: '0.5rem', background: 'var(--surface2)', borderRadius: '99px', padding: '0.2rem' }}>
                <button type="button" onClick={() => setIsQuickAdd(false)} className="btn" style={{ padding: '0.4rem 1rem', background: !isQuickAdd ? 'var(--card-bg)' : 'transparent', color: !isQuickAdd ? 'var(--text-main)' : 'var(--text-dim)', fontSize: '0.85rem', boxShadow: !isQuickAdd ? 'var(--shadow-sm)' : 'none', border: 'none' }}>Recipe</button>
                <button type="button" onClick={() => setIsQuickAdd(true)} className="btn" style={{ padding: '0.4rem 1rem', background: isQuickAdd ? 'var(--card-bg)' : 'transparent', color: isQuickAdd ? 'var(--text-main)' : 'var(--text-dim)', fontSize: '0.85rem', boxShadow: isQuickAdd ? 'var(--shadow-sm)' : 'none', border: 'none' }}>Quick Add</button>
             </div>
          </div>
          <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: isQuickAdd ? '1fr 1fr 2fr 100px auto' : '1fr 1fr 2fr 90px auto', gap: '0.75rem', alignItems: 'end' }}>
            <div className="form-group">
              <label>Date</label>
              <input type="date" className="form-input" value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Meal</label>
              <select className="form-input" value={form.meal_type} onChange={e => setForm({...form, meal_type: e.target.value})}>
                {Object.keys(MEAL_ICONS).map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
            
            {isQuickAdd ? (
              <>
                <div className="form-group">
                  <label>Name</label>
                  <input type="text" className="form-input" required value={form.quick_add_name} onChange={e => setForm({...form, quick_add_name: e.target.value})} placeholder="e.g. Eating out" />
                </div>
                <div className="form-group">
                  <label>Calories</label>
                  <input type="number" className="form-input" required value={form.quick_add_calories} onChange={e => setForm({...form, quick_add_calories: e.target.value})} placeholder="0" />
                </div>
              </>
            ) : (
              <>
                <div className="form-group">
                  <label>Recipe</label>
                  <select className="form-input" value={form.recipe_id} onChange={e => setForm({...form, recipe_id: e.target.value})}>
                    <option value="">Select recipe...</option>
                    {recipes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Portions</label>
                  <input type="number" step="0.1" min="0.1" className="form-input" style={{ textAlign: 'center' }}
                    value={form.portions_eaten} onChange={e => setForm({...form, portions_eaten: e.target.value})} />
                </div>
              </>
            )}
            <button type="submit" className="btn btn-primary" style={{ height: '44px' }}>Log</button>
          </form>
        </div>
      )}

      {!loading && Object.keys(grouped).length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '4rem' }}>
          <UtensilsCrossed size={36} strokeWidth={1.4} style={{ color: 'var(--text-dim)', marginBottom: '0.75rem' }} />
          <p style={{ color: 'var(--text-sub)' }}>No meals logged yet. Use the form above to start.</p>
        </div>
      ) : (
        Object.entries(grouped).sort((a,b) => new Date(b[0]) - new Date(a[0])).map(([date, data], idx) => (
          <div key={date} className="card animate-fade-up" style={{ animationDelay: `${idx * 40}ms` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <h2 style={{ fontFamily: "'Instrument Serif', serif", fontWeight: 400, fontSize: '1.2rem', letterSpacing: '-0.3px' }}>
                {new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </h2>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', fontSize: '0.86rem' }}>
                <span style={{ fontWeight: 700, color: 'var(--accent)' }}>{data.cals.toFixed(0)} kcal</span>
                <span style={{ color: 'var(--blue)' }}>P {data.p.toFixed(1)}g</span>
                <span style={{ color: 'var(--gold)' }}>C {data.c.toFixed(1)}g</span>
                <span style={{ color: 'var(--red)' }}>F {data.f.toFixed(1)}g</span>
              </div>
            </div>
            <table className="data-table">
              <thead><tr>
                <th>Meal</th><th>Recipe</th><th>Portions</th><th>Calories</th><th>P / C / F</th><th></th>
              </tr></thead>
              <tbody>
                {data.entries.map(log => {
                  const Icon = MEAL_ICONS[log.meal_type] || UtensilsCrossed;
                  return (
                    <tr key={log.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Icon size={14} color="var(--text-dim)" />
                          <span style={{ color: 'var(--text-sub)', fontSize: '0.86rem' }}>{log.meal_type}</span>
                        </div>
                      </td>
                      <td style={{ fontWeight: 500 }}>{log.recipe_name}</td>
                      <td style={{ color: 'var(--text-sub)' }}>{log.portions_eaten}×</td>
                      <td style={{ fontWeight: 700, color: 'var(--accent)' }}>{log.calories.toFixed(0)}</td>
                      <td style={{ fontSize: '0.82rem' }}>
                        <span style={{ color: 'var(--blue)' }}>{log.protein.toFixed(1)}</span> /
                        <span style={{ color: 'var(--gold)' }}> {log.carbs.toFixed(1)}</span> /
                        <span style={{ color: 'var(--red)' }}> {log.fat.toFixed(1)}</span>g
                      </td>
                      <td>
                        <button className="btn-icon-danger" onClick={() => handleDelete(log.id)}><Trash2 size={13} /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))
      )}
    </main>
  );
}
