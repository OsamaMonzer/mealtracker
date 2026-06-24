import { NextResponse } from 'next/server';
import { openDb } from '../../../lib/db';

export const dynamic = 'force-dynamic';

const DEFAULTS = { calorie_goal: 1800, protein_goal: 150, carbs_goal: 200, fat_goal: 60, weight_target: 75 };

async function ensureGoalsTable(db) {
  await db.run(`CREATE TABLE IF NOT EXISTS goals (
    id INTEGER PRIMARY KEY,
    calorie_goal REAL NOT NULL DEFAULT 1800,
    protein_goal REAL NOT NULL DEFAULT 150,
    carbs_goal REAL NOT NULL DEFAULT 200,
    fat_goal REAL NOT NULL DEFAULT 60,
    weight_target REAL NOT NULL DEFAULT 75
  )`);
  const row = await db.get('SELECT id FROM goals WHERE id = 1');
  if (!row) {
    await db.run('INSERT INTO goals (id, calorie_goal, protein_goal, carbs_goal, fat_goal, weight_target) VALUES (1, 1800, 150, 200, 60, 75)');
  }
}

export async function GET() {
  try {
    const db = await openDb();
    await ensureGoalsTable(db);
    const row = await db.get('SELECT * FROM goals WHERE id = 1');
    return NextResponse.json(row || DEFAULTS);
  } catch (e) {
    return NextResponse.json(DEFAULTS);
  }
}

export async function POST(request) {
  try {
    const data = await request.json();
    const db = await openDb();
    await ensureGoalsTable(db);
    await db.run(
      'UPDATE goals SET calorie_goal=?, protein_goal=?, carbs_goal=?, fat_goal=?, weight_target=? WHERE id=1',
      [
        Number(data.calorie_goal) || 1800,
        Number(data.protein_goal) || 150,
        Number(data.carbs_goal) || 200,
        Number(data.fat_goal) || 60,
        Number(data.weight_target) || 75,
      ]
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
