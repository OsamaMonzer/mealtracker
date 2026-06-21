import { NextResponse } from 'next/server';
import { openDb } from '../../../../lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const body = await request.json();
    if (!body) return NextResponse.json({ error: 'Missing body' }, { status: 400 });
    const { ingredients = [], recipes = [], recipe_ingredients = [], daily_logs = [], weight_logs = [] } = body;

    const db = await openDb();
    // best-effort: replace data in tables
    try {
      await db.run('BEGIN TRANSACTION');
      await db.run('DELETE FROM recipe_ingredients');
      await db.run('DELETE FROM daily_logs');
      await db.run('DELETE FROM weight_logs');
      await db.run('DELETE FROM recipes');
      await db.run('DELETE FROM ingredients');

      for (const i of ingredients) {
        await db.run(`INSERT INTO ingredients (name, category, brand, status, calories_100g, protein_100g, carbs_100g, fat_100g, price_kg, notes, serving_label, serving_grams) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [i.name, i.category || 'Other', i.brand || '', i.status || 'Raw', i.calories_100g || 0, i.protein_100g || 0, i.carbs_100g || 0, i.fat_100g || 0, i.price_kg || null, i.notes || '', i.serving_label || null, i.serving_grams || null]);
      }

      for (const r of recipes) {
        await db.run(`INSERT INTO recipes (name, portions, created_at) VALUES (?, ?, ?)`, [r.name, r.portions || 1, r.created_at || null]);
      }

      for (const ri of recipe_ingredients) {
        await db.run(`INSERT INTO recipe_ingredients (recipe_id, ingredient_id, weight_g) VALUES (?, ?, ?)`, [ri.recipe_id, ri.ingredient_id, ri.weight_g || 0]);
      }

      for (const d of daily_logs) {
        await db.run(`INSERT INTO daily_logs (date, meal_type, recipe_id, portions_eaten) VALUES (?, ?, ?, ?)`, [d.date, d.meal_type, d.recipe_id, d.portions_eaten]);
      }

      for (const w of weight_logs) {
        await db.run(`INSERT INTO weight_logs (date, weight_kg) VALUES (?, ?)`, [w.date, w.weight_kg]);
      }

      await db.run('COMMIT');
    } catch (e) {
      try { await db.run('ROLLBACK'); } catch (e2) {}
      throw e;
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('Full restore error', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
