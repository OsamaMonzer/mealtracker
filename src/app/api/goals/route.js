import { NextResponse } from 'next/server';
import { createClient } from '../../../utils/supabase/server';

export const dynamic = 'force-dynamic';

const DEFAULTS = { calorie_goal: 1800, protein_goal: 150, carbs_goal: 200, fat_goal: 60, weight_target: 75 };

export async function GET() {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // .maybeSingle() returns null (not an error) when no row is found
    const { data: row, error } = await supabase
      .from('goals')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) throw new Error(error.message);

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

    // Check if a row already exists for this user
    const { data: existing } = await supabase
      .from('goals')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    let error;
    if (existing) {
      // Update existing row
      ({ error } = await supabase
        .from('goals')
        .update(payload)
        .eq('user_id', user.id));
    } else {
      // Insert new row
      ({ error } = await supabase
        .from('goals')
        .insert(payload));
    }

    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
