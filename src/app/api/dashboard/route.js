import { NextResponse } from 'next/server';
import { openDb } from '../../../lib/db';

export async function GET() {
  try {
    const db = await openDb();
    
    // Recipes count
    const { count } = await db.get('SELECT COUNT(*) as count FROM recipes') || { count: 0 };
    
    // Weight logic
    const weights = await db.all('SELECT * FROM weight_logs ORDER BY date ASC');
    const startingWeight = weights.length > 0 ? weights[0].weight_kg : null;
    const currentWeight = weights.length > 0 ? weights[weights.length-1].weight_kg : null;
    const weightChange = startingWeight && currentWeight ? (currentWeight - startingWeight).toFixed(1) : 0;
    
    // Daily tracking logic
    const logs = await db.all(`
      SELECT d.date, d.portions_eaten, r.portions as recipe_portions, d.recipe_id
      FROM daily_logs d
      JOIN recipes r ON d.recipe_id = r.id
      ORDER BY d.date ASC
    `);

    const allReq = await db.all(`
      SELECT ri.recipe_id, ri.weight_g, i.calories_100g, i.protein_100g, i.carbs_100g, i.fat_100g
      FROM recipe_ingredients ri
      JOIN ingredients i ON ri.ingredient_id = i.id
    `);

    const recipeMacros = {};
    allReq.forEach(row => {
       if(!recipeMacros[row.recipe_id]) recipeMacros[row.recipe_id] = {c:0, p:0, cb:0, f:0};
       const ratio = row.weight_g / 100;
       recipeMacros[row.recipe_id].c += row.calories_100g * ratio;
       recipeMacros[row.recipe_id].p += row.protein_100g * ratio;
       recipeMacros[row.recipe_id].cb += row.carbs_100g * ratio;
       recipeMacros[row.recipe_id].f += row.fat_100g * ratio;
    });

    const dailyHash = {};
    logs.forEach(log => {
      const macros = recipeMacros[log.recipe_id] || {c:0, p:0, cb:0, f:0};
      const portions = log.portions_eaten / log.recipe_portions;
      const date = log.date;
      if(!dailyHash[date]) dailyHash[date] = { cals: 0, p: 0, c: 0, f: 0 };
      dailyHash[date].cals += macros.c * portions;
      dailyHash[date].p += macros.p * portions;
      dailyHash[date].c += macros.cb * portions;
      dailyHash[date].f += macros.f * portions;
    });

    const todayDate = new Date().toISOString().split('T')[0];
    const todayMacros = dailyHash[todayDate] || { cals: 0, p: 0, c: 0, f: 0 };

    const dates = Object.keys(dailyHash).sort().slice(-7);
    const weeklyAvgCals = dates.length > 0 ? dates.reduce((acc, d) => acc + dailyHash[d].cals, 0) / dates.length : 0;

    const chartData = dates.map(d => ({
       name: new Date(d).toLocaleDateString('en-US', { weekday: 'short' }),
       Calories: dailyHash[d].cals
    }));

    return NextResponse.json({
      recipesSaved: count,
      startingWeight,
      currentWeight,
      weightChange,
      todayMacros: {
          cals: Math.round(todayMacros.cals),
          p: Math.round(todayMacros.p),
          c: Math.round(todayMacros.c),
          f: Math.round(todayMacros.f),
      },
      weeklyAvgCals: Math.round(weeklyAvgCals),
      chartData,
      weightLogData: weights.slice(-7).map(w => ({ name: new Date(w.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short'}), Weight: w.weight_kg }))
    });

  } catch(error) {
     console.error('API Error:', error);
     return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
