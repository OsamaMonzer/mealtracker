import { NextResponse } from 'next/server';
import { createClient } from '../../../utils/supabase/server';

export const dynamic = 'force-dynamic';

const DEFAULTS = { calorie_goal: 1800, protein_goal: 150, carbs_goal: 200, fat_goal: 60, weight_target: 75 };

export async function GET() {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: row } = await supabase
      .from('goals')
      .select('*')
      .eq('user_id', user.id)
      .single();

    return NextResponse.json(row || { ...DEFAULTS, needsOnboarding: true });
  } catch (e) {
    return NextResponse.json(DEFAULTS);
  }
}

export async function POST(request) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const data = await request.json();

    const payload = {
      calorie_goal:  Number(data.calorie_goal)  || 1800,
      protein_goal:  Number(data.protein_goal)  || 150,
      carbs_goal:    Number(data.carbs_goal)     || 200,
      fat_goal:      Number(data.fat_goal)       || 60,
      weight_target: Number(data.weight_target)  || 75,
      user_id: user.id,
    };

    const { error } = await supabase
      .from('goals')
      .upsert(payload, { onConflict: 'user_id' });

    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
