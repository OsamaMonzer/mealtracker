import { NextResponse } from 'next/server';
import { createClient } from '../../../utils/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    if (!date) return NextResponse.json({ error: 'date required' }, { status: 400 });

    const { data: logs, error } = await supabase
      .from('daily_logs')
      .select(`
        id, date, meal_type, recipe_id, portions_eaten,
        recipes (
          name, portions,
          recipe_ingredients (
            weight_g, ingredient_id,
            ingredients ( name, calories_100g, protein_100g, carbs_100g, fat_100g )
          )
        )
      `)
      .eq('date', date)
      .eq('user_id', user.id)
      .order('id', { ascending: true });

    if (error) throw new Error(error.message);

    if (!logs || logs.length === 0) {
      return NextResponse.json({ date, logs: [], totals: { cals: 0, p: 0, c: 0, f: 0 } });
    }

    const fullLogs = logs.map(log => {
      let totalCals = 0, totalP = 0, totalC = 0, totalF = 0;
      const rec = log.recipes || {};
      const recipe_portions = rec.portions || 1;
      
      const ingredients = (rec.recipe_ingredients || []).map(ri => {
        const i = ri.ingredients || {};
        const ratio = ri.weight_g / 100;
        totalCals += (i.calories_100g || 0) * ratio;
        totalP    += (i.protein_100g || 0)  * ratio;
        totalC    += (i.carbs_100g || 0)    * ratio;
        totalF    += (i.fat_100g || 0)      * ratio;
        
        return {
          recipe_id: log.recipe_id,
          ingredient_id: ri.ingredient_id,
          ing_name: i.name,
          calories_100g: i.calories_100g,
          protein_100g: i.protein_100g,
          carbs_100g: i.carbs_100g,
          fat_100g: i.fat_100g,
          weight_g: ri.weight_g
        };
      });

      const rp = recipe_portions;
      const pe = log.portions_eaten || 1;

      return {
        id: log.id,
        date: log.date,
        meal_type: log.meal_type,
        recipe_id: log.recipe_id,
        portions_eaten: log.portions_eaten,
        recipe_name: rec.name,
        recipe_portions,
        calories: Math.round((totalCals / rp) * pe),
        protein:  Math.round((totalP    / rp) * pe * 10) / 10,
        carbs:    Math.round((totalC    / rp) * pe * 10) / 10,
        fat:      Math.round((totalF    / rp) * pe * 10) / 10,
        ingredients,
      };
    });

    const totals = fullLogs.reduce(
      (acc, l) => ({ cals: acc.cals + l.calories, p: acc.p + l.protein, c: acc.c + l.carbs, f: acc.f + l.fat }),
      { cals: 0, p: 0, c: 0, f: 0 }
    );

    return NextResponse.json({ date, logs: fullLogs, totals });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
