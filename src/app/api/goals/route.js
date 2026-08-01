import { NextResponse } from 'next/server';
import { openDb } from '../../../lib/db';
import { createClient } from '../../../utils/supabase/server';

export const dynamic = 'force-dynamic';

const DEFAULTS = { calorie_goal: 1800, protein_goal: 150, carbs_goal: 200, fat_goal: 60, weight_target: 75 };

export async function GET() {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const db = await openDb();
    const row = await db.get('SELECT * FROM goals WHERE user_id = ?', [user.id]);
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
    const db = await openDb();

    const existing = await db.get('SELECT id FROM goals WHERE user_id = ?', [user.id]);
    if (existing) {
      await db.run(
        'UPDATE goals SET calorie_goal=?, protein_goal=?, carbs_goal=?, fat_goal=?, weight_target=? WHERE user_id=?',
        [
          Number(data.calorie_goal) || 1800,
          Number(data.protein_goal) || 150,
          Number(data.carbs_goal) || 200,
          Number(data.fat_goal) || 60,
          Number(data.weight_target) || 75,
          user.id,
        ]
      );
    } else {
      await db.run(
        'INSERT INTO goals (calorie_goal, protein_goal, carbs_goal, fat_goal, weight_target, user_id) VALUES (?, ?, ?, ?, ?, ?)',
        [
          Number(data.calorie_goal) || 1800,
          Number(data.protein_goal) || 150,
          Number(data.carbs_goal) || 200,
          Number(data.fat_goal) || 60,
          Number(data.weight_target) || 75,
          user.id,
        ]
      );
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
