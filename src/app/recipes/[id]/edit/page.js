'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ChefHat, Plus, X, Trash2 } from 'lucide-react';
import { useSupabaseRealtime } from '../../../../hooks/useSupabaseRealtime';

const CATEGORIES = ['Protein', 'Carb', 'Fat', 'Vegetable', 'Fruit', 'Sauce', 'Dairy', 'Other'];
const blankIng = { name: '', category: 'Protein', brand: '', status: 'Raw', calories_100g: '', protein_100g: '', carbs_100g: '', fat_100g: '', price_kg: '', notes: '' };

export default function RecipeEdit({ params }) {
  const router = useRouter();
  const [ingredientsDB, setIngredientsDB] = useState([]);
  const [recipeName, setRecipeName]       = useState('');
  const [portions, setPortions]           = useState(1);
  const [rows, setRows]                   = useState([]);
  const [saving, setSaving]               = useState(false);
  const [loading, setLoading]             = useState(true);
  const [showIngForm, setShowIngForm]     = useState(false);
  const [ingForm, setIngForm]             = useState(blankIng);
  const [ingSaving, setIngSaving]         = useState(false);

  const { id } = params;

  async function fetchData() {
    try {
      const [ingsRes, recipesRes] = await Promise.all([
        fetch('/api/ingredients'),
        fetch('/api/recipes')
      ]);
      const ingsData = await ingsRes.json();
      const recipesData = await recipesRes.json();
      setIngredientsDB(ingsData);
      
      const recipe = recipesData.find(r => r.id.toString() === id);
      if (recipe) {
        setRecipeName(recipe.name);
        setPortions(recipe.portions);
        const newRows = recipe.ingredients.map(ing => ({
           db_id: ing.id,
           weight_g: ing.weight_g
        }));
        setRows(newRows);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchData(); }, [id]);

  useSupabaseRealtime(['ingredients'], fetchData);

  async function saveIngredient(e) {
    e.preventDefault();
    setIngSaving(true);
    const res = await fetch('/api/ingredients', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ingForm) });
    if (res.ok) { setIngForm(blankIng); setShowIngForm(false); fetchData(); }
    else alert('Error saving ingredient');
    setIngSaving(false);
  }

  const addRow    = () => setRows([...rows, { db_id: '', weight_g: 100 }]);
  const updateRow = (i, f, v) => setRows(rows.map((r, idx) => idx === i ? { ...r, [f]: v } : r));
  const removeRow = (i) => setRows(rows.filter((_, idx) => idx !== i));

  let totCal = 0, totP = 0, totC = 0, totF = 0;
  rows.forEach(row => {
    const ing = ingredientsDB.find(x => x.id.toString() === row.db_id.toString());
    if (!ing || !row.weight_g) return;
    const r = parseFloat(row.weight_g) / 100;
    totCal += ing.calories_100g * r; totP += ing.protein_100g * r;
    totC += ing.carbs_100g * r; totF += ing.fat_100g * r;
  });

  async function saveRecipe() {
    if (!recipeName.trim()) return alert('Enter a recipe name');
    const ings = rows.filter(r => r.db_id && r.weight_g).map(r => ({ ingredient_id: parseInt(r.db_id), weight_g: parseFloat(r.weight_g) }));
    if (!ings.length) return alert('Add at least one ingredient');
    setSaving(true);
    const res = await fetch(`/api/recipes/${id}`, { 
        method: 'PUT', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ name: recipeName, portions: parseInt(portions) || 1, ingredients: ings }) 
    });
    setSaving(false);
    if (res.ok) router.push('/recipes');
    else { const e = await res.json(); alert('Error: ' + e.error); }
  }

  const p = parseInt(portions) || 1;

  if (loading) return <div style={{padding: '3rem', textAlign: 'center', color: 'var(--text-dim)'}}>Loading Recipe...</div>;

  return (
    <main>
      <div className="page-header" style={{ marginBottom: '2.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link href="/recipes" className="btn-icon"><ArrowLeft size={18} /></Link>
          <Link href="/" style={{ textDecoration: 'none', color: 'inherit' }}>
            <h1 className="page-title animate-fade-up" style={{ fontSize: '3rem' }}>Edit Recipe</h1>
          </Link>
        </div>
      </div>

      {/* Details */}
      <div className="card">
        <div className="section-label">Recipe Details</div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <div className="form-group" style={{ flex: 3 }}>
            <label>Recipe Name</label>
            <input type="text" className="form-input" value={recipeName} onChange={e => setRecipeName(e.target.value)} placeholder="e.g. Chicken Rice Bowl" />
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label>Portions</label>
            <input type="number" className="form-input" min="1" value={portions} onChange={e => setPortions(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Ingredients */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <div className="section-label" style={{ margin: 0 }}>Ingredients</div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-ghost" style={{ padding: '0.5rem 0.9rem', fontSize: '0.82rem' }} onClick={() => setShowIngForm(s => !s)}>
              {showIngForm ? <><X size={13} /> Cancel</> : <><Plus size={13} /> New Ingredient</>}
            </button>
            <button className="btn btn-primary" style={{ padding: '0.5rem 0.9rem', fontSize: '0.82rem' }} onClick={addRow}>
              <Plus size={13} /> Add Row
            </button>
          </div>
        </div>

        {showIngForm && (
          <div className="card-flat animate-slide-down" style={{ marginBottom: '1.25rem', borderColor: 'rgba(44,110,73,0.3)', border: '1px solid rgba(44,110,73,0.2)', background: 'var(--accent-light)' }}>
            <div className="section-label green">Quick Add to Database</div>
            <form onSubmit={saveIngredient} className="form-grid" style={{ marginTop: '0.75rem' }}>
              <div className="form-group"><label>Name</label><input required type="text" className="form-input" value={ingForm.name} onChange={e => setIngForm({...ingForm, name: e.target.value})} /></div>
              <div className="form-group"><label>Category</label><select className="form-input" value={ingForm.category} onChange={e => setIngForm({...ingForm, category: e.target.value})}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></div>
              <div className="form-group"><label>Calories / 100g</label><input required type="number" step="any" className="form-input" value={ingForm.calories_100g} onChange={e => setIngForm({...ingForm, calories_100g: e.target.value})} /></div>
              <div className="form-group"><label>Protein / 100g</label><input required type="number" step="any" className="form-input" value={ingForm.protein_100g} onChange={e => setIngForm({...ingForm, protein_100g: e.target.value})} /></div>
              <div className="form-group"><label>Carbs / 100g</label><input required type="number" step="any" className="form-input" value={ingForm.carbs_100g} onChange={e => setIngForm({...ingForm, carbs_100g: e.target.value})} /></div>
              <div className="form-group"><label>Fat / 100g</label><input required type="number" step="any" className="form-input" value={ingForm.fat_100g} onChange={e => setIngForm({...ingForm, fat_100g: e.target.value})} /></div>
              <div style={{ gridColumn: '1 / -1' }}>
                <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={ingSaving}>
                  {ingSaving ? 'Saving...' : 'Save & Continue'}
                </button>
              </div>
            </form>
          </div>
        )}

        {rows.length > 0 ? (
          <table className="data-table" style={{ marginTop: '0.5rem' }}>
            <thead><tr>
              <th style={{ width: '40%' }}>Ingredient</th>
              <th>Weight (g)</th>
              <th>Calories</th>
              <th>P / C / F</th>
              <th></th>
            </tr></thead>
            <tbody>
              {rows.map((row, i) => {
                const ing = ingredientsDB.find(x => x.id.toString() === row.db_id.toString());
                const r   = ing && row.weight_g ? parseFloat(row.weight_g) / 100 : 0;
                return (
                  <tr key={i}>
                    <td>
                      <select className="form-input" style={{ padding: '0.55rem 2.2rem 0.55rem 0.85rem', fontSize: '0.875rem' }}
                        value={row.db_id} onChange={e => updateRow(i, 'db_id', e.target.value)}>
                        <option value="">Select ingredient...</option>
                        {ingredientsDB.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
                      </select>
                    </td>
                    <td>
                      <input type="number" className="form-input" style={{ width: '90px', padding: '0.55rem 0.75rem' }}
                        value={row.weight_g} onChange={e => updateRow(i, 'weight_g', e.target.value)} />
                    </td>
                    <td style={{ fontWeight: 700, color: 'var(--accent)' }}>
                      {ing ? (ing.calories_100g * r).toFixed(0) : '—'}
                    </td>
                    <td style={{ fontSize: '0.82rem', color: 'var(--text-sub)' }}>
                      {ing ? <><span style={{ color: 'var(--blue)' }}>{(ing.protein_100g * r).toFixed(1)}</span> / <span style={{ color: 'var(--gold)' }}>{(ing.carbs_100g * r).toFixed(1)}</span> / <span style={{ color: 'var(--red)' }}>{(ing.fat_100g * r).toFixed(1)}</span>g</> : '—'}
                    </td>
                    <td>
                      <button className="btn-icon-danger" onClick={() => removeRow(i)}><Trash2 size={13} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-dim)', border: '1.5px dashed var(--border)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem' }}>
            <ChefHat size={28} strokeWidth={1.4} style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
            <p>Click <strong>+ Add Row</strong> to build your recipe</p>
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="card-tinted animate-fade-up">
        <div className="section-label green">Live Summary — Total / Per Portion (÷{p})</div>
        <div className="stats-row" style={{ marginTop: '0.75rem', marginBottom: '1.75rem' }}>
          <div className="stat-item">
            <div className="stat-value" style={{ color: 'var(--accent)' }}>{totCal.toFixed(0)}</div>
            <div className="stat-label">Calories</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--accent)', fontWeight: 600, marginTop: '0.25rem' }}>{(totCal / p).toFixed(0)} / portion</div>
          </div>
          <div className="stat-item" style={{ borderLeft: '1px solid rgba(44,110,73,0.2)' }}>
            <div className="stat-value" style={{ color: 'var(--blue)' }}>{totP.toFixed(1)}g</div>
            <div className="stat-label">Protein</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--blue)', fontWeight: 600, marginTop: '0.25rem' }}>{(totP / p).toFixed(1)}g / portion</div>
          </div>
          <div className="stat-item" style={{ borderLeft: '1px solid rgba(44,110,73,0.2)' }}>
            <div className="stat-value" style={{ color: 'var(--gold)' }}>{totC.toFixed(1)}g</div>
            <div className="stat-label">Carbs</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--gold)', fontWeight: 600, marginTop: '0.25rem' }}>{(totC / p).toFixed(1)}g / portion</div>
          </div>
          <div className="stat-item" style={{ borderLeft: '1px solid rgba(44,110,73,0.2)' }}>
            <div className="stat-value" style={{ color: 'var(--red)' }}>{totF.toFixed(1)}g</div>
            <div className="stat-label">Fat</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--red)', fontWeight: 600, marginTop: '0.25rem' }}>{(totF / p).toFixed(1)}g / portion</div>
          </div>
        </div>
        <button className="btn btn-primary" onClick={saveRecipe} disabled={saving} style={{ width: '100%', padding: '0.9rem', fontSize: '0.95rem' }}>
          {saving ? 'Saving...' : 'Update Recipe'}
        </button>
      </div>
    </main>
  );
}
