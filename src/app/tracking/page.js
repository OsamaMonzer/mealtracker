'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, UtensilsCrossed, Sunrise, Sun, Moon, Apple, Plus, Trash2, ChevronDown, ChevronUp, Pencil, Check } from 'lucide-react';
import { showToast } from '../../components/ToastContainer';
import { useSupabaseRealtime } from '../../hooks/useSupabaseRealtime';

const MEAL_ICONS = { Breakfast: Sunrise, Lunch: Sun, Dinner: Moon, Snack: Apple };

// ── Edit-before-log panel ──────────────────────────────────────────────────
// Shows when user clicks "Edit & Log" on a recipe. Lets them tweak ingredient
// weights for that day only, without touching the saved recipe.
function EditBeforeLogPanel({ recipe, ingredients: allIngredients, onClose, onLog }) {
  const [rows, setRows] = useState([]);
  const [portions, setPortions] = useState('1');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!recipe) return;
    // Fetch this recipe's ingredients
    fetch(`/api/recipes/${recipe.id}/ingredients`)
      .then(r => r.json())
      .then(data => {
        setRows(data.map(i => ({ ...i, weight_g: String(i.weight_g) })));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [recipe?.id]);

  // Live-compute totals from current rows
  const total = rows.reduce((acc, row) => {
    const w = parseFloat(row.weight_g) || 0;
    const ratio = w / 100;
    return {
      cals: acc.cals + (row.calories_100g || 0) * ratio,
      p:    acc.p    + (row.protein_100g  || 0) * ratio,
      c:    acc.c    + (row.carbs_100g    || 0) * ratio,
      f:    acc.f    + (row.fat_100g      || 0) * ratio,
    };
  }, { cals: 0, p: 0, c: 0, f: 0 });

  const portionNum = parseFloat(portions) || 1;
  const serving = { cals: total.cals / portionNum, p: total.p / portionNum, c: total.c / portionNum, f: total.f / portionNum };

  if (!recipe) return null;

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: '600px', maxHeight: '88vh', display: 'flex', flexDirection: 'column', boxShadow: '0 -8px 48px rgba(0,0,0,0.25)' }}>
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '0.75rem 0 0' }}>
          <div style={{ width: '40px', height: '4px', borderRadius: '2px', background: '#e0e0e0' }} />
        </div>

        {/* Header */}
        <div style={{ padding: '0.75rem 1.25rem 0.5rem', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.25rem' }}>Edit for today only</div>
          <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: '1.3rem', color: 'var(--text-main)' }}>{recipe.name}</div>
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.4rem', fontSize: '0.78rem' }}>
            <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{(serving.cals).toFixed(0)} kcal</span>
            <span style={{ color: 'var(--blue)' }}>P {serving.p.toFixed(1)}g</span>
            <span style={{ color: 'var(--gold)' }}>C {serving.c.toFixed(1)}g</span>
            <span style={{ color: 'var(--red)' }}>F {serving.f.toFixed(1)}g</span>
            <span style={{ color: 'var(--text-dim)' }}>per portion</span>
          </div>
        </div>

        {/* Ingredient rows */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '0.75rem 1.25rem' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-dim)', fontSize: '0.85rem' }}>Loading ingredients…</div>
          ) : rows.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-dim)', fontSize: '0.85rem' }}>No ingredients found.</div>
          ) : (
            rows.map((row, i) => {
              const w = parseFloat(row.weight_g) || 0;
              const ratio = w / 100;
              const rowCals = ((row.calories_100g || 0) * ratio).toFixed(0);
              return (
                <div key={row.ingredient_id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-main)' }}>{row.name}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '0.1rem' }}>{rowCals} kcal · P{((row.protein_100g||0)*ratio).toFixed(1)} C{((row.carbs_100g||0)*ratio).toFixed(1)} F{((row.fat_100g||0)*ratio).toFixed(1)}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flexShrink: 0 }}>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={row.weight_g}
                      onChange={e => setRows(prev => prev.map((r, j) => j === i ? { ...r, weight_g: e.target.value } : r))}
                      style={{ width: '64px', textAlign: 'center', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.35rem 0.4rem', fontSize: '0.85rem', fontFamily: 'Plus Jakarta Sans', background: 'var(--surface2)', color: 'var(--text-main)' }}
                    />
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>g</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer: portions + log button */}
        <div style={{ padding: '0.75rem 1.25rem 1.5rem', borderTop: '1px solid var(--border)', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>Portions</label>
            <input
              type="number"
              min="0.1"
              step="0.1"
              value={portions}
              onChange={e => setPortions(e.target.value)}
              style={{ width: '60px', textAlign: 'center', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.4rem', fontSize: '0.85rem', fontFamily: 'Plus Jakarta Sans', background: 'var(--surface2)', color: 'var(--text-main)' }}
            />
          </div>
          <div style={{ flex: 1, textAlign: 'right', fontSize: '0.8rem', color: 'var(--text-dim)' }}>
            Total: <strong style={{ color: 'var(--accent)' }}>{(serving.cals * portionNum).toFixed(0)} kcal</strong>
          </div>
          <button
            onClick={() => {
              if (rows.length === 0) return;
              onLog({ rows, portions: portionNum, recipeName: recipe.name });
            }}
            className="btn btn-primary"
            style={{ flexShrink: 0 }}
          >
            <Check size={14} /> Log
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DailyTracking() {
  const [logs, setLogs]       = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(true);
  const [ingredients, setIngredients] = useState([]);
  const [logMode, setLogMode] = useState('recipe');
  const [expandedLog, setExpandedLog] = useState(null);
  const [dayDetails, setDayDetails] = useState({});
  // Edit-before-log state
  const [editRecipe, setEditRecipe] = useState(null); // { id, name, portions }
  const [editDate, setEditDate] = useState(null);
  const [editMealType, setEditMealType] = useState(null);

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

  async function fetchDayDetail(date) {
    if (dayDetails[date]) return;
    try {
      const data = await fetch(`/api/history?date=${date}`).then(r => r.json());
      setDayDetails(prev => ({ ...prev, [date]: data }));
    } catch (e) {
      console.error(e);
    }
  }

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
      setDayDetails(prev => { const copy = { ...prev }; delete copy[form.date]; return copy; });
      showToast('Meal logged');
      setForm(f => ({ ...f, quick_add_name: '', quick_add_calories: '', recipe_id: '', ingredient_id: '', weight_g: '100' }));
    }
  }

  // Called from the EditBeforeLogPanel when user taps Log
  async function handleEditAndLog({ rows, portions, recipeName }) {
    try {
      const res = await fetch('/api/daily/one-off', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: editDate,
          meal_type: editMealType,
          recipe_name: recipeName,
          portions,
          ingredients: rows.map(r => ({ ingredient_id: r.ingredient_id, weight_g: parseFloat(r.weight_g) || 0 })),
        }),
      });
      if (res.ok) {
        const newLogs = await (await fetch('/api/daily')).json();
        setLogs(newLogs);
        setDayDetails(prev => { const copy = { ...prev }; delete copy[editDate]; return copy; });
        showToast('Meal logged ✓');
        setEditRecipe(null);
      } else {
        showToast('Failed to log', 'error');
      }
    } catch {
      showToast('Failed to log', 'error');
    }
  }

  async function handleDelete(id) {
    const log = logs.find(l => l.id === id);
    await fetch(`/api/daily/${id}`, { method: 'DELETE' });
    setLogs(logs.filter(l => l.id !== id));
    if (log) setDayDetails(prev => { const copy = { ...prev }; delete copy[log.date]; return copy; });
    showToast('Meal deleted');
  }

  async function handleExpand(log) {
    if (expandedLog === log.id) { setExpandedLog(null); return; }
    setExpandedLog(log.id);
    await fetchDayDetail(log.date);
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

  // Which recipe object is selected in the form?
  const selectedRecipe = recipes.find(r => String(r.id) === String(form.recipe_id));

  return (
    <main>
      {editRecipe && (
        <EditBeforeLogPanel
          recipe={editRecipe}
          ingredients={ingredients}
          onClose={() => setEditRecipe(null)}
          onLog={handleEditAndLog}
        />
      )}

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
              {['recipe', 'ingredient', 'quick_add'].map(mode => (
                <button key={mode} type="button" onClick={() => setLogMode(mode)} className="btn" style={{ padding: '0.4rem 1rem', background: logMode === mode ? 'var(--card-bg)' : 'transparent', color: logMode === mode ? 'var(--text-main)' : 'var(--text-dim)', fontSize: '0.85rem', boxShadow: logMode === mode ? 'var(--shadow-sm)' : 'none', border: 'none' }}>
                  {mode === 'quick_add' ? 'Quick Add' : mode.charAt(0).toUpperCase() + mode.slice(1)}
                </button>
              ))}
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

          {/* Edit & Log button — only shown when a recipe is selected */}
          {logMode === 'recipe' && selectedRecipe && (
            <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)' }}>
              <button
                type="button"
                onClick={() => {
                  setEditRecipe(selectedRecipe);
                  setEditDate(form.date);
                  setEditMealType(form.meal_type);
                }}
                className="btn"
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', border: '1px dashed var(--border)', color: 'var(--text-sub)', fontSize: '0.85rem' }}
              >
                <Pencil size={13} />
                Edit ingredients for today only
              </button>
            </div>
          )}
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
                const dayData = dayDetails[log.date];
                const fullLog = dayData?.logs?.find(l => l.id === log.id);
                const logIngredients = fullLog?.ingredients || [];

                return (
                  <div key={log.id} style={{ background: 'var(--surface2)', borderRadius: '12px', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.85rem 1rem' }}>
                      <Icon size={15} color="var(--text-dim)" style={{ flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {log.recipe_name}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.1rem' }}>
                          {log.meal_type}{log.portions_eaten ? ` · ${log.portions_eaten}×` : ''}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: '1.1rem', color: 'var(--accent)', lineHeight: 1 }}>{log.calories?.toFixed(0) ?? '—'} <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>kcal</span></div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '0.15rem' }}>
                          <span style={{ color: 'var(--blue)' }}>P{log.protein?.toFixed(0) ?? '—'}</span>
                          {' · '}
                          <span style={{ color: 'var(--gold)' }}>C{log.carbs?.toFixed(0) ?? '—'}</span>
                          {' · '}
                          <span style={{ color: 'var(--red)' }}>F{log.fat?.toFixed(0) ?? '—'}</span>
                        </div>
                      </div>
                      {log.recipe_id && log.recipe_id !== 'QUICK_ADD' && (
                        <button
                          onClick={() => handleExpand(log)}
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

                    {isExpanded && (
                      <div className="animate-slide-down" style={{ borderTop: '1px solid var(--border)', padding: '0.75rem 1rem 1rem', background: 'var(--card-bg)' }}>
                        {!dayData ? (
                          <div style={{ fontSize: '0.82rem', color: 'var(--text-dim)', textAlign: 'center', padding: '0.5rem' }}>Loading details…</div>
                        ) : logIngredients.length === 0 ? (
                          <div style={{ fontSize: '0.82rem', color: 'var(--text-dim)' }}>No ingredient breakdown available.</div>
                        ) : (
                          <>
                            <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-dim)', marginBottom: '0.6rem' }}>
                              {log.recipe_name} · {log.portions_eaten} portion{log.portions_eaten !== 1 ? 's' : ''}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                              {logIngredients.map((ing, i) => {
                                const ratio = ing.weight_g / 100;
                                return (
                                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem' }}>
                                    <div style={{ flex: 1 }}>
                                      <span style={{ fontWeight: 500 }}>{ing.ing_name}</span>
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
                              <span style={{ color: 'var(--text-dim)' }}>This serving total</span>
                              <div style={{ display: 'flex', gap: '0.6rem' }}>
                                <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{log.calories?.toFixed(0)} kcal</span>
                                <span style={{ color: 'var(--blue)' }}>P{log.protein?.toFixed(1)}</span>
                                <span style={{ color: 'var(--gold)' }}>C{log.carbs?.toFixed(1)}</span>
                                <span style={{ color: 'var(--red)' }}>F{log.fat?.toFixed(1)}</span>
                              </div>
                            </div>
                          </>
                        )}
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
