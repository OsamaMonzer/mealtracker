'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Carrot, BookOpen, UtensilsCrossed, Scale, TrendingDown, ChefHat, Flame, Beef, ChevronLeft, ChevronRight, X, Calendar } from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import { useSupabaseRealtime } from '../hooks/useSupabaseRealtime';

const GOAL = 1800;

// ── Day History Modal ──────────────────────────────────────────────────────
function DayModal({ date, onClose }) {
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
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.6)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        backdropFilter: 'blur(3px)',
        WebkitBackdropFilter: 'blur(3px)',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#ffffff',
          borderRadius: '20px 20px 0 0',
          width: '100%',
          maxWidth: '640px',
          maxHeight: '88vh',
          minHeight: '200px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 -8px 48px rgba(0,0,0,0.3)',
          position: 'relative',
        }}
      >
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '0.75rem 0 0', background: '#ffffff' }}>
          <div style={{ width: '40px', height: '4px', borderRadius: '2px', background: '#e0e0e0' }} />
        </div>

        {/* Header */}
        <div style={{ padding: '1rem 1.5rem 0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #efefef', background: '#ffffff' }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#999', marginBottom: '0.2rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {isToday ? 'Today' : 'History'}
            </div>
            <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: '1.4rem', lineHeight: 1.2, color: '#111' }}>{label}</div>
          </div>
          <button onClick={onClose} style={{ background: '#f3f3f3', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#666', flexShrink: 0 }}>
            <X size={16} />
          </button>
        </div>

        {/* Totals bar */}
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

        {/* Scrollable content */}
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

// ── Main Page ──────────────────────────────────────────────────────────────
export default function Home() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(null);
  const [viewingDate, setViewingDate] = useState(null);

  const todayStr = new Date().toISOString().split('T')[0];
  const hour = new Date().getHours();
  const greeting = hour < 5 ? 'Up late,' : hour < 12 ? 'Good morning,' : hour < 18 ? 'Good afternoon,' : 'Good evening,';

  async function fetchDashboard() {
    try {
      setData(await (await fetch('/api/dashboard')).json());
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  useEffect(() => { fetchDashboard(); }, []);

  useEffect(() => {
    if (data && !selectedDate) setSelectedDate(todayStr);
  }, [data]);

  useSupabaseRealtime(
    ['ingredients', 'recipes', 'recipe_ingredients', 'daily_logs', 'weight_logs'],
    fetchDashboard
  );

  const allDates = data?.allDates || [];
  const selectedIdx = allDates.indexOf(selectedDate);
  const canGoPrev = selectedIdx > 0;
  const canGoNext = selectedDate && selectedDate < todayStr;

  function goPrev() {
    if (selectedIdx > 0) setSelectedDate(allDates[selectedIdx - 1]);
  }

  function goNext() {
    if (selectedIdx < allDates.length - 1) setSelectedDate(allDates[selectedIdx + 1]);
    else if (selectedDate < todayStr) setSelectedDate(todayStr);
  }

  const selectedLabel = selectedDate
    ? selectedDate === todayStr
      ? 'Today'
      : new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    : 'Today';

  const chartEntry = data?.chartData?.find(c => c.date === selectedDate);
  const displayMacros = selectedDate && selectedDate !== todayStr && chartEntry
    ? { cals: chartEntry.Calories, p: '—', c: '—', f: '—' }
    : data?.todayMacros;

  const isToday = selectedDate === todayStr;

  return (
    <main>
      {viewingDate && <DayModal date={viewingDate} onClose={() => setViewingDate(null)} />}

      {/* Header */}
      <div style={{ marginBottom: '3rem' }}>
        <p className="page-eyebrow animate-fade-up stagger-1">{greeting}</p>
        <Link href="/" style={{ textDecoration: 'none', color: 'inherit' }}>
          <h1 className="page-title animate-fade-up stagger-2" style={{ fontSize: '3rem' }}>
            Osama<em>'s Kitchen</em>
          </h1>
        </Link>
        <p className="page-sub animate-fade-up stagger-3">Your personal nutrition & recipe hub.</p>
      </div>

      {/* Nav */}
      <nav className="nav-grid">
        <Link href="/ingredients" className="nav-card animate-fade-up stagger-1"><Carrot size={26} strokeWidth={1.7} />Ingredients</Link>
        <Link href="/recipes" className="nav-card animate-fade-up stagger-2"><BookOpen size={26} strokeWidth={1.7} />Recipes</Link>
        <Link href="/tracking" className="nav-card animate-fade-up stagger-3"><UtensilsCrossed size={26} strokeWidth={1.7} />Daily Log</Link>
        <Link href="/weight" className="nav-card animate-fade-up stagger-4"><Scale size={26} strokeWidth={1.7} />Weight</Link>
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
                <button onClick={goPrev} disabled={!canGoPrev} style={{ background: 'none', border: 'none', cursor: canGoPrev ? 'pointer' : 'default', color: canGoPrev ? 'var(--text-main)' : 'var(--border)', padding: '4px', display: 'flex' }}>
                  <ChevronLeft size={18} />
                </button>
                <button
                  onClick={() => setViewingDate(selectedDate)}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: 'var(--surface2)', border: 'none', borderRadius: '8px', padding: '4px 10px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', color: 'var(--text-main)' }}
                >
                  <Calendar size={13} />
                  {selectedLabel}
                </button>
                <button onClick={goNext} disabled={!canGoNext} style={{ background: 'none', border: 'none', cursor: canGoNext ? 'pointer' : 'default', color: canGoNext ? 'var(--text-main)' : 'var(--border)', padding: '4px', display: 'flex' }}>
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Goal: {GOAL} kcal</div>
              {isToday && (
                <Link href="/tracking" style={{ fontSize: '0.8rem', color: 'var(--accent)', textDecoration: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <UtensilsCrossed size={13} /> Log Meal
                </Link>
              )}
              {!isToday && (
                <button onClick={() => setViewingDate(selectedDate)} style={{ fontSize: '0.8rem', color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <Calendar size={13} /> View Meals
                </button>
              )}
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.5rem' }}>
                <span style={{ fontFamily: "'Instrument Serif', serif", fontSize: '2.5rem', color: (displayMacros?.cals || 0) > GOAL ? 'var(--red)' : 'var(--text-main)', lineHeight: 1 }}>
                  {displayMacros?.cals ?? 0}
                </span>
                <span style={{ fontSize: '0.9rem', color: (displayMacros?.cals || 0) > GOAL ? 'var(--red)' : 'var(--accent)', fontWeight: 600 }}>
                  {(displayMacros?.cals || 0) > GOAL
                    ? `+${(displayMacros?.cals || 0) - GOAL} over goal`
                    : `${GOAL - (displayMacros?.cals || 0)} remaining`}
                </span>
              </div>
              <div style={{ height: '8px', background: 'var(--surface2)', borderRadius: '999px', overflow: 'hidden' }}>
                <div style={{ height: '100%', background: (displayMacros?.cals || 0) > GOAL ? 'var(--red)' : 'var(--accent)', width: `${Math.min(100, ((displayMacros?.cals || 0) / GOAL) * 100)}%`, transition: 'width 1s cubic-bezier(0.4,0,0.2,1)' }} />
              </div>
            </div>

            <div className="stats-row" style={{ marginTop: 'auto' }}>
              {isToday ? (
                <>
                  <div className="stat-item"><div className="stat-value" style={{ color: 'var(--blue)' }}>{data.todayMacros.p}g</div><div className="stat-label">Protein</div></div>
                  <div className="stat-item" style={{ borderLeft: '1px solid var(--border)' }}><div className="stat-value" style={{ color: 'var(--gold)' }}>{data.todayMacros.c}g</div><div className="stat-label">Carbs</div></div>
                  <div className="stat-item" style={{ borderLeft: '1px solid var(--border)' }}><div className="stat-value" style={{ color: 'var(--red)' }}>{data.todayMacros.f}g</div><div className="stat-label">Fat</div></div>
                </>
              ) : (
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <button onClick={() => setViewingDate(selectedDate)} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.5rem 1.2rem', fontSize: '0.82rem', cursor: 'pointer', color: 'var(--text-sub)' }}>Tap to see full breakdown →</button>
                </div>
              )}
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                  <span style={{ color: 'var(--text-sub)' }}>Saved recipes</span>
                  <span style={{ fontFamily: "'Instrument Serif', serif", fontSize: '1.1rem' }}>{data.recipesSaved}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                  <span style={{ color: 'var(--text-sub)' }}>7-day avg calories</span>
                  <span style={{ fontFamily: "'Instrument Serif', serif", fontSize: '1.1rem', color: 'var(--accent)' }}>{data.weeklyAvgCals} kcal</span>
                </div>
              </div>
            </div>
          </div>

          {/* Charts */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
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
                    <Line type="monotone" dataKey="Calories" stroke="var(--gold)" strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '75%', color: 'var(--text-dim)', fontSize: '0.85rem', flexDirection: 'column', gap: '0.5rem' }}>
                  <Beef size={28} strokeWidth={1.5} />
                  Start logging to see charts
                </div>
              )}
            </div>

            <div className="card animate-fade-up stagger-5" style={{ height: '280px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '1.5rem' }}>
                <TrendingDown size={14} color="var(--text-dim)" />
                <span className="section-label" style={{ margin: 0 }}>Weight Trend</span>
              </div>
              {data.weightLogData && data.weightLogData.length > 1 ? (
                <ResponsiveContainer width="100%" height="80%">
                  <LineChart data={data.weightLogData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--text-dim)', fontFamily: 'Plus Jakarta Sans' }} />
                    <YAxis domain={['auto', 'auto']} axisLine={false} tickLine={false} width={34} tick={{ fontSize: 11, fill: 'var(--text-dim)' }} />
                    <Tooltip contentStyle={{ background: 'white', border: '1px solid var(--border)', borderRadius: '10px', fontFamily: 'Plus Jakarta Sans', fontSize: '0.82rem', boxShadow: 'var(--shadow-md)' }} />
                    <Line type="monotone" dataKey="Weight" stroke="var(--accent)" strokeWidth={2.5} dot={{ stroke: 'var(--accent)', fill: 'white', r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
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
