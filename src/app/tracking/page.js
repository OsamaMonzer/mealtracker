'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, UtensilsCrossed, Sunrise, Sun, Moon, Apple,
  Plus, Trash2, ChevronDown, ChevronUp, Pencil, Check, X, Save
} from 'lucide-react';
import { showToast } from '../../components/ToastContainer';
import { useSupabaseRealtime } from '../../hooks/useSupabaseRealtime';
import UserNav from '../../components/UserNav';

const MEAL_ICONS = { Breakfast: Sunrise, Lunch: Sun, Dinner: Moon, Snack: Apple };
const MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];

// ── Edit Log Modal (portions / meal type) ─────────────────────────────────────
function EditLogModal({ log, recipes, onClose, onSave, onEditIngredients }) {
  const [portions, setPortions] = useState(String(log.portions_eaten));
  const [mealType, setMealType] = useState(log.meal_type);
  const [recipeId, setRecipeId] = useState(String(log.recipe_id));
  const [saving, setSaving] = useState(false);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    await onSave(log.id, { portions_eaten: portions, meal_type: mealType, recipe_id: recipeId });
    setSaving(false);
    onClose();
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', backdropFilter: 'blur(3px)' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: '480px', padding: '0 0 2rem', boxShadow: '0 -8px 48px rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '0.75rem 0 0' }}>
          <div style={{ width: '40px', height: '4px', borderRadius: '2px', background: '#e0e0e0' }} />
        </div>
        <div style={{ padding: '1rem 1.5rem 0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: '1.3rem', color: '#111' }}>Edit Entry</div>
          <button onClick={onClose} style={{ background: '#f3f3f3', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#666' }}><X size={16} /></button>
        </div>
        <div style={{ padding: '0.25rem 1.5rem 0.5rem', fontSize: '0.85rem', color: 'var(--text-dim)' }}>{log.recipe_name}</div>
        <form onSubmit={handleSave} style={{ padding: '0.5rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label style={{ fontSize: '0.82rem', color: 'var(--text-sub)' }}>Recipe</label>
            <select className="form-input" value={recipeId} onChange={e => setRecipeId(e.target.value)}>
              {!recipes.find(r => String(r.id) === String(recipeId)) && <option value={recipeId}>{log.recipe_name}</option>}
              {recipes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label style={{ fontSize: '0.82rem', color: 'var(--text-sub)' }}>Meal Type</label>
            <select className="form-input" value={mealType} onChange={e => setMealType(e.target.value)}>
              {MEAL_TYPES.map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label style={{ fontSize: '0.82rem', color: 'var(--text-sub)' }}>Portions</label>
            <input type="number" step="0.1" min="0.01" className="form-input" value={portions} onChange={e => setPortions(e.target.value)} required />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
            <button type="button" className="btn" onClick={onEditIngredients} style={{ flex: 1, padding: '0.85rem', justifyContent: 'center' }}>
              Customize Ingredients
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving} style={{ flex: 1, padding: '0.85rem', justifyContent: 'center' }}>
              {saving ? 'Saving…' : <><Check size={15} /> Save</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Ingredient Edit Row ───────────────────────────────────────────────────────
function IngEditRow({ ing, allIngredients, onChange, onRemove }) {
  const selected = allIngredients.find(i => i.id === ing.ingredient_id);
  const cals = selected ? ((selected.calories_100g * ing.weight_g) / 100).toFixed(0) : '—';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ flex: 2, minWidth: 0 }}>
        <select
          className="form-input"
          style={{ fontSize: '0.82rem', padding: '0.35rem 0.5rem' }}
          value={ing.ingredient_id}
          onChange={e => onChange({ ...ing, ingredient_id: Number(e.target.value) })}
        >
          {allIngredients.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
        </select>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flex: 1 }}>
        <input
          type="number" step="0.1" min="0.1"
          className="form-input"
          style={{ fontSize: '0.82rem', padding: '0.35rem 0.5rem', textAlign: 'right', width: '70px' }}
          value={ing.weight_g}
          onChange={e => onChange({ ...ing, weight_g: e.target.value })}
        />
        <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>g</span>
      </div>
      <div style={{ fontSize: '0.78rem', color: 'var(--accent)', fontWeight: 600, minWidth: '46px', textAlign: 'right' }}>
        {cals} kcal
      </div>
      <button
        type="button"
        onClick={onRemove}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)', padding: '4px', flexShrink: 0 }}
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function DailyTracking() {
  const [logs, setLogs]               = useState([]);
  const [recipes, setRecipes]         = useState([]);
  const [loading, setLoading]         = useState(true);
  const [showForm, setShowForm]       = useState(true);
  const [ingredients, setIngredients] = useState([]);
  const [logMode, setLogMode]         = useState('recipe');
  const [expandedLog, setExpandedLog] = useState(null);
  const [editingLog, setEditingLog]   = useState(null);
  // Inline ingredient editing state
  const [editingIngLog, setEditingIngLog] = useState(null); // log.id being ingredient-edited
  const [editIngRows, setEditIngRows]     = useState([]);   // [{ingredient_id, weight_g}]
  const [savingIngs, setSavingIngs]       = useState(false);

  const [dayDetails, setDayDetails] = useState({});
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
        fetch('/api/recipes?slim=1').then(r => r.json()),
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

  async function refreshDayDetail(date) {
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

  async function handleDelete(id) {
    const log = logs.find(l => l.id === id);
    await fetch(`/api/daily/${id}`, { method: 'DELETE' });
    setLogs(logs.filter(l => l.id !== id));
    if (log) setDayDetails(prev => { const copy = { ...prev }; delete copy[log.date]; return copy; });
    showToast('Meal deleted');
  }

  // Simple field edit (portions / meal_type via modal)
  async function handleEdit(id, changes) {
    const res = await fetch(`/api/daily/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(changes),
    });
    if (res.ok) {
      const newLogs = await fetch('/api/daily').then(r => r.json());
      setLogs(newLogs);
      const log = logs.find(l => l.id === id);
      if (log) setDayDetails(prev => { const copy = { ...prev }; delete copy[log.date]; return copy; });
      showToast('Updated ✓');
    } else {
      showToast('Update failed', 'error');
    }
  }

  // Start ingredient editing for a log
  function startIngEdit(log, logIngredients) {
    setEditingIngLog(log.id);
    setEditIngRows(logIngredients.map(ing => ({
      ingredient_id: ing.ingredient_id,
      weight_g: String(ing.weight_g),
    })));
  }

  function cancelIngEdit() {
    setEditingIngLog(null);
    setEditIngRows([]);
  }

  async function saveIngredients(log) {
    if (editIngRows.length === 0) { showToast('Add at least one ingredient', 'error'); return; }
    setSavingIngs(true);
    const payload = {
      meal_type: log.meal_type,
      portions_eaten: 1,
      ingredients: editIngRows.map(r => ({ ingredient_id: Number(r.ingredient_id), weight_g: parseFloat(r.weight_g) })),
    };
    const res = await fetch(`/api/daily/${log.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setSavingIngs(false);
    if (res.ok) {
      const newLogs = await fetch('/api/daily').then(r => r.json());
      setLogs(newLogs);
      await refreshDayDetail(log.date);
      cancelIngEdit();
      showToast('Ingredients updated ✓');
    } else {
      showToast('Save failed', 'error');
    }
  }

  async function handleExpand(log) {
    if (expandedLog === log.id) {
      setExpandedLog(null);
      cancelIngEdit();
      return;
    }
    setExpandedLog(log.id);
    await fetchDayDetail(log.date);
  }

  async function handleEditIngredientsFromModal(log) {
    setEditingLog(null);
    let fullLog = dayDetails[log.date]?.logs?.find(l => l.id === log.id);
    if (!fullLog) {
      setExpandedLog(log.id);
      try {
        const data = await fetch(`/api/history?date=${log.date}`).then(r => r.json());
        setDayDetails(prev => ({ ...prev, [log.date]: data }));
        fullLog = data?.logs?.find(l => l.id === log.id);
      } catch (e) { console.error(e); }
    } else {
      setExpandedLog(log.id);
    }
    const logIngs = fullLog?.ingredients || [];
    startIngEdit(log, logIngs);
  }

  const grouped = logs.reduce((acc, log) => {
    if (!acc[log.date]) acc[log.date] = { cals: 0, p: 0, c: 0, f: 0, entries: [] };
    acc[log.date].cals += log.calories;
    acc[log.date].p    += log.protein;
    acc[log.date].c    += log.carbs;
    acc[log.date].f    += log.fat;
    acc[log.date].entries.push(log);
    return acc;
  }, {});

  return (
    <main>
      {editingLog && (
        <EditLogModal
          log={editingLog}
          recipes={recipes}
          onClose={() => setEditingLog(null)}
          onSave={handleEdit}
          onEditIngredients={() => handleEditIngredientsFromModal(editingLog)}
        />
      )}

      <div className="page-header" style={{ marginBottom: '2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link href="/" className="btn-icon"><ArrowLeft size={18} /></Link>
          <Link href="/" style={{ textDecoration: 'none', color: 'inherit' }}>
            <h1 className="page-title animate-fade-up" style={{ fontSize: '2.5rem', margin: 0 }}>Daily Tracking</h1>
          </Link>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <button className="btn btn-primary" onClick={() => setShowForm(s => !s)}>
            {showForm ? 'Hide Form' : <><Plus size={15} /> Log Meal</>}
          </button>
          <UserNav />
        </div>
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
                const isExpanded  = expandedLog === log.id;
                const isIngEdit   = editingIngLog === log.id;
                const dayData     = dayDetails[log.date];
                const fullLog     = dayData?.logs?.find(l => l.id === log.id);
                const logIngs     = fullLog?.ingredients || [];

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
                          {log.meal_type}{log.portions_eaten ? ` · ${log.portions_eaten}×` : ''}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: '1.1rem', color: 'var(--accent)', lineHeight: 1 }}>
                          {log.calories?.toFixed(0) ?? '—'} <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>kcal</span>
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '0.15rem' }}>
                          <span style={{ color: 'var(--blue)' }}>P{log.protein?.toFixed(0) ?? '—'}</span>
                          {' · '}
                          <span style={{ color: 'var(--gold)' }}>C{log.carbs?.toFixed(0) ?? '—'}</span>
                          {' · '}
                          <span style={{ color: 'var(--red)' }}>F{log.fat?.toFixed(0) ?? '—'}</span>
                        </div>
                      </div>
                      {/* Expand button */}
                      {log.recipe_id && (
                        <button onClick={() => handleExpand(log)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: '4px', flexShrink: 0 }} title="View / edit ingredients">
                          {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                        </button>
                      )}
                      {/* Edit portions/meal type */}
                      <button onClick={() => setEditingLog(log)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: '4px', flexShrink: 0 }} title="Edit portions / meal type">
                        <Pencil size={13} />
                      </button>
                      <button className="btn-icon-danger" onClick={() => handleDelete(log.id)} style={{ flexShrink: 0 }}>
                        <Trash2 size={13} />
                      </button>
                    </div>

                    {/* Expanded: ingredient view or ingredient edit */}
                    {isExpanded && (
                      <div className="animate-slide-down" style={{ borderTop: '1px solid var(--border)', padding: '0.75rem 1rem 1rem', background: 'var(--card-bg)' }}>
                        {!dayData ? (
                          <div style={{ fontSize: '0.82rem', color: 'var(--text-dim)', textAlign: 'center', padding: '0.5rem' }}>Loading…</div>
                        ) : isIngEdit ? (
                          /* ── Ingredient Edit Mode ─────────────────────── */
                          <>
                            <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-dim)', marginBottom: '0.6rem' }}>
                              Edit Ingredients
                            </div>
                            {editIngRows.map((row, i) => (
                              <IngEditRow
                                key={i}
                                ing={row}
                                allIngredients={ingredients}
                                onChange={updated => setEditIngRows(rows => rows.map((r, j) => j === i ? updated : r))}
                                onRemove={() => setEditIngRows(rows => rows.filter((_, j) => j !== i))}
                              />
                            ))}
                            {/* Add ingredient row */}
                            <button
                              type="button"
                              onClick={() => {
                                const first = ingredients[0];
                                if (first) setEditIngRows(r => [...r, { ingredient_id: first.id, weight_g: '100' }]);
                              }}
                              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.6rem', background: 'none', border: '1px dashed var(--border)', borderRadius: '8px', padding: '0.4rem 0.75rem', fontSize: '0.8rem', color: 'var(--text-dim)', cursor: 'pointer', width: '100%', justifyContent: 'center' }}
                            >
                              <Plus size={13} /> Add ingredient
                            </button>
                            {/* Actions */}
                            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                              <button onClick={cancelIngEdit} className="btn" style={{ flex: 1, padding: '0.55rem', justifyContent: 'center', fontSize: '0.85rem' }}>
                                Cancel
                              </button>
                              <button
                                onClick={() => saveIngredients(log)}
                                disabled={savingIngs}
                                className="btn btn-primary"
                                style={{ flex: 2, padding: '0.55rem', justifyContent: 'center', fontSize: '0.85rem' }}
                              >
                                {savingIngs ? 'Saving…' : <><Save size={13} /> Save for this day only</>}
                              </button>
                            </div>
                            <p style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textAlign: 'center', marginTop: '0.5rem' }}>
                              Original recipe stays unchanged.
                            </p>
                          </>
                        ) : logIngs.length === 0 ? (
                          <div style={{ fontSize: '0.82rem', color: 'var(--text-dim)' }}>No ingredient breakdown available.</div>
                        ) : (
                          /* ── Ingredient View Mode ─────────────────────── */
                          <>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                              <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-dim)' }}>
                                {log.recipe_name} · {log.portions_eaten}×
                              </div>
                              <button
                                onClick={() => startIngEdit(log, logIngs)}
                                style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: 'var(--surface2)', border: 'none', borderRadius: '8px', padding: '0.3rem 0.6rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-main)', cursor: 'pointer' }}
                              >
                                <Pencil size={11} /> Edit ingredients
                              </button>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                              {logIngs.map((ing, i) => {
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
                              <span style={{ color: 'var(--text-dim)' }}>Serving total</span>
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
