import { NextResponse } from 'next/server';
import { openDb } from '../../../lib/db';
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

    const db = await openDb();

    const logs = await db.all(`
      SELECT d.id, d.date, d.meal_type, d.recipe_id, d.portions_eaten,
             r.name as recipe_name, r.portions as recipe_portions
      FROM daily_logs d
      JOIN recipes r ON d.recipe_id = r.id
      WHERE d.date = ? AND d.user_id = ?
      ORDER BY d.id ASC
    `, [date, user.id]);

    if (!logs.length) return NextResponse.json({ date, logs: [], totals: { cals: 0, p: 0, c: 0, f: 0 } });

    // Fetch all ingredients for all logs in this day in one query (no N+1)
    const recipeIds = [...new Set(logs.map(l => l.recipe_id))];
    const placeholders = recipeIds.map(() => '?').join(',');
    const allIngs = await db.all(`
      SELECT ri.recipe_id, ri.ingredient_id, i.name as ing_name,
             i.calories_100g, i.protein_100g, i.carbs_100g, i.fat_100g, ri.weight_g
      FROM recipe_ingredients ri
      JOIN ingredients i ON ri.ingredient_id = i.id
      WHERE ri.recipe_id IN (${placeholders})
    `, recipeIds);

    const ingsByRecipe = {};
    for (const ing of allIngs) {
      if (!ingsByRecipe[ing.recipe_id]) ingsByRecipe[ing.recipe_id] = [];
      ingsByRecipe[ing.recipe_id].push(ing);
    }

    const fullLogs = logs.map(log => {
      const ingredients = ingsByRecipe[log.recipe_id] || [];
      let totalCals = 0, totalP = 0, totalC = 0, totalF = 0;
      ingredients.forEach(i => {
        const ratio = i.weight_g / 100;
        totalCals += i.calories_100g * ratio;
        totalP    += i.protein_100g  * ratio;
        totalC    += i.carbs_100g    * ratio;
        totalF    += i.fat_100g      * ratio;
      });

      const rp = log.recipe_portions || 1;
      const pe = log.portions_eaten  || 1;

      return {
        ...log,
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
