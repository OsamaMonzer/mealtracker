import { NextResponse } from 'next/server';
import { openDb } from '../../../../lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const db = await openDb();
    const ingredients = await db.all('SELECT * FROM ingredients');
    const recipes = await db.all('SELECT * FROM recipes');
    const recipe_ingredients = await db.all('SELECT * FROM recipe_ingredients');
    const daily_logs = await db.all('SELECT * FROM daily_logs');
    const weight_logs = await db.all('SELECT * FROM weight_logs');

    const payload = { ingredients, recipes, recipe_ingredients, daily_logs, weight_logs, exported_at: new Date().toISOString() };
    return NextResponse.json(payload, { status: 200 });
  } catch (e) {
    console.error('Full backup error', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
