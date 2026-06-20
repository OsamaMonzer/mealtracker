'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus, Pencil, Trash2, Search, SlidersHorizontal, Carrot, Check, X } from 'lucide-react';
import { showToast } from '../../components/ToastContainer';

const CATEGORIES = ['Protein', 'Carb', 'Fat', 'Vegetable', 'Fruit', 'Sauce', 'Dairy', 'Other'];
const blank = { name: '', category: 'Protein', brand: '', status: 'Raw', calories_100g: '', protein_100g: '', carbs_100g: '', fat_100g: '', price_kg: '', notes: '' };

const CAT_CLASS = {
  Protein: 'badge-blue', Carb: 'badge-gold', Fat: 'badge-red',
  Vegetable: 'badge-green', Fruit: 'badge-red', Dairy: 'badge-gray',
  Sauce: 'badge-gray', Other: 'badge-gray',
};

export default function IngredientsPage() {
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState(blank);
  const [editId, setEditId]     = useState(null);
  const [search, setSearch]     = useState('');
  const [filterCat, setFilterCat] = useState('All');
  const [error, setError]       = useState('');
  const [seeding, setSeeding]   = useState(false);

  useEffect(() => { fetchIngredients(); }, []);

  async function fetchIngredients() {
    try {
      setError('');
      const res = await fetch('/api/ingredients');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not load ingredients');
      if (!Array.isArray(data)) throw new Error('Ingredients API did not return a list');
      setIngredients(data);
    }
    catch(e) { console.error(e); setError(e.message); setIngredients([]); } finally { setLoading(false); }
  }

  async function seedIngredients() {
    try {
      setSeeding(true);
      setError('');
      const res = await fetch('/api/seed');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not load starter ingredients');
      showToast(`Starter ingredients loaded (${data.added} added)`);
      await fetchIngredients();
    } catch (e) {
      console.error(e);
      setError(e.message);
    } finally {
      setSeeding(false);
    }
  }

  function openAdd()    { setEditId(null); setForm(blank); setShowForm(true); }
  function openEdit(i)  {
    setEditId(i.id);
    setForm({ name: i.name, category: i.category, brand: i.brand || '', status: i.status,
      calories_100g: i.calories_100g, protein_100g: i.protein_100g, carbs_100g: i.carbs_100g, fat_100g: i.fat_100g,
      price_kg: i.price_kg || '', notes: i.notes || '' });
    setShowForm(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const url = editId ? `/api/ingredients/${editId}` : '/api/ingredients';
    const method = editId ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    if (res.ok) { 
      setShowForm(false); 
      setForm(blank); 
      setEditId(null); 
      fetchIngredients(); 
      showToast(editId ? 'Ingredient updated' : 'Ingredient added');
    }
    else { const e = await res.json(); alert('Error: ' + e.error); }
  }

  async function handleDelete(id) {
    await fetch(`/api/ingredients/${id}`, { method: 'DELETE' });
    fetchIngredients();
    showToast('Ingredient deleted');
  }

  const visible = ingredients.filter(i =>
    i.name.toLowerCase().includes(search.toLowerCase()) &&
    (filterCat === 'All' || i.category === filterCat)
  );

  return (
    <main>
      <div className="page-header" style={{ marginBottom: '2.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link href="/" className="btn-icon"><ArrowLeft size={18} /></Link>
          <Link href="/" style={{ textDecoration: 'none', color: 'inherit' }}>
            <h1 className="page-title animate-fade-up" style={{ fontSize: '3rem' }}>Ingredients</h1>
          </Link>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', paddingTop: '0.5rem' }}>
          <button className="btn btn-primary" onClick={showForm && !editId ? () => setShowForm(false) : openAdd}>
            {showForm && !editId ? 'Cancel' : <><Plus size={15} /> Add Ingredient</>}
          </button>
        </div>
      </div>

      {/* Add Form (Only for new items now) */}
      {showForm && !editId && (
        <div className="card animate-slide-down" style={{ borderColor: 'var(--accent)', marginBottom: '2rem' }}>
          <div className="section-label green">New Ingredient</div>
          <form onSubmit={handleSubmit} className="form-grid">
            {[
              { key: 'name', label: 'Name', ph: 'Chicken Breast', type: 'text', req: true },
              { key: 'brand', label: 'Brand', ph: '', type: 'text', req: false },
            ].map(f => (
              <div key={f.key} className="form-group">
                <label>{f.label}</label>
                <input required={f.req} type={f.type} className="form-input" placeholder={f.ph}
                  value={form[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.value })} />
              </div>
            ))}
            <div className="form-group">
              <label>Category</label>
              <select className="form-input" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Status</label>
              <select className="form-input" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                <option>Raw</option><option>Cooked</option>
              </select>
            </div>
            {['calories_100g', 'protein_100g'].map(key => (
              <div key={key} className="form-group">
                <label>{key.replace('_100g', '').replace('_', ' ')} / 100g</label>
                <input required type="number" step="any" className="form-input" value={form[key]}
                  onChange={e => setForm({ ...form, [key]: e.target.value })} />
              </div>
            ))}
            {['carbs_100g', 'fat_100g'].map(key => (
              <div key={key} className="form-group">
                <label>{key.replace('_100g', '').replace('_', ' ')} / 100g <span style={{color:'var(--text-dim)',fontWeight:400}}>(opt)</span></label>
                <input type="number" step="any" className="form-input" value={form[key]}
                  onChange={e => setForm({ ...form, [key]: e.target.value })} />
              </div>
            ))}
            <div className="form-group">
              <label>Price / kg (opt)</label>
              <input type="number" step="any" className="form-input" value={form.price_kg}
                onChange={e => setForm({ ...form, price_kg: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Notes</label>
              <input type="text" className="form-input" value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button type="submit" className="btn btn-primary" style={{ flex: 1, padding: '0.8rem' }}>Save Ingredient</button>
              <button type="button" className="btn" onClick={() => { setShowForm(false); setEditId(null); }}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Filter bar */}
      <div className="card-flat" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
        <div style={{ position: 'relative', flex: 2, minWidth: '160px' }}>
          <Search size={14} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
          <input type="text" className="form-input" style={{ paddingLeft: '2.25rem' }} placeholder="Search ingredients..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div style={{ position: 'relative', minWidth: '150px' }}>
          <SlidersHorizontal size={13} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)', pointerEvents: 'none' }} />
          <select className="form-input" style={{ paddingLeft: '2.25rem' }} value={filterCat} onChange={e => setFilterCat(e.target.value)}>
            <option value="All">All Categories</option>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>{visible.length} items</span>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <p style={{ color: 'var(--text-dim)', padding: '3rem', textAlign: 'center' }}>Loading ingredients...</p>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-dim)' }}>
            <Carrot size={36} strokeWidth={1.5} style={{ marginBottom: '0.75rem', opacity: 0.5 }} />
            <p style={{ marginBottom: '1rem' }}>Could not load ingredients.</p>
            <p style={{ maxWidth: '32rem', margin: '0 auto 1.25rem', fontSize: '0.85rem' }}>{error}</p>
            <button className="btn btn-primary" onClick={fetchIngredients}>Try Again</button>
          </div>
        ) : visible.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-dim)' }}>
            <Carrot size={36} strokeWidth={1.5} style={{ marginBottom: '0.75rem', opacity: 0.5 }} />
            <p style={{ marginBottom: '1rem' }}>No ingredients found.</p>
            {!search && filterCat === 'All' && (
              <button className="btn btn-primary" onClick={seedIngredients} disabled={seeding}>
                {seeding ? 'Loading...' : 'Load Starter Ingredients'}
              </button>
            )}
          </div>
        ) : (
          <table className="data-table" style={{ margin: 0 }}>
            <thead>
              <tr>
                <th style={{ paddingLeft: '1.75rem' }}>Name</th>
                <th>Category</th>
                <th>Cal/100g</th>
                <th>Protein</th>
                <th>Carbs</th>
                <th>Fat</th>
                <th>Status</th>
                <th style={{ paddingRight: '1.75rem', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(ing => (
                <tr key={ing.id} className="animate-fade-up">
                  {editId === ing.id ? (
                    <td colSpan="8" style={{ padding: '0' }}>
                      <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: 'minmax(150px, 2fr) 1fr 60px 60px 60px 60px 70px 100px', gap: '0.5rem', padding: '0.75rem', background: 'var(--surface2)', alignItems: 'center' }}>
                        <input required type="text" className="form-input" style={{ padding: '0.4rem 0.6rem' }} placeholder="Name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
                        <select className="form-input" style={{ padding: '0.4rem 0.6rem' }} value={form.category} onChange={e => setForm({...form, category: e.target.value})}>
                          {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                        </select>
                        <input required type="number" step="any" className="form-input" style={{ padding: '0.4rem 0.2rem', textAlign: 'center' }} value={form.calories_100g} onChange={e => setForm({...form, calories_100g: e.target.value})} />
                        <input required type="number" step="any" className="form-input" style={{ padding: '0.4rem 0.2rem', textAlign: 'center' }} value={form.protein_100g} onChange={e => setForm({...form, protein_100g: e.target.value})} />
                        <input required type="number" step="any" className="form-input" style={{ padding: '0.4rem 0.2rem', textAlign: 'center' }} value={form.carbs_100g} onChange={e => setForm({...form, carbs_100g: e.target.value})} />
                        <input required type="number" step="any" className="form-input" style={{ padding: '0.4rem 0.2rem', textAlign: 'center' }} value={form.fat_100g} onChange={e => setForm({...form, fat_100g: e.target.value})} />
                        <select className="form-input" style={{ padding: '0.4rem 0.6rem' }} value={form.status} onChange={e => setForm({...form, status: e.target.value})}><option>Raw</option><option>Cooked</option></select>
                        <div style={{ display: 'flex', gap: '0.2rem', justifyContent: 'flex-end' }}>
                          <button type="submit" className="btn-icon" style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}><Check size={13} /></button>
                          <button type="button" className="btn-icon" onClick={() => setEditId(null)}><X size={13} /></button>
                        </div>
                      </form>
                    </td>
                  ) : (
                    <>
                      <td style={{ paddingLeft: '1.75rem' }}>
                        <div style={{ fontWeight: 600 }}>{ing.name}</div>
                        {ing.brand && <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.1rem' }}>{ing.brand}</div>}
                      </td>
                      <td><span className={`badge ${CAT_CLASS[ing.category] || 'badge-gray'}`}>{ing.category}</span></td>
                      <td style={{ fontWeight: 700, color: 'var(--accent)' }}>{ing.calories_100g}</td>
                      <td style={{ color: 'var(--blue)' }}>{ing.protein_100g}g</td>
                      <td style={{ color: 'var(--gold)' }}>{ing.carbs_100g}g</td>
                      <td style={{ color: 'var(--red)' }}>{ing.fat_100g}g</td>
                      <td style={{ color: 'var(--text-dim)', fontSize: '0.82rem' }}>{ing.status}</td>
                      <td style={{ paddingRight: '1.75rem', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                          <button className="btn-icon" title="Edit" onClick={() => openEdit(ing)}><Pencil size={13} /></button>
                          <button className="btn-icon-danger" title="Delete" onClick={() => handleDelete(ing.id)}><Trash2 size={13} /></button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}
