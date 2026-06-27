'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { Carrot, BookOpen, UtensilsCrossed, Scale, TrendingDown, ChefHat, Flame, Beef, ChevronLeft, ChevronRight, X, Calendar, ImageIcon, RefreshCw, Trash2, Target, Zap, Settings, Camera, Loader2, Plus, Minus, CheckCircle2 } from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, ComposedChart, ReferenceLine,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import { useSupabaseRealtime } from '../hooks/useSupabaseRealtime';
import { showToast } from '../components/ToastContainer';

// ── Streak calculator ─────────────────────────────────────────────────────
function calcStreak(allDates) {
  if (!allDates || allDates.length === 0) return 0;
  const today = new Date().toISOString().split('T')[0];
  const dateSet = new Set(allDates);
  let streak = 0;
  let cursor = new Date();
  if (!dateSet.has(today)) cursor.setDate(cursor.getDate() - 1);
  while (true) {
    const d = cursor.toISOString().split('T')[0];
    if (!dateSet.has(d)) break;
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

// ── Weight insight helpers ─────────────────────────────────────────────────
function calcWeightInsights(weightLogData, WEIGHT_TARGET) {
  if (!weightLogData || weightLogData.length < 2) return null;
  const last = weightLogData[weightLogData.length - 1];
  const weekAgoIdx = Math.max(0, weightLogData.length - 8);
  const weekAgo = weightLogData[weekAgoIdx];
  const weeklyDiff = +(last.Weight - weekAgo.Weight).toFixed(2);
  const n = weightLogData.length;
  const xs = weightLogData.map((_, i) => i);
  const ys = weightLogData.map(d => d.Weight);
  const sumX = xs.reduce((a, b) => a + b, 0);
  const sumY = ys.reduce((a, b) => a + b, 0);
  const sumXY = xs.reduce((s, x, i) => s + x * ys[i], 0);
  const sumX2 = xs.reduce((s, x) => s + x * x, 0);
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  let projectedDate = null;
  const currentWeight = last.Weight;
  const isLosing = slope < 0 && currentWeight > WEIGHT_TARGET;
  const isGaining = slope > 0 && currentWeight < WEIGHT_TARGET;
  if ((isLosing || isGaining) && Math.abs(slope) > 0.001) {
    const stepsNeeded = (WEIGHT_TARGET - intercept) / slope;
    const daysFromStart = stepsNeeded - (n - 1);
    if (daysFromStart > 0 && daysFromStart < 1000) {
      const d = new Date();
      d.setDate(d.getDate() + Math.round(daysFromStart));
      projectedDate = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
  }
  const height = 1.75;
  const bmi = +(currentWeight / (height * height)).toFixed(1);
  return { weeklyDiff, projectedDate, currentWeight, bmi, slope };
}

// ── Photo Preview Modal ────────────────────────────────────────────────────
function PhotoModal({ log, onClose, onDeletePhoto, onReplacePhoto }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [working, setWorking] = useState(false);
  const replaceRef = useRef(null);
  if (!log) return null;
  const label = new Date(log.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  async function handleDeletePhoto() {
    setWorking(true);
    await onDeletePhoto(log);
    setWorking(false);
    onClose();
  }
  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setWorking(true);
    await onReplacePhoto(log, file);
    setWorking(false);
    onClose();
  }
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '20px', maxWidth: '480px', width: '100%', overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,0.5)' }}>
        <div style={{ position: 'relative' }}>
          <img src={log.photo_url} alt={`Progress photo ${label}`} style={{ width: '100%', display: 'block', maxHeight: '65vh', objectFit: 'cover' }} />
          <button onClick={onClose} style={{ position: 'absolute', top: '0.75rem', right: '0.75rem', background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff' }}><X size={18} /></button>
        </div>
        <div style={{ padding: '1rem 1.25rem 0.5rem' }}>
          <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: '1.2rem', color: '#111' }}>{label}</div>
          <div style={{ fontSize: '0.85rem', color: '#999', marginTop: '0.2rem' }}>{log.weight_kg} kg</div>
        </div>
        <div style={{ padding: '0.5rem 1.25rem 1.25rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <input ref={replaceRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} id="home-replace-photo-input" />
          <label htmlFor="home-replace-photo-input" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'var(--surface2, #f3f4f6)', border: '1px solid var(--border, #e5e7eb)', borderRadius: '10px', padding: '0.55rem 1rem', cursor: working ? 'not-allowed' : 'pointer', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main, #111)', opacity: working ? 0.5 : 1, flex: 1, justifyContent: 'center' }}>
            <RefreshCw size={14} />{working ? 'Working…' : 'Replace Photo'}
          </label>
          {!confirmDelete ? (
            <button onClick={() => setConfirmDelete(true)} disabled={working} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#fff0f0', border: '1px solid #fca5a5', borderRadius: '10px', padding: '0.55rem 1rem', cursor: working ? 'not-allowed' : 'pointer', fontSize: '0.85rem', fontWeight: 600, color: '#dc2626', flex: 1, justifyContent: 'center' }}>
              <Trash2 size={14} />Delete Photo
            </button>
          ) : (
            <button onClick={handleDeletePhoto} disabled={working} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#dc2626', border: 'none', borderRadius: '10px', padding: '0.55rem 1rem', cursor: working ? 'not-allowed' : 'pointer', fontSize: '0.85rem', fontWeight: 600, color: '#fff', flex: 1, justifyContent: 'center' }}>
              <Trash2 size={14} />{working ? 'Deleting…' : 'Confirm Delete'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Day History Modal ──────────────────────────────────────────────────────
function DayModal({ date, onClose, GOAL }) {
  const [dayData, setDayData] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!date) return;
    setLoading(true);
    fetch(`/api/history?date=${date}`)
      .then(r => r.json())
      .then(d => { setDayData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [date]);
  if (!date) return null;
  const label = new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const isToday = date === new Date().toISOString().split('T')[0];
  const mealGroups = {};
  (dayData?.logs || []).forEach(log => {
    const mt = log.meal_type || 'Other';
    if (!mealGroups[mt]) mealGroups[mt] = [];
    mealGroups[mt].push(log);
  });
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#ffffff', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: '640px', maxHeight: '88vh', minHeight: '200px', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 -8px 48px rgba(0,0,0,0.3)', position: 'relative' }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '0.75rem 0 0', background: '#ffffff' }}>
          <div style={{ width: '40px', height: '4px', borderRadius: '2px', background: '#e0e0e0' }} />
        </div>
        <div style={{ padding: '1rem 1.5rem 0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #efefef', background: '#ffffff' }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#999', marginBottom: '0.2rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{isToday ? 'Today' : 'History'}</div>
            <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: '1.4rem', lineHeight: 1.2, color: '#111' }}>{label}</div>
          </div>
          <button onClick={onClose} style={{ background: '#f3f3f3', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#666', flexShrink: 0 }}><X size={16} /></button>
        </div>
        {dayData?.totals && (
          <div style={{ display: 'flex', borderBottom: '1px solid #efefef', background: '#fafafa' }}>
            {[
              { label: 'Calories', val: dayData.totals.cals, color: dayData.totals.cals > GOAL ? '#e53935' : '#2e7d32' },
              { label: 'Protein', val: dayData.totals.p + 'g', color: '#1565c0' },
              { label: 'Carbs', val: dayData.totals.c + 'g', color: '#e65100' },
              { label: 'Fat', val: dayData.totals.f + 'g', color: '#c62828' },
            ].map((s, i) => (
              <div key={i} style={{ flex: 1, padding: '0.75rem 0.5rem', textAlign: 'center', borderRight: i < 3 ? '1px solid #efefef' : 'none' }}>
                <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: '1.3rem', color: s.color, lineHeight: 1 }}>{s.val}</div>
                <div style={{ fontSize: '0.7rem', color: '#999', marginTop: '0.2rem' }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}
        <div style={{ overflowY: 'auto', flex: 1, padding: '1rem 1.5rem 2rem', background: '#ffffff' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#999', fontSize: '0.9rem' }}>Loading…</div>
          ) : !dayData?.logs?.length ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#999', fontSize: '0.9rem' }}>
              <Beef size={32} strokeWidth={1.5} style={{ margin: '0 auto 0.75rem', color: '#ccc' }} />
              No meals logged this day
            </div>
          ) : (
            Object.entries(mealGroups).map(([mealType, meals]) => (
              <div key={mealType} style={{ marginBottom: '1.5rem' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#999', marginBottom: '0.6rem' }}>{mealType}</div>
                {meals.map(log => (
                  <div key={log.id} style={{ background: '#f7f7f7', borderRadius: '12px', padding: '0.9rem 1rem', marginBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', flex: 1, marginRight: '0.5rem', color: '#111' }}>{log.recipe_name}</div>
                      <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: '1.1rem', color: '#2e7d32', whiteSpace: 'nowrap' }}>{log.calories} kcal</div>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '0.4rem', fontSize: '0.78rem' }}>
                      <span style={{ color: '#1565c0' }}>P {log.protein}g</span>
                      <span style={{ color: '#e65100' }}>C {log.carbs}g</span>
                      <span style={{ color: '#c62828' }}>F {log.fat}g</span>
                      <span style={{ marginLeft: 'auto', color: '#999' }}>{log.portions_eaten} {log.portions_eaten === 1 ? 'portion' : 'portions'}</span>
                    </div>
                    {log.ingredients?.length > 0 && (
                      <div style={{ marginTop: '0.6rem', paddingTop: '0.5rem', borderTop: '1px solid #e8e8e8' }}>
                        {log.ingredients.map((ing, i) => {
                          const r = ing.weight_g / 100;
                          return (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#888', padding: '0.15rem 0' }}>
                              <span>{ing.ing_name} <span style={{ color: '#bbb' }}>{ing.weight_g}g</span></span>
                              <span>{(ing.calories_100g * r).toFixed(0)} kcal</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ── Goals Settings Panel ───────────────────────────────────────────────────
function GoalsPanel({ goals, onSave, onClose }) {
  const [form, setForm] = useState({ ...goals });
  const [saving, setSaving] = useState(false);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    await onSave(form);
    setSaving(false);
    onClose();
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#ffffff', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: '480px', boxShadow: '0 -8px 48px rgba(0,0,0,0.3)', padding: '0 0 2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '0.75rem 0 0' }}>
          <div style={{ width: '40px', height: '4px', borderRadius: '2px', background: '#e0e0e0' }} />
        </div>
        <div style={{ padding: '1rem 1.5rem 0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: '1.4rem' }}>Your Goals</div>
          <button onClick={onClose} style={{ background: '#f3f3f3', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#666' }}><X size={16} /></button>
        </div>
        <form onSubmit={handleSave} style={{ padding: '0.5rem 1.5rem' }}>
          {[
            { key: 'calorie_goal', label: 'Daily Calorie Goal', unit: 'kcal' },
            { key: 'protein_goal', label: 'Protein Goal', unit: 'g' },
            { key: 'carbs_goal', label: 'Carbs Goal', unit: 'g' },
            { key: 'fat_goal', label: 'Fat Goal', unit: 'g' },
            { key: 'weight_target', label: 'Target Weight', unit: 'kg' },
          ].map(({ key, label, unit }) => (
            <div key={key} className="form-group" style={{ marginBottom: '0.9rem' }}>
              <label style={{ fontSize: '0.82rem', color: 'var(--text-sub)' }}>{label}</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="number" step="any" min="0"
                  className="form-input"
                  value={form[key]}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  style={{ flex: 1 }}
                />
                <span style={{ color: 'var(--text-dim)', fontSize: '0.82rem', width: '30px' }}>{unit}</span>
              </div>
            </div>
          ))}
          <button type="submit" className="btn btn-primary" disabled={saving} style={{ width: '100%', padding: '0.85rem', justifyContent: 'center', marginTop: '0.5rem' }}>
            {saving ? 'Saving…' : 'Save Goals'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Meal Scan Modal ────────────────────────────────────────────────────────
const MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];

function MealScanModal({ onClose, onLogged }) {
  const [phase, setPhase] = useState('pick'); // pick | scanning | review | logging | done
  const [preview, setPreview] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [foods, setFoods] = useState([]);
  const [mealType, setMealType] = useState('Lunch');
  const [error, setError] = useState(null);
  const fileRef = useRef(null);
  const cameraRef = useRef(null);

  const totalCals = foods.reduce((s, f) => s + Math.round((f.calories_100g * f.weight_g) / 100), 0);
  const totalP    = foods.reduce((s, f) => s + Math.round((f.protein_100g  * f.weight_g) / 100 * 10) / 10, 0);

  function pickFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setPreview(URL.createObjectURL(file));
    setPhase('scanning');
    scanImage(file);
  }

  async function scanImage(file) {
    setError(null);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const res = await fetch('/api/meal-scan', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Scan failed');
      if (!json.foods?.length) {
        setError('No food detected in this photo. Try a clearer shot of your meal.');
        setPhase('pick');
        return;
      }
      setFoods(json.foods.map((f, i) => ({ ...f, _id: i, removed: false })));
      setPhase('review');
    } catch (e) {
      setError(e.message);
      setPhase('pick');
    }
  }

  function updateFood(id, key, val) {
    setFoods(fs => fs.map(f => f._id === id ? { ...f, [key]: val } : f));
  }

  function removeFood(id) {
    setFoods(fs => fs.map(f => f._id === id ? { ...f, removed: true } : f));
  }

  async function logAll() {
    setPhase('logging');
    const active = foods.filter(f => !f.removed);
    try {
      const res = await fetch('/api/meal-scan/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ foods: active, meal_type: mealType }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Log failed');
      setPhase('done');
      showToast(`Logged ${active.length} items — ${json.total.calories} kcal ✓`);
      onLogged?.();
      setTimeout(onClose, 1400);
    } catch (e) {
      setError(e.message);
      setPhase('review');
    }
  }

  const activeFoods = foods.filter(f => !f.removed);

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 2000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '24px 24px 0 0', width: '100%', maxWidth: '560px', maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 -8px 64px rgba(0,0,0,0.35)' }}>

        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '0.75rem 0 0' }}>
          <div style={{ width: '40px', height: '4px', borderRadius: '2px', background: '#e0e0e0' }} />
        </div>

        {/* Header */}
        <div style={{ padding: '0.75rem 1.25rem 0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: '1.4rem', color: '#111', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Camera size={20} color="var(--accent, #01696f)" /> Scan Meal
          </div>
          <button onClick={onClose} style={{ background: '#f3f3f3', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#666' }}><X size={16} /></button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, padding: '0.5rem 1.25rem 1.5rem' }}>

          {/* PHASE: pick */}
          {phase === 'pick' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {error && (
                <div style={{ background: '#fff0f0', border: '1px solid #fca5a5', borderRadius: '12px', padding: '0.75rem 1rem', fontSize: '0.85rem', color: '#dc2626' }}>
                  {error}
                </div>
              )}
              <div style={{ background: '#f7fafa', border: '2px dashed var(--accent, #01696f)', borderRadius: '16px', padding: '2.5rem 1.5rem', textAlign: 'center', color: '#666' }}>
                <Camera size={36} color="var(--accent, #01696f)" style={{ margin: '0 auto 0.75rem', opacity: 0.7 }} />
                <div style={{ fontWeight: 600, fontSize: '0.95rem', color: '#333', marginBottom: '0.35rem' }}>
                  Take or upload a photo of your meal
                </div>
                <div style={{ fontSize: '0.8rem', color: '#999', marginBottom: '1.5rem' }}>
                  Gemini AI will identify each food and estimate portions
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                  <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={pickFile} id="scan-camera-input" />
                  <label htmlFor="scan-camera-input" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'var(--accent, #01696f)', color: '#fff', borderRadius: '12px', padding: '0.7rem 1.25rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.88rem' }}>
                    <Camera size={16} /> Camera
                  </label>
                  <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={pickFile} id="scan-file-input" />
                  <label htmlFor="scan-file-input" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#f3f3f3', color: '#333', borderRadius: '12px', padding: '0.7rem 1.25rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.88rem', border: '1px solid #e0e0e0' }}>
                    <ImageIcon size={16} /> Gallery
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* PHASE: scanning */}
          {phase === 'scanning' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem', padding: '1.5rem 0' }}>
              {preview && <img src={preview} alt="Meal preview" style={{ width: '100%', maxHeight: '220px', objectFit: 'cover', borderRadius: '14px' }} />}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                <Loader2 size={28} color="var(--accent, #01696f)" style={{ animation: 'spin 1s linear infinite' }} />
                <div style={{ fontSize: '0.9rem', color: '#555', fontWeight: 500 }}>Analysing your meal…</div>
                <div style={{ fontSize: '0.78rem', color: '#999' }}>Gemini is identifying foods & estimating portions</div>
              </div>
              <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          {/* PHASE: review */}
          {phase === 'review' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {preview && <img src={preview} alt="Meal preview" style={{ width: '100%', maxHeight: '180px', objectFit: 'cover', borderRadius: '14px' }} />}

              {/* Meal type selector */}
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {MEAL_TYPES.map(mt => (
                  <button key={mt} onClick={() => setMealType(mt)} style={{ padding: '0.4rem 0.9rem', borderRadius: '999px', border: '1.5px solid', borderColor: mealType === mt ? 'var(--accent, #01696f)' : '#e0e0e0', background: mealType === mt ? 'var(--accent, #01696f)' : '#fff', color: mealType === mt ? '#fff' : '#555', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}>
                    {mt}
                  </button>
                ))}
              </div>

              {/* Totals bar */}
              <div style={{ background: '#f0f9f7', borderRadius: '12px', padding: '0.7rem 1rem', display: 'flex', gap: '1.5rem', fontSize: '0.82rem', alignItems: 'center' }}>
                <span style={{ fontFamily: "'Instrument Serif', serif", fontSize: '1.3rem', color: 'var(--accent, #01696f)', lineHeight: 1 }}>{totalCals}</span>
                <span style={{ color: '#555' }}>kcal total</span>
                <span style={{ color: '#1565c0', marginLeft: 'auto', fontWeight: 600 }}>P {Math.round(totalP * 10) / 10}g</span>
              </div>

              {/* Food chips */}
              {error && (
                <div style={{ background: '#fff0f0', border: '1px solid #fca5a5', borderRadius: '10px', padding: '0.6rem 0.9rem', fontSize: '0.83rem', color: '#dc2626' }}>{error}</div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {foods.map(f => {
                  if (f.removed) return null;
                  const lineCals = Math.round((f.calories_100g * f.weight_g) / 100);
                  return (
                    <div key={f._id} style={{ background: '#f7f7f7', borderRadius: '14px', padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#111', marginBottom: '0.3rem', textTransform: 'capitalize' }}>{f.name}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <button onClick={() => updateFood(f._id, 'weight_g', Math.max(10, f.weight_g - 10))} style={{ background: '#e8e8e8', border: 'none', borderRadius: '6px', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#444', flexShrink: 0 }}><Minus size={12} /></button>
                          <span style={{ fontSize: '0.82rem', color: '#555', minWidth: '48px', textAlign: 'center' }}>{f.weight_g}g</span>
                          <button onClick={() => updateFood(f._id, 'weight_g', f.weight_g + 10)} style={{ background: '#e8e8e8', border: 'none', borderRadius: '6px', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#444', flexShrink: 0 }}><Plus size={12} /></button>
                          <span style={{ fontSize: '0.78rem', color: 'var(--accent, #01696f)', fontWeight: 600, marginLeft: '0.25rem' }}>{lineCals} kcal</span>
                        </div>
                      </div>
                      <button onClick={() => removeFood(f._id)} style={{ background: '#fee2e2', border: 'none', borderRadius: '8px', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#dc2626', flexShrink: 0 }}><X size={14} /></button>
                    </div>
                  );
                })}
              </div>

              {/* Retake */}
              <button onClick={() => { setPhase('pick'); setFoods([]); setError(null); setPreview(null); }} style={{ background: 'none', border: '1.5px solid #e0e0e0', borderRadius: '12px', padding: '0.6rem', fontSize: '0.82rem', color: '#666', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                <RefreshCw size={14} /> Retake photo
              </button>
            </div>
          )}

          {/* PHASE: logging */}
          {phase === 'logging' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '2rem 0' }}>
              <Loader2 size={28} color="var(--accent, #01696f)" style={{ animation: 'spin 1s linear infinite' }} />
              <div style={{ fontSize: '0.9rem', color: '#555' }}>Logging {activeFoods.length} items…</div>
            </div>
          )}

          {/* PHASE: done */}
          {phase === 'done' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', padding: '2rem 0' }}>
              <CheckCircle2 size={40} color="var(--accent, #01696f)" />
              <div style={{ fontSize: '1rem', fontWeight: 600, color: '#111' }}>Logged successfully!</div>
            </div>
          )}
        </div>

        {/* Footer CTA */}
        {phase === 'review' && activeFoods.length > 0 && (
          <div style={{ padding: '0.75rem 1.25rem 1.5rem', borderTop: '1px solid #f0f0f0' }}>
            <button onClick={logAll} style={{ width: '100%', background: 'var(--accent, #01696f)', color: '#fff', border: 'none', borderRadius: '14px', padding: '0.9rem', fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
              <UtensilsCrossed size={16} /> Log {activeFoods.length} item{activeFoods.length !== 1 ? 's' : ''} as {mealType}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function Home() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(null);
  const [viewingDate, setViewingDate] = useState(null);
  const [photoLog, setPhotoLog] = useState(null);
  const [showGoals, setShowGoals] = useState(false);
  const [showScan, setShowScan] = useState(false);
  const [goals, setGoals] = useState({ calorie_goal: 1800, protein_goal: 150, carbs_goal: 200, fat_goal: 60, weight_target: 75 });

  const todayStr = new Date().toISOString().split('T')[0];
  const hour = new Date().getHours();

  const GOAL = goals.calorie_goal;
  const PROTEIN_GOAL = goals.protein_goal;
  const CARBS_GOAL = goals.carbs_goal;
  const FAT_GOAL = goals.fat_goal;
  const WEIGHT_TARGET = goals.weight_target;

  async function fetchDashboard() {
    try {
      setData(await (await fetch('/api/dashboard')).json());
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  async function fetchGoals() {
    try {
      const g = await (await fetch('/api/goals')).json();
      setGoals(g);
    } catch { /* ignore */ }
  }

  useEffect(() => { fetchDashboard(); fetchGoals(); }, []);

  useEffect(() => {
    if (data && !selectedDate) setSelectedDate(todayStr);
  }, [data]);

  useSupabaseRealtime(
    ['ingredients', 'recipes', 'recipe_ingredients', 'daily_logs', 'weight_logs'],
    fetchDashboard
  );

  async function handleSaveGoals(newGoals) {
    await fetch('/api/goals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newGoals) });
    setGoals({ calorie_goal: Number(newGoals.calorie_goal), protein_goal: Number(newGoals.protein_goal), carbs_goal: Number(newGoals.carbs_goal), fat_goal: Number(newGoals.fat_goal), weight_target: Number(newGoals.weight_target) });
    showToast('Goals saved ✓');
  }

  function getGreeting(todayMacros, allDates) {
    const timeGreet = hour < 5 ? 'Up late,' : hour < 12 ? 'Good morning,' : hour < 18 ? 'Good afternoon,' : 'Good evening,';
    const todayLogged = allDates?.includes(todayStr);
    const cals = todayMacros?.cals ?? 0;
    if (!todayLogged || cals === 0) return { time: timeGreet, sub: "You haven't logged anything today yet." };
    if (cals > GOAL) return { time: timeGreet, sub: `You're ${cals - GOAL} kcal over your goal today.` };
    return { time: timeGreet, sub: `Nice — already logged ${cals} kcal today.` };
  }

  async function uploadPhoto(file, date) {
    const fd = new FormData();
    fd.append('file', file); fd.append('date', date);
    const res = await fetch('/api/weight/photo', { method: 'POST', body: fd });
    const json = await res.json();
    return json.url || null;
  }

  async function handleDeletePhoto(log) {
    await fetch('/api/weight/photo', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ photo_url: log.photo_url }) });
    await fetch(`/api/weight/${log.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ photo_url: null }) });
    fetchDashboard(); showToast('Photo deleted');
  }

  async function handleReplacePhoto(log, file) {
    if (log.photo_url) await fetch('/api/weight/photo', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ photo_url: log.photo_url }) });
    const newUrl = await uploadPhoto(file, log.date);
    if (!newUrl) { showToast('Upload failed', 'error'); return; }
    await fetch(`/api/weight/${log.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ photo_url: newUrl }) });
    fetchDashboard(); showToast('Photo replaced ✓');
  }

  const allDates = data?.allDates || [];
  const selectedIdx = allDates.indexOf(selectedDate);
  const canGoPrev = selectedIdx > 0;
  const canGoNext = selectedIdx !== -1 && selectedIdx < allDates.length - 1;
  function goPrev() { if (canGoPrev) setSelectedDate(allDates[selectedIdx - 1]); }
  function goNext() { if (canGoNext) setSelectedDate(allDates[selectedIdx + 1]); }

  const isFuture = selectedDate && selectedDate > todayStr;
  const isToday = selectedDate === todayStr;
  const selectedLabel = selectedDate ? (isToday ? 'Today' : new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })) : 'Today';
  const chartEntry = data?.chartData?.find(c => c.date === selectedDate);
  const displayMacros = selectedDate && !isToday && chartEntry ? { cals: chartEntry.Calories, p: '—', c: '—', f: '—' } : data?.todayMacros;
  const streak = calcStreak(allDates);
  const weightInsights = calcWeightInsights(data?.weightLogData, WEIGHT_TARGET);
  const greeting = getGreeting(data?.todayMacros, allDates);

  function WeightDot({ cx, cy, payload }) {
    if (!payload?.hasPhoto) return <circle cx={cx} cy={cy} r={4} stroke="var(--accent)" strokeWidth={2} fill="white" />;
    return (<g style={{ cursor: 'pointer' }}><circle cx={cx} cy={cy} r={7} fill="var(--accent)" opacity={0.15} /><circle cx={cx} cy={cy} r={4} stroke="var(--accent)" strokeWidth={2} fill="var(--accent)" /></g>);
  }

  function WeightTooltip({ active, payload }) {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '10px', padding: '0.6rem 0.9rem', fontSize: '0.82rem', fontFamily: 'Plus Jakarta Sans', boxShadow: 'var(--shadow-md)' }}>
        <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{d.name}</div>
        <div style={{ color: 'var(--accent)', fontWeight: 600 }}>{d.Weight} kg</div>
        {d.hasPhoto && (<div style={{ color: 'var(--accent)', fontSize: '0.75rem', marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}><ImageIcon size={11} /> Tap to view photo</div>)}
      </div>
    );
  }

  const avgCals = data?.weeklyAvgCals ?? 0;
  const avgPct = Math.min(100, (avgCals / GOAL) * 100);
  const avgColor = avgCals > GOAL ? 'var(--red)' : 'var(--accent)';

  const todayP = data?.todayMacros?.p ?? 0;
  const todayC = data?.todayMacros?.c ?? 0;
  const todayF = data?.todayMacros?.f ?? 0;

  return (
    <main>
      {viewingDate && <DayModal date={viewingDate} onClose={() => setViewingDate(null)} GOAL={GOAL} />}
      {photoLog && <PhotoModal log={photoLog} onClose={() => setPhotoLog(null)} onDeletePhoto={handleDeletePhoto} onReplacePhoto={handleReplacePhoto} />}
      {showGoals && <GoalsPanel goals={goals} onSave={handleSaveGoals} onClose={() => setShowGoals(false)} />}
      {showScan && <MealScanModal onClose={() => setShowScan(false)} onLogged={fetchDashboard} />}

      {/* Header */}
      <div style={{ marginBottom: '3rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <p className="page-eyebrow animate-fade-up stagger-1">{greeting.time}</p>
            <Link href="/" style={{ textDecoration: 'none', color: 'inherit' }}>
              <h1 className="page-title animate-fade-up stagger-2" style={{ fontSize: '3rem' }}>Osama<em>'s Kitchen</em></h1>
            </Link>
            <p className="page-sub animate-fade-up stagger-3" style={{ color: data?.todayMacros?.cals > GOAL ? 'var(--red)' : 'var(--text-dim)' }}>
              {loading ? 'Your personal nutrition & recipe hub.' : greeting.sub}
            </p>
          </div>
          <button
            onClick={() => setShowGoals(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: '0.5rem', marginTop: '0.25rem', borderRadius: '8px', flexShrink: 0 }}
            title="Adjust goals"
          >
            <Settings size={18} />
          </button>
        </div>
      </div>

      {/* Nav */}
      <nav className="nav-grid">
        <Link href="/ingredients" className="nav-card animate-fade-up stagger-1"><Carrot size={26} strokeWidth={1.7} />Ingredients</Link>
        <Link href="/recipes" className="nav-card animate-fade-up stagger-2"><BookOpen size={26} strokeWidth={1.7} />Recipes</Link>
        <Link href="/tracking" className="nav-card animate-fade-up stagger-3"><UtensilsCrossed size={26} strokeWidth={1.7} />Daily Log</Link>
        <Link href="/weight" className="nav-card animate-fade-up stagger-4"><Scale size={26} strokeWidth={1.7} />Weight</Link>
        <button onClick={() => setShowScan(true)} className="nav-card animate-fade-up stagger-5" style={{ background: 'var(--accent, #01696f)', color: '#fff', border: 'none', cursor: 'pointer', gridColumn: 'span 2' }}>
          <Camera size={26} strokeWidth={1.7} />Scan Meal with AI
        </button>
      </nav>

      {loading ? (
        <div className="card" style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-dim)', fontSize: '0.9rem' }}>Loading your data...</div>
      ) : !data ? null : (
        <>
          {/* Today's Intake Card */}
          <div className="card animate-fade-up stagger-1">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Flame size={16} color="var(--accent)" strokeWidth={2} />
                <span className="section-label" style={{ margin: 0 }}>Intake</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <button onClick={goPrev} disabled={!canGoPrev} style={{ background: 'none', border: 'none', cursor: canGoPrev ? 'pointer' : 'default', color: canGoPrev ? 'var(--text-main)' : 'var(--border)', padding: '4px', display: 'flex' }}><ChevronLeft size={18} /></button>
                <button onClick={() => setViewingDate(selectedDate)} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: isFuture ? '#fff8e1' : 'var(--surface2)', border: isFuture ? '1px solid #f59e0b' : 'none', borderRadius: '8px', padding: '4px 10px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', color: isFuture ? '#b45309' : 'var(--text-main)' }}>
                  <Calendar size={13} />{selectedLabel}
                </button>
                <button onClick={goNext} disabled={!canGoNext} style={{ background: 'none', border: 'none', cursor: canGoNext ? 'pointer' : 'default', color: canGoNext ? 'var(--text-main)' : 'var(--border)', padding: '4px', display: 'flex' }}><ChevronRight size={18} /></button>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Goal: {GOAL} kcal</div>
              {isToday ? (
                <Link href="/tracking" style={{ fontSize: '0.8rem', color: 'var(--accent)', textDecoration: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem' }}><UtensilsCrossed size={13} /> Log Meal</Link>
              ) : (
                <button onClick={() => setViewingDate(selectedDate)} style={{ fontSize: '0.8rem', color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem' }}><Calendar size={13} /> View Meals</button>
              )}
            </div>
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.5rem' }}>
                <span style={{ fontFamily: "'Instrument Serif', serif", fontSize: '2.5rem', color: (displayMacros?.cals || 0) > GOAL ? 'var(--red)' : 'var(--text-main)', lineHeight: 1 }}>{displayMacros?.cals ?? 0}</span>
                <span style={{ fontSize: '0.9rem', color: (displayMacros?.cals || 0) > GOAL ? 'var(--red)' : 'var(--accent)', fontWeight: 600 }}>
                  {(displayMacros?.cals || 0) > GOAL ? `+${(displayMacros?.cals || 0) - GOAL} over goal` : `${GOAL - (displayMacros?.cals || 0)} remaining`}
                </span>
              </div>
              <div style={{ height: '8px', background: 'var(--surface2)', borderRadius: '999px', overflow: 'hidden' }}>
                <div style={{ height: '100%', background: (displayMacros?.cals || 0) > GOAL ? 'var(--red)' : 'var(--accent)', width: `${Math.min(100, ((displayMacros?.cals || 0) / GOAL) * 100)}%`, transition: 'width 1s cubic-bezier(0.4,0,0.2,1)', borderRadius: '999px' }} />
              </div>
            </div>

            {/* Macro mini-cards with /goal bars */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
              {[
                { label: 'Protein', val: todayP, goal: PROTEIN_GOAL, color: 'var(--blue)' },
                { label: 'Carbs',   val: todayC, goal: CARBS_GOAL,   color: 'var(--gold)' },
                { label: 'Fat',     val: todayF, goal: FAT_GOAL,     color: 'var(--red)'  },
              ].map(m => {
                const pct = m.goal > 0 ? Math.min(100, (Number(m.val) || 0) / m.goal * 100) : 0;
                const reached = pct >= 100;
                return (
                  <div key={m.label} style={{ background: 'var(--surface2)', borderRadius: '12px', padding: '0.75rem' }}>
                    <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: '1.4rem', color: m.color, lineHeight: 1 }}>
                      {isToday ? m.val : '—'}
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontFamily: 'Plus Jakarta Sans', marginLeft: '2px' }}>g</span>
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', marginTop: '0.25rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{m.label}</div>
                    {m.goal > 0 && (
                      <>
                        <div style={{ marginTop: '0.4rem', height: '3px', background: 'var(--border)', borderRadius: '99px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', background: reached ? 'var(--accent)' : m.color, width: `${pct}%`, borderRadius: '99px', transition: 'width 1s cubic-bezier(0.4,0,0.2,1)' }} />
                        </div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', marginTop: '0.2rem' }}>
                          {isToday ? `/ ${m.goal}g` : `goal ${m.goal}g`}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.5rem' }}>
            <div className="card-flat animate-fade-up stagger-2">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.75rem' }}>
                <Scale size={14} color="var(--text-dim)" />
                <span className="section-label" style={{ margin: 0 }}>Body Weight</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                <span style={{ fontFamily: "'Instrument Serif', serif", fontSize: '2.4rem', letterSpacing: '-1px' }}>{data.currentWeight ?? '—'}</span>
                {data.currentWeight && <span style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>kg</span>}
                {data.weightChange != 0 && data.weightChange != null && (
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color: data.weightChange > 0 ? 'var(--red)' : 'var(--accent)', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                    {data.weightChange > 0 ? `▲ +${data.weightChange}` : `▼ ${data.weightChange}`} kg
                  </span>
                )}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginTop: '0.3rem' }}>Started at {data.startingWeight ?? '—'} kg</div>
            </div>

            <div className="card-flat animate-fade-up stagger-3">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.75rem' }}>
                <ChefHat size={14} color="var(--text-dim)" />
                <span className="section-label" style={{ margin: 0 }}>Overview</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-sub)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <Zap size={12} color={streak >= 3 ? 'var(--gold)' : 'var(--text-dim)'} />
                    Logging streak
                  </span>
                  <span style={{ fontFamily: "'Instrument Serif', serif", fontSize: '1.1rem', color: streak >= 7 ? 'var(--gold)' : streak >= 3 ? 'var(--accent)' : 'var(--text-main)' }}>
                    {streak} {streak === 1 ? 'day' : 'days'}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                    <span style={{ color: 'var(--text-sub)' }}>7-day avg</span>
                    <span style={{ fontFamily: "'Instrument Serif', serif", fontSize: '1.1rem', color: avgColor }}>{avgCals} kcal</span>
                  </div>
                  <div style={{ height: '4px', background: 'var(--surface2)', borderRadius: '999px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: avgColor, width: `${avgPct}%`, transition: 'width 1s cubic-bezier(0.4,0,0.2,1)' }} />
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                    {avgCals > GOAL ? `▲ ${avgCals - GOAL} over goal` : `▼ ${GOAL - avgCals} under goal`}
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                  <span style={{ color: 'var(--text-sub)' }}>Saved recipes</span>
                  <span style={{ fontFamily: "'Instrument Serif', serif", fontSize: '1.1rem' }}>{data.recipesSaved}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Charts — original 2-column side-by-side layout */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>

            {/* Calorie Chart */}
            <div className="card animate-fade-up stagger-4" style={{ height: '280px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '1.5rem', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <Flame size={14} color="var(--text-dim)" />
                  <span className="section-label" style={{ margin: 0 }}>Calories — 30d</span>
                </div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>tap bar to view</span>
              </div>
              {data.chartData && data.chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="80%">
                  <ComposedChart
                    data={data.chartData}
                    barSize={data.chartData.length > 14 ? 8 : 18}
                    onClick={e => { if (e?.activePayload?.[0]?.payload?.date) setViewingDate(e.activePayload[0].payload.date); }}
                    style={{ cursor: 'pointer' }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--text-dim)', fontFamily: 'Plus Jakarta Sans' }} interval={data.chartData.length > 14 ? 6 : 0} />
                    <Tooltip
                      cursor={{ fill: 'var(--accent-light)' }}
                      contentStyle={{ background: 'white', border: '1px solid var(--border)', borderRadius: '10px', fontFamily: 'Plus Jakarta Sans', fontSize: '0.82rem', boxShadow: 'var(--shadow-md)' }}
                      formatter={(val) => [`${val} kcal`, 'Calories']}
                    />
                    <Bar dataKey="Calories" radius={[4, 4, 0, 0]}>
                      {data.chartData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.date === selectedDate ? 'var(--gold)' : entry.Calories > GOAL ? 'var(--red-light)' : 'var(--accent)'}
                        />
                      ))}
                    </Bar>
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '75%', color: 'var(--text-dim)', fontSize: '0.85rem', flexDirection: 'column', gap: '0.5rem' }}>
                  <Beef size={28} strokeWidth={1.5} />
                  Start logging to see charts
                </div>
              )}
            </div>

            {/* Weight Trend Chart */}
            <div className="card animate-fade-up stagger-5" style={{ height: '280px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.6rem', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <TrendingDown size={14} color="var(--text-dim)" />
                  <span className="section-label" style={{ margin: 0 }}>Weight Trend</span>
                </div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>● = has photo</span>
              </div>

              {weightInsights && (
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                    background: weightInsights.weeklyDiff < 0 ? 'rgba(0,150,136,0.08)' : 'rgba(229,57,53,0.08)',
                    borderRadius: '999px', padding: '0.2rem 0.65rem',
                    fontSize: '0.72rem', fontWeight: 700,
                    color: weightInsights.weeklyDiff < 0 ? 'var(--accent)' : 'var(--red)',
                  }}>
                    {weightInsights.weeklyDiff < 0
                      ? `▼ Lost ${Math.abs(weightInsights.weeklyDiff)} kg this week`
                      : weightInsights.weeklyDiff > 0
                        ? `▲ Gained ${weightInsights.weeklyDiff} kg this week`
                        : '— No change this week'}
                  </div>
                  {weightInsights.projectedDate && (
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                      background: 'rgba(255,152,0,0.08)',
                      borderRadius: '999px', padding: '0.2rem 0.65rem',
                      fontSize: '0.72rem', fontWeight: 700,
                      color: '#e65100',
                    }}>
                      <Target size={10} />
                      {WEIGHT_TARGET} kg by {weightInsights.projectedDate}
                    </div>
                  )}
                </div>
              )}

              {data.weightLogData && data.weightLogData.length > 1 ? (
                <ResponsiveContainer width="100%" height="72%">
                  <LineChart
                    data={data.weightLogData}
                    onClick={d => {
                      if (d?.activePayload?.[0]?.payload?.hasPhoto)
                        setPhotoLog(d.activePayload[0].payload.fullLog);
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--text-dim)', fontFamily: 'Plus Jakarta Sans' }} />
                    <YAxis domain={['auto', 'auto']} axisLine={false} tickLine={false} width={34} tick={{ fontSize: 11, fill: 'var(--text-dim)' }} />
                    <Tooltip content={<WeightTooltip />} />
                    <ReferenceLine
                      y={WEIGHT_TARGET}
                      stroke="#f59e0b"
                      strokeDasharray="5 4"
                      strokeWidth={1.5}
                      label={{ value: `Goal ${WEIGHT_TARGET}kg`, position: 'insideTopRight', fontSize: 10, fill: '#f59e0b', fontWeight: 700, fontFamily: 'Plus Jakarta Sans' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="Weight"
                      stroke="var(--accent)"
                      strokeWidth={2.5}
                      dot={<WeightDot />}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '75%', color: 'var(--text-dim)', fontSize: '0.85rem', flexDirection: 'column', gap: '0.5rem' }}>
                  <Scale size={28} strokeWidth={1.5} />
                  Log 2+ weights to see trend
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </main>
  );
}
