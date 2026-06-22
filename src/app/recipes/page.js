'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, BookOpen, Plus, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { showToast } from '../../components/ToastContainer';
import { useSupabaseRealtime } from '../../hooks/useSupabaseRealtime';

export default function RecipesPage() {
  const [recipes, setRecipes]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [expanded, setExpanded] = useState(null);

  async function fetchRecipes() {
    try {
      setRecipes(await (await fetch('/api/recipes')).json());
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchRecipes(); }, []);

  useSupabaseRealtime(
    ['recipes', 'recipe_ingredients', 'ingredients'],
    fetchRecipes
  );

  async function handleDelete(id) {
    await fetch(`/api/recipes/${id}`, { method: 'DELETE' });
    setRecipes(r => r.filter(x => x.id !== id));
    showToast('Recipe deleted');
  }

  return (
    <main>
      <div className="page-header" style={{ marginBottom: '2.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link href="/" className="btn-icon"><ArrowLeft size={18} /></Link>
          <Link href="/" style={{ textDecoration: 'none', color: 'inherit' }}>
            <h1 className="page-title animate-fade-up" style={{ fontSize: '3rem' }}>Recipes</h1>
          </Link>
        </div>
        <Link href="/recipes/new" className="btn btn-primary"><Plus size={16} /> New Recipe</Link>
      </div>

      {loading ? (
        <div className="card" style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-dim)' }}>Loading recipes...</div>
      ) : recipes.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '5rem' }}>
          <BookOpen size={40} strokeWidth={1.3} style={{ color: 'var(--text-dim)', marginBottom: '1rem' }} />
          <p style={{ color: 'var(--text-sub)', marginBottom: '1.5rem' }}>No recipes saved yet.</p>
          <Link href="/recipes/new" className="btn btn-primary"><Plus size={15} /> Create your first recipe</Link>
        </div>
      ) : (
        recipes.map((recipe, idx) => (
          <div key={recipe.id} className="card animate-fade-up" style={{ animationDelay: `${idx * 45}ms` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
              <div style={{ flex: 1 }}>
                <h2 style={{ fontFamily: "'Instrument Serif', serif", fontWeight: 400, fontSize: '1.35rem', letterSpacing: '-0.3px', marginBottom: '0.5rem' }}>
                  {recipe.name}
                </h2>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.85rem' }}>
                  <span className="badge badge-green">{recipe.portions} portion{recipe.portions !== 1 ? 's' : ''}</span>
                  <span className="badge badge-gray">{recipe.ingredients?.length || 0} ingredients</span>
                </div>
                <div className="macro-row">
                  <span style={{ color: 'var(--accent)', fontWeight: 700, fontSize: '0.95rem' }}>{Math.round(recipe.calsPerPortion)} kcal</span>
                  <span style={{ color: 'var(--border2)' }}>·</span>
                  <span style={{ color: 'var(--blue)' }}>P {recipe.pPerPortion.toFixed(1)}g</span>
                  <span style={{ color: 'var(--gold)' }}>C {recipe.cPerPortion.toFixed(1)}g</span>
                  <span style={{ color: 'var(--red)' }}>F {recipe.fPerPortion.toFixed(1)}g</span>
                  <span style={{ color: 'var(--text-dim)', fontSize: '0.78rem' }}>per portion</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                <Link href={`/recipes/${recipe.id}/edit`} className="btn-icon" title="Edit">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                </Link>
                <button className="btn-icon" title={expanded === recipe.id ? 'Hide' : 'Details'}
                  onClick={() => setExpanded(expanded === recipe.id ? null : recipe.id)}>
                  {expanded === recipe.id ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                </button>
                <button className="btn-icon-danger" title="Delete" onClick={() => handleDelete(recipe.id)}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            {expanded === recipe.id && recipe.ingredients?.length > 0 && (
              <div className="animate-slide-down" style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border)' }}>
                <div className="section-label">Ingredients Breakdown</div>
                <table className="data-table">
                  <thead><tr>
                    <th>Ingredient</th><th>Weight</th><th>Cal</th><th>Protein</th><th>Carbs</th><th>Fat</th>
                  </tr></thead>
                  <tbody>
                    {recipe.ingredients.map((ing, i) => {
                      const r = ing.weight_g / 100;
                      return (
                        <tr key={i}>
                          <td style={{ fontWeight: 500 }}>{ing.name}</td>
                          <td style={{ color: 'var(--text-sub)' }}>{ing.weight_g}g</td>
                          <td style={{ fontWeight: 700, color: 'var(--accent)' }}>{(ing.calories_100g * r).toFixed(0)}</td>
                          <td style={{ color: 'var(--blue)' }}>{(ing.protein_100g * r).toFixed(1)}g</td>
                          <td style={{ color: 'var(--gold)' }}>{(ing.carbs_100g * r).toFixed(1)}g</td>
                          <td style={{ color: 'var(--red)' }}>{(ing.fat_100g * r).toFixed(1)}g</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div style={{ marginTop: '1rem', paddingTop: '0.85rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '1rem', fontSize: '0.85rem', color: 'var(--text-sub)' }}>
                  <span>Totals:</span>
                  <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{Math.round(recipe.totalCals)} kcal</span>
                  <span>P {recipe.totalP.toFixed(1)}g · C {recipe.totalC.toFixed(1)}g · F {recipe.totalF.toFixed(1)}g</span>
                </div>
              </div>
            )}
          </div>
        ))
      )}
    </main>
  );
}
