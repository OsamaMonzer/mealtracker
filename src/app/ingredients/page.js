'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, Pencil, Trash2, Search, SlidersHorizontal, Carrot, Check, X, AlertTriangle, ScanBarcode } from 'lucide-react';
import { showToast } from '../../components/ToastContainer';
import { useSupabaseRealtime } from '../../hooks/useSupabaseRealtime';

const CATEGORIES = ['Protein', 'Carb', 'Fat', 'Vegetable', 'Fruit', 'Sauce', 'Dairy', 'Other'];
const blank = { name: '', category: 'Protein', brand: '', status: 'Raw', serving_g: '', calories_100g: '', protein_100g: '', carbs_100g: '', fat_100g: '', price_kg: '', notes: '' };

const CAT_CLASS = {
  Protein: 'badge-blue', Carb: 'badge-gold', Fat: 'badge-red',
  Vegetable: 'badge-green', Fruit: 'badge-red', Dairy: 'badge-gray',
  Sauce: 'badge-gray', Other: 'badge-gray',
};

function hasZeroNutrition(r) {
  const fields = [r.calories_100g, r.protein_100g, r.carbs_100g, r.fat_100g];
  return fields.every(v => v === null || v === undefined || v === '' || Number(v) === 0);
}

export default function IngredientsPage() {
  const searchParams = useSearchParams();

  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState(blank);
  const [editId, setEditId]     = useState(null);
  const [search, setSearch]     = useState('');
  const [extQuery, setExtQuery] = useState('');
  const [extResults, setExtResults] = useState([]);
  const [extLoading, setExtLoading] = useState(false);
  const [showExt, setShowExt] = useState(false);
  const [filterCat, setFilterCat] = useState('All');
  const [error, setError]       = useState('');
  const [seeding, setSeeding]   = useState(false);
  const ingredientsRef          = useRef([]);
  const [highlightedId, setHighlightedId] = useState(null);
  const [scanStatus, setScanStatus] = useState(''); // 'scanning' | 'importing' | 'zero' | ''
  const barcodeHandled = useRef(false);

  useEffect(() => { fetchIngredients(); }, []);

  useSupabaseRealtime(['ingredients'], () => fetchIngredients(true));

  // ── Barcode callback from Shortcut ──────────────────────────────────────────
  useEffect(() => {
    const barcode = searchParams.get('barcode');
    if (!barcode || barcodeHandled.current) return;
    barcodeHandled.current = true;

    // clean up URL without reload
    const url = new URL(window.location.href);
    url.searchParams.delete('barcode');
    window.history.replaceState({}, '', url.toString());

    handleBarcodeImport(barcode);
  }, [searchParams]);

  async function handleBarcodeImport(barcode) {
    setScanStatus('importing');
    try {
      const res = await fetch(`/api/ingredients/search?barcode=${encodeURIComponent(barcode.trim())}`);
      const data = await res.json();
      const results = Array.isArray(data) ? data.filter(Boolean) : [];

      if (results.length === 0) {
        setScanStatus('');
        showToast('No product found for that barcode');
        // Open blank add form so user can enter manually
        setEditId(null);
        setForm({ ...blank });
        setShowForm(true);
        return;
      }

      const r = results[0];
      const servingVal = r.serving_label || (r.serving_grams ? String(r.serving_grams) : '100');
      const importedForm = {
        ...blank,
        name: r.name,
        brand: r.brand || '',
        category: r.category || 'Other',
        status: 'Raw',
        serving_g: servingVal,
        calories_100g: r.calories_100g ?? '',
        protein_100g: r.protein_100g ?? '',
        carbs_100g: r.carbs_100g ?? '',
        fat_100g: r.fat_100g ?? '',
        price_kg: '',
        notes: '',
      };

      const isZero = hasZeroNutrition(r);

      if (isZero) {
        // Save the ingredient first, then open it in edit mode
        const saveRes = await fetch('/api/ingredients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...importedForm,
            calories_100g: 0,
            protein_100g: 0,
            carbs_100g: 0,
            fat_100g: 0,
          }),
        });

        if (saveRes.ok) {
          const saved = await saveRes.json();
          await fetchIngredients();
          setScanStatus('zero');
          showToast('⚠️ Nutrition data missing — edit to fill in values');
          // Find the saved ingredient and open inline edit
          setTimeout(() => {
            const savedId = saved?.id || saved?.[0]?.id;
            if (savedId) {
              const ing = {
                id: savedId,
                ...importedForm,
                calories_100g: 0,
                protein_100g: 0,
                carbs_100g: 0,
                fat_100g: 0,
              };
              setEditId(savedId);
              setForm({
                name: ing.name,
                category: ing.category,
                brand: ing.brand || '',
                status: ing.status,
                calories_100g: '',
                protein_100g: '',
                carbs_100g: '',
                fat_100g: '',
                serving_g: ing.serving_g || '',
                price_kg: '',
                notes: '',
              });
              setHighlightedId(savedId);
              // Scroll to ingredient row
              setTimeout(() => {
                const el = document.getElementById(`ing-row-${savedId}`);
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }, 300);
            } else {
              // Fallback: open add form prefilled
              setForm(importedForm);
              setEditId(null);
              setShowForm(true);
            }
            setScanStatus('');
          }, 400);
        }
      } else {
        // Good data — open add form prefilled for confirmation
        setForm(importedForm);
        setEditId(null);
        setShowForm(true);
        setScanStatus('');
        showToast('Product found — review and save');
      }
    } catch (e) {
      console.error(e);
      setScanStatus('');
      showToast('Error looking up barcode');
    }
  }

  // ── Scan Barcode button ─────────────────────────────────────────────────────
  function launchBarcodeScan() {
    const returnUrl = encodeURIComponent(`${window.location.origin}/ingredients?barcode=`);
    // The Shortcut must be named exactly "MealTracker Scan Barcode"
    // It scans a barcode then opens: [returnUrl][scanned barcode value]
    const shortcutName = encodeURIComponent('MealTracker Scan Barcode');
    window.location.href = `shortcuts://x-callback-url/run-shortcut?name=${shortcutName}&x-success=${returnUrl}`;
  }

  // ── Existing functions ──────────────────────────────────────────────────────
  async function fetchIngredients(silent = false) {
    try {
      if (!silent) setError('');
      const res = await fetch('/api/ingredients?ts=' + Date.now(), { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not load ingredients');
      if (!Array.isArray(data)) throw new Error('Ingredients API did not return a list');

      const newStr = JSON.stringify(data);
      const oldStr = JSON.stringify(ingredientsRef.current);

      if (newStr !== oldStr) {
        setIngredients(data);
        ingredientsRef.current = data;
      }
    }
    catch(e) {
      console.error(e);
      if (!silent) { setError(e.message); setIngredients([]); }
    } finally {
      setLoading(false);
    }
  }

  function openAdd()    { setEditId(null); setForm(blank); setShowForm(true); }
  function openEdit(i)  {
    setEditId(i.id);
    setForm({ name: i.name, category: i.category, brand: i.brand || '', status: i.status,
      calories_100g: i.calories_100g, protein_100g: i.protein_100g, carbs_100g: i.carbs_100g, fat_100g: i.fat_100g,
      serving_g: i.serving_label || (i.serving_grams ? String(i.serving_grams) : ''), price_kg: i.price_kg || '', notes: i.notes || '' });
    setShowForm(true);
  }

  function nutritionPayload() {
    const toNumOrEmpty = v => {
      const n = parseFloat(v);
      return Number.isFinite(n) ? n : '';
    };
    return {
      ...form,
      calories_100g: toNumOrEmpty(form.calories_100g),
      protein_100g: toNumOrEmpty(form.protein_100g),
      carbs_100g: toNumOrEmpty(form.carbs_100g),
      fat_100g: toNumOrEmpty(form.fat_100g),
    };
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const url = editId ? `/api/ingredients/${editId}` : '/api/ingredients';
    const method = editId ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(nutritionPayload()) });
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
          {/* Scan Barcode button */}
          <button
            className="btn"
            onClick={launchBarcodeScan}
            title="Scan barcode via Shortcuts"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <ScanBarcode size={15} />
            Scan
          </button>
          <button className="btn btn-primary" onClick={showForm && !editId ? () => setShowForm(false) : openAdd}>
            {showForm && !editId ? 'Cancel' : <><Plus size={15} /> Add Ingredient</>}
          </button>
        </div>
      </div>

      {/* Scan status banner */}
      {scanStatus === 'importing' && (
        <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '10px', padding: '0.75rem 1rem', marginBottom: '1.25rem', fontSize: '0.88rem', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⏳</span>
          Looking up barcode…
        </div>
      )}
      {scanStatus === 'zero' && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px', padding: '0.75rem 1rem', marginBottom: '1.25rem', fontSize: '0.88rem', color: '#92400e', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertTriangle size={15} />
          Nutrition data was missing — the ingredient was added below. Fill in the values to complete it.
        </div>
      )}

      {/* Add Form */}
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
            <div className="form-group">
              <label>Serving (e.g. "1 egg", optional)</label>
              <input type="text" className="form-input" placeholder="1 egg or 100" value={form.serving_g}
                onChange={e => setForm({ ...form, serving_g: e.target.value })} />
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
            <div style={{ gridColumn: '1 / -1', fontSize: '0.8rem', color: 'var(--text-dim)', marginTop: '-0.5rem' }}>
              These values will be saved as nutrition per 100g.
            </div>
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
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button className="btn" onClick={() => setShowExt(s => !s)}>{showExt ? 'Hide DB Search' : 'Search DB'}</button>
        </div>
        <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>{visible.length} items</span>
      </div>

      {showExt && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div style={{ marginBottom: '0.5rem', fontSize: '0.8rem', color: 'var(--text-dim)' }}>
            Search by name or paste a barcode number (8–14 digits)
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input
              className="form-input"
              placeholder="e.g. Chicken Breast or 5000112637922"
              value={extQuery}
              onChange={e => setExtQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && e.currentTarget.nextElementSibling?.click()}
              style={{ flex: 1 }}
            />
            <button className="btn" onClick={async () => {
              try {
                setExtLoading(true); setExtResults([]);
                const q = extQuery.trim();
                if (!q) { setExtResults([]); return; }
                const isBarcode = /^\d{8,14}$/.test(q);
                const url = isBarcode
                  ? `/api/ingredients/search?barcode=${encodeURIComponent(q)}`
                  : `/api/ingredients/search?q=${encodeURIComponent(q)}`;
                const res = await fetch(url).then(r => r.json()).catch(() => []);
                const all = Array.isArray(res) ? res.filter(Boolean) : [];
                const normalize = n => (n || '').toString().trim().toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ');
                const map = new Map();
                for (const item of all) {
                  const key = normalize(item.name || '') || Math.random().toString(36).slice(2, 9);
                  if (!map.has(key)) map.set(key, { ...item, sources: new Set([item.source || 'openfoodfacts']) });
                  else {
                    const ex = map.get(key);
                    for (const f of ['calories_100g', 'protein_100g', 'carbs_100g', 'fat_100g', 'serving_label', 'serving_grams']) {
                      if ((ex[f] === undefined || ex[f] === '' || ex[f] === null) && (item[f] !== undefined && item[f] !== null && item[f] !== '')) ex[f] = item[f];
                    }
                    if (!ex.brand && item.brand) ex.brand = item.brand;
                    ex.sources.add(item.source || 'openfoodfacts');
                  }
                }
                const merged = Array.from(map.values()).map(it => ({ ...it, source: Array.from(it.sources).join(','), id: it.id || Math.random().toString(36).slice(2, 9) }));
                setExtResults(merged);
              } catch (e) { console.error(e); setExtResults([]); }
              finally { setExtLoading(false); }
            }}>{extLoading ? 'Searching...' : 'Search'}</button>
          </div>
          <div style={{ marginTop: '0.75rem' }}>
            {extResults.length === 0 && !extLoading ? (
              <div style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>No results</div>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {extResults.map(r => (
                  <li key={`${r.source || 'off'}-${r.id}`} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.6rem 0', borderBottom: '1px solid var(--surface2)', gap: '0.5rem', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{r.name}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                        {r.brand || ''}{r.brand && r.serving_label ? ' · ' : ''}{r.serving_label ? r.serving_label : r.serving_grams ? `${r.serving_grams}g` : ''}
                      </div>
                      {r.nutrition_incomplete && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.3rem', fontSize: '0.75rem', color: '#b45309', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '6px', padding: '0.2rem 0.5rem', width: 'fit-content' }}>
                          <AlertTriangle size={11} />
                          Nutrition data missing from source
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexShrink: 0 }}>
                      <div style={{ textAlign: 'right', fontSize: '0.88rem' }}>
                        <div style={{ fontWeight: 700, color: r.nutrition_incomplete ? 'var(--text-dim)' : 'var(--accent)' }}>
                          {r.calories_100g !== null && r.calories_100g !== undefined ? r.calories_100g : '—'} kcal
                        </div>
                        {r.protein_100g !== null && <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>{r.protein_100g}g protein</div>}
                      </div>
                      <button className="btn" onClick={() => {
                        const servingVal = r.serving_label || (r.serving_grams ? String(r.serving_grams) : '100');
                        setForm({ ...blank, name: r.name, brand: r.brand || '', category: r.category || 'Other', status: 'Raw', serving_g: servingVal, calories_100g: r.calories_100g ?? '', protein_100g: r.protein_100g ?? '', carbs_100g: r.carbs_100g ?? '', fat_100g: r.fat_100g ?? '', price_kg: '', notes: '' });
                        setShowForm(true);
                        setShowExt(false);
                      }}>Import</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

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
          </div>
        ) : (
          <table className="data-table" style={{ margin: 0 }}>
            <thead>
              <tr>
                <th style={{ paddingLeft: '1.75rem', textAlign: 'left' }}>Name</th>
                <th style={{ textAlign: 'center' }}>Category</th>
                <th style={{ textAlign: 'center' }}>Cal</th>
                <th style={{ textAlign: 'center' }}>Protein</th>
                <th style={{ textAlign: 'center' }}>Carbs</th>
                <th style={{ textAlign: 'center' }}>Fat</th>
                <th style={{ textAlign: 'center' }}>Status</th>
                <th style={{ paddingRight: '1.75rem', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(ing => (
                <tr key={ing.id} id={`ing-row-${ing.id}`} className="animate-fade-up">
                  {editId === ing.id ? (
                    <td colSpan="8" style={{ padding: '0' }}>
                      <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 60px 60px 60px 60px 70px 100px', gap: '0.5rem', padding: '0.75rem', background: 'var(--surface2)', alignItems: 'center' }}>
                        <input required type="text" className="form-input" style={{ padding: '0.4rem 0.6rem' }} placeholder="Name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
                        <select className="form-input" style={{ padding: '0.4rem 0.6rem' }} value={form.category} onChange={e => setForm({...form, category: e.target.value})}>
                          {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                        </select>
                        <input autoFocus required type="number" step="any" className="form-input" style={{ padding: '0.4rem 0.2rem', textAlign: 'center', borderColor: !form.calories_100g ? '#f59e0b' : undefined }} placeholder="kcal" value={form.calories_100g} onChange={e => setForm({...form, calories_100g: e.target.value})} />
                        <input required type="number" step="any" className="form-input" style={{ padding: '0.4rem 0.2rem', textAlign: 'center', borderColor: !form.protein_100g ? '#f59e0b' : undefined }} placeholder="prot" value={form.protein_100g} onChange={e => setForm({...form, protein_100g: e.target.value})} />
                        <input required type="number" step="any" className="form-input" style={{ padding: '0.4rem 0.2rem', textAlign: 'center', borderColor: !form.carbs_100g ? '#f59e0b' : undefined }} placeholder="carbs" value={form.carbs_100g} onChange={e => setForm({...form, carbs_100g: e.target.value})} />
                        <input required type="number" step="any" className="form-input" style={{ padding: '0.4rem 0.2rem', textAlign: 'center', borderColor: !form.fat_100g ? '#f59e0b' : undefined }} placeholder="fat" value={form.fat_100g} onChange={e => setForm({...form, fat_100g: e.target.value})} />
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
                        <div style={{ fontWeight: 600, background: highlightedId === ing.id ? 'linear-gradient(90deg, rgba(255,251,230,0.9), rgba(255,255,255,0))' : 'transparent', padding: highlightedId === ing.id ? '0.15rem 0.35rem' : 0, borderRadius: '4px' }}>{ing.name}</div>
                        {ing.brand && <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.1rem' }}>{ing.brand}</div>}
                      </td>
                      <td><span className={`badge ${CAT_CLASS[ing.category] || 'badge-gray'}`}>{ing.category}</span></td>
                      <td style={{ fontWeight: 700, color: 'var(--accent)' }}>
                        {ing.calories_100g}
                        {ing.serving_label ? (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>per {ing.serving_label}</div>
                        ) : ing.serving_grams ? (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>per {ing.serving_grams}g</div>
                        ) : (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>per 100g</div>
                        )}
                      </td>
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
