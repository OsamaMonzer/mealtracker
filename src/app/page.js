'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Carrot, BookOpen, UtensilsCrossed, Scale, TrendingDown, ChefHat, Flame, Beef, Target, CheckCircle2, XCircle } from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import { useSupabaseRealtime } from '../hooks/useSupabaseRealtime';

export default function Home() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const hour = new Date().getHours();
  const greeting = hour < 5 ? 'Up late,' : hour < 12 ? 'Good morning,' : hour < 18 ? 'Good afternoon,' : 'Good evening,';

  async function fetchDashboard() {
    try {
      setData(await (await fetch('/api/dashboard')).json());
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchDashboard(); }, []);

  useSupabaseRealtime(
    ['ingredients', 'recipes', 'recipe_ingredients', 'daily_logs', 'weight_logs'],
    fetchDashboard
  );

  return (
    <main>
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
        <Link href="/ingredients" className="nav-card animate-fade-up stagger-1">
          <Carrot size={26} strokeWidth={1.7} />
          Ingredients
        </Link>
        <Link href="/recipes" className="nav-card animate-fade-up stagger-2">
          <BookOpen size={26} strokeWidth={1.7} />
          Recipes
        </Link>
        <Link href="/tracking" className="nav-card animate-fade-up stagger-3">
          <UtensilsCrossed size={26} strokeWidth={1.7} />
          Daily Log
        </Link>
        <Link href="/weight" className="nav-card animate-fade-up stagger-4">
          <Scale size={26} strokeWidth={1.7} />
          Weight
        </Link>
      </nav>

      {loading ? (
        <div className="card" style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-dim)', fontSize: '0.9rem' }}>
          Loading your data...
        </div>
      ) : !data ? null : (
        <>
          {/* Today's Macros */}
          <div className="card animate-fade-up stagger-1">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Flame size={16} color="var(--accent)" strokeWidth={2} />
                <span className="section-label" style={{ margin: 0 }}>Today's Intake</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: '0.2rem' }}>Goal: 1800 kcal</div>
                <Link href="/tracking" style={{ fontSize: '0.8rem', color: 'var(--accent)', textDecoration: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem', justifyContent: 'flex-end' }}>
                  <UtensilsCrossed size={13} /> Log Meal
                </Link>
              </div>
            </div>
            
            <div style={{ marginBottom: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.5rem' }}>
                <span style={{ fontFamily: "'Instrument Serif', serif", fontSize: '2.5rem', color: data.todayMacros.cals > 1800 ? 'var(--red)' : 'var(--text-main)', lineHeight: 1 }}>{data.todayMacros.cals}</span>
                <span style={{ fontSize: '0.9rem', color: data.todayMacros.cals > 1800 ? 'var(--red)' : 'var(--accent)', fontWeight: 600 }}>
                  {data.todayMacros.cals > 1800 ? `+${data.todayMacros.cals - 1800} over goal` : `${1800 - data.todayMacros.cals} remaining`}
                </span>
              </div>
              <div style={{ height: '8px', background: 'var(--surface2)', borderRadius: '999px', overflow: 'hidden' }}>
                <div style={{ height: '100%', background: data.todayMacros.cals > 1800 ? 'var(--red)' : 'var(--accent)', width: `${Math.min(100, (data.todayMacros.cals / 1800) * 100)}%`, transition: 'width 1s cubic-bezier(0.4,0,0.2,1)' }}></div>
              </div>
            </div>

            <div className="stats-row" style={{ marginTop: 'auto' }}>
              <div className="stat-item">
                <div className="stat-value" style={{ color: 'var(--blue)' }}>{data.todayMacros.p}g</div>
                <div className="stat-label">Protein</div>
              </div>
              <div className="stat-item" style={{ borderLeft: '1px solid var(--border)' }}>
                <div className="stat-value" style={{ color: 'var(--gold)' }}>{data.todayMacros.c}g</div>
                <div className="stat-label">Carbs</div>
              </div>
              <div className="stat-item" style={{ borderLeft: '1px solid var(--border)' }}>
                <div className="stat-value" style={{ color: 'var(--red)' }}>{data.todayMacros.f}g</div>
                <div className="stat-label">Fat</div>
              </div>
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
                <span style={{ fontFamily: "'Instrument Serif', serif", fontSize: '2.4rem', letterSpacing: '-1px' }}>
                  {data.currentWeight ?? '—'}
                </span>
                {data.currentWeight && <span style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>kg</span>}
                {data.weightChange != 0 && data.weightChange != null && (
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color: data.weightChange > 0 ? 'var(--red)' : 'var(--accent)', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                    {data.weightChange > 0 ? `▲ +${data.weightChange}` : `▼ ${data.weightChange}`} kg
                  </span>
                )}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginTop: '0.3rem' }}>
                Started at {data.startingWeight ?? '—'} kg
              </div>
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
                  <span className="section-label" style={{ margin: 0 }}>Daily Calories — 7d</span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}><CheckCircle2 size={12} color="var(--accent)" /> Good</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}><XCircle size={12} color="var(--red)" /> Over</span>
                </div>
              </div>
              {data.chartData && data.chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="80%">
                  <ComposedChart data={data.chartData} barSize={24}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--text-dim)', fontFamily: 'Plus Jakarta Sans' }} />
                    <Tooltip cursor={{ fill: 'var(--accent-light)' }} contentStyle={{ background: 'white', border: '1px solid var(--border)', borderRadius: '10px', fontFamily: 'Plus Jakarta Sans', fontSize: '0.82rem', boxShadow: 'var(--shadow-md)' }} />
                    <Bar dataKey="Calories" radius={[5, 5, 0, 0]}>
                      {data.chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.Calories > 1800 ? 'var(--red-light)' : 'var(--accent)'} />
                      ))}
                    </Bar>
                    <Line type="monotone" dataKey="Calories" stroke="var(--gold)" strokeWidth={2.5} dot={{ fill: 'var(--gold)', r: 3 }} activeDot={{ r: 5 }} />
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
