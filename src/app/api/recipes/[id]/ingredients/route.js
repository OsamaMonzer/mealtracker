import { NextResponse } from 'next/server';
import { openDb } from '../../../../../lib/db';

export const dynamic = 'force-dynamic';

// GET /api/recipes/[id]/ingredients
// Returns the ingredient list for a recipe with full macro data
export async function GET(request, { params }) {
  try {
    const { id } = params;
    const db = await openDb();
    const rows = await db.all(`
      SELECT
        ri.ingredient_id,
        i.name,
        ri.weight_g,
        i.calories_100g,
        i.protein_100g,
        i.carbs_100g,
        i.fat_100g
      FROM recipe_ingredients ri
      JOIN ingredients i ON ri.ingredient_id = i.id
      WHERE ri.recipe_id = ?
      ORDER BY i.name
    `, [id]);
    return NextResponse.json(rows);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
