'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, UtensilsCrossed, Sunrise, Sun, Moon, Apple, Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { showToast } from '../../components/ToastContainer';
import { useSupabaseRealtime } from '../../hooks/useSupabaseRealtime';

const MEAL_ICONS = { Breakfast: Sunrise, Lunch: Sun, Dinner: Moon, Snack: Apple };

export default function DailyTracking() {
  const [logs, setLogs]       = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(true);
  const [ingredients, setIngredients] = useState([]);
  const [logMode, setLogMode] = useState('recipe');
  const [expandedLog, setExpandedLog] = useState(null);
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    meal_type: 'Breakfast', recipe_id: '', portions_eaten: '1',
    quick_add_name: '', quick_add_calories: '',
    ingredient_id: '', weight_g: '100'
  });

  async function fetchData() {
    try {
      const [logsData, recipesData, ingsData] = await Promise.all([
        fetch('/api/daily').then(r => r.json()),
        fetch('/api/recipes').then(r => r.json()),
        fetch('/api/ingredients').then(r => r.json()),
      ]);
      setLogs(logsData);
      setRecipes(recipesData);
      setIngredients(ingsData);
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
    if (logMode === 'recipe' && !form.recipe_id) return;
    if (logMode === 'ingredient' && !form.ingredient_id) return;

    let payload = form;
    if (logMode === 'quick_add') {
      payload = { ...form, recipe_id: 'QUICK_ADD', portions_eaten: '1', ingredient_id: '', weight_g: '' };
    } else if (logMode === 'recipe') {
      payload = { ...form, ingredient_id: '', weight_g: '', quick_add_name: '', quick_add_calories: '' };
    } else if (logMode === 'ingredient') {
      payload = { ...form, recipe_id: '', portions_eaten: '', quick_add_name: '', quick_add_calories: '' };
    }

    const res = await fetch('/api/daily', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (res.ok) {
      const newLogs = await (await fetch('/api/daily')).json();
      setLogs(newLogs);
      showToast('Meal logged');
      setForm(f => ({ ...f, quick_add_name: '', quick_add_calories: '', recipe_id: '', ingredient_id: '', weight_g: '100' }));
    }
  }

  async function handleDelete(id) {
    await fetch(`/api/daily/${id}`, { method: 'DELETE' });
    setLogs(logs.filter(l => l.id !== id));
    showToast('Meal deleted');
  }

  const grouped = logs.reduce((acc, log) => {
    if (!acc[log.date]) acc[log.date] = { cals: 0, p: 0, c: 0, f: 0, entries: [] };
    acc[log.date].cals += log.calories;
    acc[log.date].p += log.protein;
    acc[log.date].c += log.carbs;
    acc[log.date].f += log.fat;
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div className="section-label" style={{ margin: 0 }}>Log a Meal</div>
            <div style={{ display: 'flex', gap: '0.5rem', background: 'var(--surface2)', borderRadius: '99px', padding: '0.2rem' }}>
              <button type="button" onClick={() => setLogMode('recipe')} className="btn" style={{ padding: '0.4rem 1rem', background: logMode === 'recipe' ? 'var(--card-bg)' : 'transparent', color: logMode === 'recipe' ? 'var(--text-main)' : 'var(--text-dim)', fontSize: '0.85rem', boxShadow: logMode === 'recipe' ? 'var(--shadow-sm)' : 'none', border: 'none' }}>Recipe</button>
              <button type="button" onClick={() => setLogMode('ingredient')} className="btn" style={{ padding: '0.4rem 1rem', background: logMode === 'ingredient' ? 'var(--card-bg)' : 'transparent', color: logMode === 'ingredient' ? 'var(--text-main)' : 'var(--text-dim)', fontSize: '0.85rem', boxShadow: logMode === 'ingredient' ? 'var(--shadow-sm)' : 'none', border: 'none' }}>Ingredient</button>
              <button type="button" onClick={() => setLogMode('quick_add')} className="btn" style={{ padding: '0.4rem 1rem', background: logMode === 'quick_add' ? 'var(--card-bg)' : 'transparent', color: logMode === 'quick_add' ? 'var(--text-main)' : 'var(--text-dim)', fontSize: '0.85rem', boxShadow: logMode === 'quick_add' ? 'var(--shadow-sm)' : 'none', border: 'none' }}>Quick Add</button>
            </div>
          </div>
          <form onSubmit={handleSubmit} className="log-form-grid">
            <div className="form-group">
              <label>Date</label>
              <input type="date" className="form-input" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Meal</label>
              <select className="form-input" value={form.meal_type} onChange={e => setForm({ ...form, meal_type: e.target.value })}>
                {Object.keys(MEAL_ICONS).map(m => <option key={m}>{m}</option>)}
              </select>
            </div>

            {logMode === 'quick_add' ? (
              <>
                <div className="form-group">
                  <label>Name</label>
                  <input type="text" className="form-input" required value={form.quick_add_name} onChange={e => setForm({ ...form, quick_add_name: e.target.value })} placeholder="e.g. Eating out" />
                </div>
                <div className="form-group">
                  <label>Calories</label>
                  <input type="number" className="form-input" required value={form.quick_add_calories} onChange={e => setForm({ ...form, quick_add_calories: e.target.value })} placeholder="0" />
                </div>
              </>
            ) : logMode === 'ingredient' ? (
              <>
                <div className="form-group">
                  <label>Ingredient</label>
                  <select className="form-input" value={form.ingredient_id} onChange={e => setForm({ ...form, ingredient_id: e.target.value })}>
                    <option value="">Select ingredient...</option>
                    {ingredients.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Weight (g)</label>
                  <input type="number" step="0.1" min="1" className="form-input" style={{ textAlign: 'center' }} value={form.weight_g} onChange={e => setForm({ ...form, weight_g: e.target.value })} />
                </div>
              </>
            ) : (
              <>
                <div className="form-group">
                  <label>Recipe</label>
                  <select className="form-input" value={form.recipe_id} onChange={e => setForm({ ...form, recipe_id: e.target.value })}>
                    <option value="">Select recipe...</option>
                    {recipes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Portions</label>
                  <input type="number" step="0.1" min="0.1" className="form-input" style={{ textAlign: 'center' }} value={form.portions_eaten} onChange={e => setForm({ ...form, portions_eaten: e.target.value })} />
                </div>
              </>
            )}
            <button type="submit" className="btn btn-primary" style={{ height: '44px', alignSelf: 'flex-end' }}>Log</button>
          </form>
        </div>
      )}

      {!loading && Object.keys(grouped).length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '4rem' }}>
          <UtensilsCrossed size={36} strokeWidth={1.4} style={{ color: 'var(--text-dim)', marginBottom: '0.75rem' }} />
          <p style={{ color: 'var(--text-sub)' }}>No meals logged yet. Use the form above to start.</p>
        </div>
      ) : (
        Object.entries(grouped).sort((a, b) => new Date(b[0]) - new Date(a[0])).map(([date, data], idx) => (
          <div key={date} className="card animate-fade-up" style={{ animationDelay: `${idx * 40}ms` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <h2 style={{ fontFamily: "'Instrument Serif', serif", fontWeight: 400, fontSize: '1.2rem', letterSpacing: '-0.3px' }}>
                {new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </h2>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', fontSize: '0.86rem', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700, color: 'var(--accent)' }}>{data.cals.toFixed(0)} kcal</span>
                <span style={{ color: 'var(--blue)' }}>P {data.p.toFixed(1)}g</span>
                <span style={{ color: 'var(--gold)' }}>C {data.c.toFixed(1)}g</span>
                <span style={{ color: 'var(--red)' }}>F {data.f.toFixed(1)}g</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {data.entries.map(log => {
                const Icon = MEAL_ICONS[log.meal_type] || UtensilsCrossed;
                const isExpanded = expandedLog === log.id;
                // Find recipe details from our loaded recipes list
                const recipeDetail = recipes.find(r => r.id === log.recipe_id);

                return (
                  <div key={log.id} style={{ background: 'var(--surface2)', borderRadius: '12px', overflow: 'hidden' }}>
                    {/* Main row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.85rem 1rem' }}>
                      <Icon size={15} color="var(--text-dim)" style={{ flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {log.recipe_name}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.1rem' }}>
                          {log.meal_type} · {log.portions_eaten}×
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: '1.1rem', color: 'var(--accent)', lineHeight: 1 }}>{log.calories.toFixed(0)} <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>kcal</span></div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '0.15rem' }}>
                          <span style={{ color: 'var(--blue)' }}>P{log.protein.toFixed(0)}</span>
                          {' · '}
                          <span style={{ color: 'var(--gold)' }}>C{log.carbs.toFixed(0)}</span>
                          {' · '}
                          <span style={{ color: 'var(--red)' }}>F{log.fat.toFixed(0)}</span>
                        </div>
                      </div>
                      {/* Expand button — only for recipes with ingredient details */}
                      {recipeDetail?.ingredients?.length > 0 && (
                        <button
                          onClick={() => setExpandedLog(isExpanded ? null : log.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: '4px', flexShrink: 0 }}
                          title="View recipe details"
                        >
                          {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                        </button>
                      )}
                      <button className="btn-icon-danger" onClick={() => handleDelete(log.id)} style={{ flexShrink: 0 }}>
                        <Trash2 size={13} />
                      </button>
                    </div>

                    {/* Expanded recipe ingredient breakdown */}
                    {isExpanded && recipeDetail?.ingredients?.length > 0 && (
                      <div className="animate-slide-down" style={{ borderTop: '1px solid var(--border)', padding: '0.75rem 1rem 1rem', background: 'var(--card-bg)' }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-dim)', marginBottom: '0.6rem' }}>
                          Recipe: {recipeDetail.name} · {recipeDetail.portions} portion{recipeDetail.portions !== 1 ? 's' : ''} total
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                          {recipeDetail.ingredients.map((ing, i) => {
                            const ratio = ing.weight_g / 100;
                            return (
                              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem' }}>
                                <div style={{ flex: 1 }}>
                                  <span style={{ fontWeight: 500 }}>{ing.name}</span>
                                  <span style={{ color: 'var(--text-dim)', marginLeft: '0.4rem' }}>{ing.weight_g}g</span>
                                </div>
                                <div style={{ display: 'flex', gap: '0.6rem', flexShrink: 0 }}>
                                  <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{(ing.calories_100g * ratio).toFixed(0)} kcal</span>
                                  <span style={{ color: 'var(--blue)' }}>P{(ing.protein_100g * ratio).toFixed(1)}</span>
                                  <span style={{ color: 'var(--gold)' }}>C{(ing.carbs_100g * ratio).toFixed(1)}</span>
                                  <span style={{ color: 'var(--red)' }}>F{(ing.fat_100g * ratio).toFixed(1)}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <div style={{ marginTop: '0.6rem', paddingTop: '0.6rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                          <span style={{ color: 'var(--text-dim)' }}>Full recipe total</span>
                          <div style={{ display: 'flex', gap: '0.6rem' }}>
                            <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{Math.round(recipeDetail.totalCals)} kcal</span>
                            <span style={{ color: 'var(--blue)' }}>P{recipeDetail.totalP.toFixed(1)}</span>
                            <span style={{ color: 'var(--gold)' }}>C{recipeDetail.totalC.toFixed(1)}</span>
                            <span style={{ color: 'var(--red)' }}>F{recipeDetail.totalF.toFixed(1)}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </main>
  );
}
