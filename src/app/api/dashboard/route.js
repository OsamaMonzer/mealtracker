import { NextResponse } from 'next/server';
import { createClient } from '../../../utils/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // 1. Fetch Weight Logs
    const { data: weights, error: wError } = await supabase
      .from('weight_logs')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: true });
    
    if (wError) throw new Error(wError.message);

    const startingWeight = weights.length > 0 ? weights[0].weight_kg : null;
    const currentWeight = weights.length > 0 ? weights[weights.length - 1].weight_kg : null;
    const weightChange = startingWeight && currentWeight ? (currentWeight - startingWeight).toFixed(1) : 0;

    // 2. Fetch Recipes and calculate their macros
    // Using Supabase embedded joins to retrieve recipe_ingredients and their nested ingredients
    const { data: allReq, count, error: rError } = await supabase
      .from('recipes')
      .select(`
        id, portions,
        recipe_ingredients (
          weight_g,
          ingredients (
            calories_100g, protein_100g, carbs_100g, fat_100g
          )
        )
      `, { count: 'exact' })
      .eq('user_id', user.id);

    if (rError) throw new Error(rError.message);

    const recipeMacros = {};
    allReq.forEach(recipe => {
      let c = 0, p = 0, cb = 0, f = 0;
      (recipe.recipe_ingredients || []).forEach(ri => {
        const ratio = ri.weight_g / 100;
        const ing = ri.ingredients || {};
        c += (ing.calories_100g || 0) * ratio;
        p += (ing.protein_100g || 0) * ratio;
        cb += (ing.carbs_100g || 0) * ratio;
        f += (ing.fat_100g || 0) * ratio;
      });
      recipeMacros[recipe.id] = { c, p, cb, f, portions: recipe.portions || 1 };
    });

    // 3. Fetch Daily Logs
    const { data: logs, error: lError } = await supabase
      .from('daily_logs')
      .select('date, portions_eaten, recipe_id')
      .eq('user_id', user.id)
      .order('date', { ascending: true });
      
    if (lError) throw new Error(lError.message);

    const dailyHash = {};
    logs.forEach(log => {
      const macros = recipeMacros[log.recipe_id] || { c: 0, p: 0, cb: 0, f: 0, portions: 1 };
      const portionsPlayed = log.portions_eaten / macros.portions;
      const date = log.date;
      if (!dailyHash[date]) dailyHash[date] = { cals: 0, p: 0, c: 0, f: 0 };
      dailyHash[date].cals += macros.c * portionsPlayed;
      dailyHash[date].p += macros.p * portionsPlayed;
      dailyHash[date].c += macros.cb * portionsPlayed;
      dailyHash[date].f += macros.f * portionsPlayed;
    });

    const todayDate = new Date().toISOString().split('T')[0];
    const todayMacros = dailyHash[todayDate] || { cals: 0, p: 0, c: 0, f: 0 };

    // All sorted dates for history navigation
    const allDates = Object.keys(dailyHash).sort();
    const last7 = allDates.slice(-7);
    const weeklyAvgCals = last7.length > 0
      ? last7.reduce((acc, d) => acc + dailyHash[d].cals, 0) / last7.length
      : 0;

    // Chart: last 30 days with actual date key
    const last30 = allDates.slice(-30);
    const chartData = last30.map(d => ({
      name: new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      date: d,
      Calories: Math.round(dailyHash[d].cals),
    }));

    const { data: userGoal } = await supabase.from('goals').select('display_name').eq('user_id', user.id).maybeSingle();
    const dbName = userGoal?.display_name;

    return NextResponse.json({
      userName: dbName || user.user_metadata?.display_name || user.user_metadata?.full_name || 'My',
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
      allDates,
      weightLogData: (weights || []).slice(-14).map(w => ({
        name: new Date(w.date + 'T00:00:00').toLocaleDateString('en-US', { day: 'numeric', month: 'short' }),
        Weight: w.weight_kg,
        hasPhoto: !!w.photo_url,
        fullLog: w,
      })),
    });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
