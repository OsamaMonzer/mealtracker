import { NextResponse } from 'next/server';
import { createClient } from '../../../utils/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const slim = searchParams.get('slim') === '1';

    if (slim) {
      const { data, error } = await supabase
        .from('recipes')
        .select('id, name, portions')
        .eq('status', 'active')
        .eq('user_id', user.id)
        .order('name', { ascending: true });
        
      if (error) throw new Error(error.message);
      return NextResponse.json(data);
    }

    // Full fetch with nested ingredients
    const { data, error } = await supabase
      .from('recipes')
      .select(`
        id, name, portions, status, user_id, created_at,
        recipe_ingredients (
          weight_g,
          ingredients ( id, name, calories_100g, protein_100g, carbs_100g, fat_100g, price_kg )
        )
      `)
      .eq('status', 'active')
      .eq('user_id', user.id)
      .order('name', { ascending: true });

    if (error) throw new Error(error.message);

    const fullRecipes = data.map(r => {
      let totalCals = 0, totalP = 0, totalC = 0, totalF = 0, totalW = 0;
      
      const ingredients = (r.recipe_ingredients || []).map(ri => {
        const i = ri.ingredients || {};
        const ratio = ri.weight_g / 100;
        totalCals += (i.calories_100g || 0) * ratio;
        totalP    += (i.protein_100g || 0)  * ratio;
        totalC    += (i.carbs_100g || 0)    * ratio;
        totalF    += (i.fat_100g || 0)      * ratio;
        totalW    += ri.weight_g;
        
        return {
          recipe_id: r.id,
          name: i.name,
          calories_100g: i.calories_100g,
          protein_100g: i.protein_100g,
          carbs_100g: i.carbs_100g,
          fat_100g: i.fat_100g,
          price_kg: i.price_kg,
          weight_g: ri.weight_g,
          ingredient_id: i.id // Mapping needed for client side updates
        };
      });

      return {
        id: r.id, name: r.name, portions: r.portions, status: r.status, user_id: r.user_id, created_at: r.created_at,
        ingredients,
        totalCals, totalP, totalC, totalF, totalW,
        calsPerPortion: totalCals / (r.portions || 1),
        pPerPortion:    totalP    / (r.portions || 1),
        cPerPortion:    totalC    / (r.portions || 1),
        fPerPortion:    totalF    / (r.portions || 1),
      };
    });

    return NextResponse.json(fullRecipes);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { name, portions, ingredients } = await request.json();
    if (!name || !ingredients || ingredients.length === 0) return NextResponse.json({error:'Invalid data'}, {status: 400});

    const { data: rec, error: recErr } = await supabase
      .from('recipes')
      .insert({ name, portions: portions || 1, user_id: user.id })
      .select('id').single();
      
    if (recErr) throw new Error(recErr.message);

    const mapping = ingredients.map(item => ({
      recipe_id: rec.id,
      ingredient_id: item.ingredient_id,
      weight_g: parseFloat(item.weight_g)
    }));

    if (mapping.length > 0) {
      const { error: insErr } = await supabase.from('recipe_ingredients').insert(mapping);
      if (insErr) throw new Error(insErr.message);
    }
    
    return NextResponse.json({ success: true, id: rec.id });
  } catch (error) {
    console.error("Recipe save error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
