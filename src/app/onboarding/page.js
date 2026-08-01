'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, User, Target, Flame, ChevronRight, Activity, CheckCircle } from 'lucide-react'
import { createClient } from '../../utils/supabase/client'
import { showToast } from '../../components/ToastContainer'

export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();
  
  const [formData, setFormData] = useState({
    name: '',
    weight_target: 75,
    calorie_goal: 2000,
    protein_goal: 150,
    carbs_goal: 200,
    fat_goal: 60
  });

  function updateForm(field, value) {
    setFormData(prev => ({ ...prev, [field]: value }));
  }

  // Pre-calculate macros generically if they update calories on step 2
  function autoCalculateMacros(calories) {
    // Standard starting split: 30% Protein, 40% Carbs, 30% Fat
    const protein = Math.round((calories * 0.3) / 4);
    const carbs = Math.round((calories * 0.4) / 4);
    const fat = Math.round((calories * 0.3) / 9);
    setFormData(prev => ({ ...prev, calorie_goal: calories, protein_goal: protein, carbs_goal: carbs, fat_goal: fat }));
  }

  async function handleComplete() {
    setLoading(true);
    try {
      // 1. Update Supabase User Metadata (Name)
      await supabase.auth.updateUser({ data: { display_name: formData.name } });

      // 2. Insert into goals table via POST route
      const res = await fetch('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      if (!res.ok) throw new Error('Failed to set goals');
      
      showToast('Profile setup complete! Welcome!');
      router.push('/');
      router.refresh();
    } catch (err) {
      showToast(err.message, 'error');
    }
    setLoading(false);
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: '1.5rem' }}>
      <div className="card animate-slide-down" style={{ maxWidth: '500px', width: '100%', padding: '3rem 2.5rem' }}>
        
        {/* Progress Bar */}
        <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '2.5rem' }}>
          {[1, 2, 3].map(s => (
            <div key={s} style={{ flex: 1, height: '4px', background: s <= step ? 'var(--accent)' : 'var(--surface2)', borderRadius: '99px', transition: 'background 0.3s ease' }} />
          ))}
        </div>

        {step === 1 && (
          <div className="animate-fade-up">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
               <div style={{ background: 'var(--accent-light)', padding: '0.75rem', borderRadius: '12px' }}><User size={24} color="var(--accent)" /></div>
               <h1 className="page-title" style={{ fontSize: '2.2rem', margin: 0 }}>Welcome!</h1>
            </div>
            <p className="page-sub" style={{ marginBottom: '2rem' }}>Let's get your nutrition tracking personalized. What should we call you?</p>
            
            <div className="form-group" style={{ marginBottom: '2rem' }}>
              <label>Your Name</label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="Ex. Osama"
                value={formData.name}
                onChange={e => updateForm('name', e.target.value)}
                autoFocus
              />
            </div>
            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '0.85rem' }} onClick={() => formData.name ? setStep(2) : showToast('Please enter your name', 'error')}>
              Continue <ChevronRight size={18} />
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="animate-fade-up">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
               <div style={{ background: 'var(--blue-light)', padding: '0.75rem', borderRadius: '12px' }}><Target size={24} color="var(--blue)" /></div>
               <h1 className="page-title" style={{ fontSize: '2.2rem', margin: 0 }}>Basics</h1>
            </div>
            <p className="page-sub" style={{ marginBottom: '2rem' }}>Set a baseline weight goal and your daily calorie limit.</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2rem' }}>
              <div className="form-group">
                <label>Target Weight (kg)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input type="number" className="form-input" value={formData.weight_target} onChange={e => updateForm('weight_target', e.target.value)} />
                  <span style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>kg</span>
                </div>
              </div>
              <div className="form-group">
                <label>Daily Calorie Goal</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input type="number" className="form-input" value={formData.calorie_goal} onChange={e => autoCalculateMacros(e.target.value)} />
                  <span style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>kcal</span>
                </div>
              </div>
            </div>

            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '0.85rem' }} onClick={() => setStep(3)}>
              Continue <ChevronRight size={18} />
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="animate-fade-up">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
               <div style={{ background: 'var(--gold-light)', padding: '0.75rem', borderRadius: '12px' }}><Activity size={24} color="var(--gold)" /></div>
               <h1 className="page-title" style={{ fontSize: '2.2rem', margin: 0 }}>Macro Splits</h1>
            </div>
            <p className="page-sub" style={{ marginBottom: '2rem' }}>We've auto-calculated a balanced split based on your calories, but you can heavily tune these down below!</p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem', marginBottom: '2rem' }}>
              <div className="form-group">
                <label style={{ color: 'var(--blue)' }}>Protein Goal (g)</label>
                <input type="number" className="form-input" value={formData.protein_goal} onChange={e => updateForm('protein_goal', e.target.value)} />
              </div>
              <div className="form-group">
                <label style={{ color: 'var(--gold)' }}>Carbs Goal (g)</label>
                <input type="number" className="form-input" value={formData.carbs_goal} onChange={e => updateForm('carbs_goal', e.target.value)} />
              </div>
              <div className="form-group">
                <label style={{ color: 'var(--red)' }}>Fat Goal (g)</label>
                <input type="number" className="form-input" value={formData.fat_goal} onChange={e => updateForm('fat_goal', e.target.value)} />
              </div>
            </div>

            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '0.85rem' }} onClick={handleComplete} disabled={loading}>
              {loading ? 'Setting up...' : 'Complete Profile'} 
              {!loading && <CheckCircle size={18} />}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
