import { NextResponse } from 'next/server';
import { openDb } from '../../../../lib/db';

export const dynamic = 'force-dynamic';

// POST /api/daily/one-off
// Creates a temporary 'one_off' recipe with custom ingredient weights
// and logs it for the given date — without touching the saved recipe.
export async function POST(request) {
  try {
    const { date, meal_type, recipe_name, portions, ingredients } = await request.json();

    if (!date || !recipe_name || !ingredients || ingredients.length === 0) {
      return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
    }

    const db = await openDb();

    await db.exec('BEGIN TRANSACTION');
    try {
      // Create a hidden one-off recipe
      const recRes = await db.run(
        "INSERT INTO recipes (name, portions, status) VALUES (?, ?, 'one_off')",
        [recipe_name, portions || 1]
      );
      const recipeId = recRes.lastID;

      // Insert ingredients with the (potentially edited) weights
      for (const ing of ingredients) {
        if (!ing.ingredient_id || ing.weight_g <= 0) continue;
        await db.run(
          'INSERT INTO recipe_ingredients (recipe_id, ingredient_id, weight_g) VALUES (?, ?, ?)',
          [recipeId, ing.ingredient_id, ing.weight_g]
        );
      }

      // Log it — portions=1 because the recipe itself already encodes the full quantity
      await db.run(
        'INSERT INTO daily_logs (date, meal_type, recipe_id, portions_eaten) VALUES (?, ?, ?, ?)',
        [date, meal_type || 'Snack', recipeId, portions || 1]
      );

      await db.exec('COMMIT');
      return NextResponse.json({ success: true });
    } catch (err) {
      await db.exec('ROLLBACK');
      throw err;
    }
  } catch (error) {
    console.error('one-off log error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
