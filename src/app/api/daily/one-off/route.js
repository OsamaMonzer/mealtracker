import { NextResponse } from 'next/server';
import { createClient } from '../../../../utils/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { date, meal_type, recipe_name, portions, ingredients } = await request.json();

    if (!date || !recipe_name || !ingredients || ingredients.length === 0) {
      return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
    }

    const { data: rec, error: recErr } = await supabase
      .from('recipes')
      .insert({ name: recipe_name, portions: portions || 1, status: 'one_off', user_id: user.id })
      .select('id').single();
      
    if (recErr) throw new Error(recErr.message);

    const mapping = ingredients
      .filter(ing => ing.ingredient_id && ing.weight_g > 0)
      .map(ing => ({ recipe_id: rec.id, ingredient_id: ing.ingredient_id, weight_g: parseFloat(ing.weight_g) }));

    if (mapping.length > 0) {
      const { error: insErr } = await supabase.from('recipe_ingredients').insert(mapping);
      if (insErr) throw new Error(insErr.message);
    }

    const { error: logErr } = await supabase
      .from('daily_logs')
      .insert({
        date,
        meal_type: meal_type || 'Snack',
        recipe_id: rec.id,
        portions_eaten: portions || 1,
        user_id: user.id
      });

    if (logErr) throw new Error(logErr.message);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('one-off log error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
