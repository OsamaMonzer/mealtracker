import { NextResponse } from 'next/server';
import { createClient } from '../../../../../utils/supabase/server';

export const dynamic = 'force-dynamic';

// GET /api/recipes/[id]/ingredients
// Returns the ingredient list for a recipe with full macro data
export async function GET(request, { params }) {
  try {
    const { id } = params;
    const supabase = createClient();
    
    // Opt-in authentication check for security
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data, error } = await supabase
      .from('recipe_ingredients')
      .select(`
        ingredient_id, weight_g,
        ingredients ( name, calories_100g, protein_100g, carbs_100g, fat_100g )
      `)
      .eq('recipe_id', id);

    if (error) throw new Error(error.message);

    // Map nested PostgREST response to flat format expected by client
    const rows = data.map(row => {
      const ing = row.ingredients || {};
      return {
        ingredient_id: row.ingredient_id,
        name: ing.name,
        weight_g: row.weight_g,
        calories_100g: ing.calories_100g,
        protein_100g: ing.protein_100g,
        carbs_100g: ing.carbs_100g,
        fat_100g: ing.fat_100g
      };
    });

    // Optionally sort by name like the old SQL query
    rows.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    return NextResponse.json(rows);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
