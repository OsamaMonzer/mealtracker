import { NextResponse } from 'next/server';
import { createClient } from '../../../utils/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Fetch daily logs and fully nest recipes > recipe_ingredients > ingredients
    const { data: rawLogs, error } = await supabase
      .from('daily_logs')
      .select(`
        id, date, meal_type, recipe_id, portions_eaten,
        recipes (
          name, portions,
          recipe_ingredients (
            weight_g,
            ingredients ( calories_100g, protein_100g, carbs_100g, fat_100g )
          )
        )
      `)
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .order('id', { ascending: false });

    if (error) throw new Error(error.message);

    if (!rawLogs || rawLogs.length === 0) return NextResponse.json([]);

    // Find the last 15 distinct dates
    const distinctDates = [...new Set(rawLogs.map(l => l.date))].slice(0, 15);
    
    // Filter out older logs
    const recentLogs = rawLogs.filter(l => distinctDates.includes(l.date));

    const fullLogs = recentLogs.map(log => {
      const rec = log.recipes || {};
      const portions = rec.portions || 1;
      const eaten = log.portions_eaten || 1;
      
      let totC = 0, totP = 0, totCb = 0, totF = 0;
      (rec.recipe_ingredients || []).forEach(ri => {
        const ratio = ri.weight_g / 100;
        const ing = ri.ingredients || {};
        totC += (ing.calories_100g || 0) * ratio;
        totP += (ing.protein_100g || 0) * ratio;
        totCb += (ing.carbs_100g || 0) * ratio;
        totF += (ing.fat_100g || 0) * ratio;
      });

      return {
        id: log.id,
        date: log.date,
        meal_type: log.meal_type,
        recipe_id: log.recipe_id,
        portions_eaten: log.portions_eaten,
        recipe_name: rec.name || 'Unknown',
        calories: (totC / portions) * eaten,
        protein: (totP / portions) * eaten,
        carbs: (totCb / portions) * eaten,
        fat: (totF / portions) * eaten,
      };
    });

    return NextResponse.json(fullLogs);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const data = await request.json();
    let { date, meal_type, recipe_id, portions_eaten, quick_add_name, quick_add_calories, ingredient_id, weight_g } = data;
    
    if (!date) return NextResponse.json({error:'Invalid data'}, {status: 400});

    // Handle single ingredient addition
    if (ingredient_id) {
      if (isNaN(weight_g)) return NextResponse.json({error:'Invalid weight'}, {status: 400});
      
      // See if a single_ingredient wrapper recipe already exists for this ingredient
      const { data: existingRecs } = await supabase
        .from('recipes')
        .select(`id, recipe_ingredients!inner(ingredient_id)`)
        .eq('status', 'single_ingredient')
        .eq('user_id', user.id)
        .eq('recipe_ingredients.ingredient_id', ingredient_id)
        .limit(1);

      if (existingRecs && existingRecs.length > 0) {
        recipe_id = existingRecs[0].id;
      } else {
        // Fetch ingredient name
        const { data: ing } = await supabase.from('ingredients').select('name').eq('id', ingredient_id).single();
        if (!ing) throw new Error("Ingredient not found");
        
        // Create single ingredient hidden recipe
        const { data: newRec, error: recErr } = await supabase
          .from('recipes')
          .insert({ name: ing.name, portions: 1, status: 'single_ingredient', user_id: user.id })
          .select('id').single();
        if (recErr) throw new Error(recErr.message);
        
        recipe_id = newRec.id;
        
        // Link ingredient (100g = 1 portion)
        const { error: linkErr } = await supabase
          .from('recipe_ingredients')
          .insert({ recipe_id, ingredient_id, weight_g: 100 });
        if (linkErr) throw new Error(linkErr.message);
      }
      
      portions_eaten = parseFloat(weight_g) / 100.0;
    } 
    // Handle Quick Add macro numbers
    else if (recipe_id === 'QUICK_ADD') {
      if (!quick_add_name || isNaN(quick_add_calories)) return NextResponse.json({error:'Invalid quick add data'}, {status: 400});
      
      const uniqueKey = `${quick_add_name}__qa_${Date.now()}`;

      // Create hidden ingredient with unique internal name
      const { data: newIng, error: ingErr } = await supabase
        .from('ingredients')
        .insert({
          name: uniqueKey, category: 'Other', brand: '', status: 'quick_add',
          calories_100g: parseFloat(quick_add_calories), protein_100g: 0, carbs_100g: 0, fat_100g: 0,
          user_id: user.id
        })
        .select('id').single();
      if (ingErr) throw new Error(ingErr.message);

      // Recipe keeps the user-friendly name
      const { data: newRec, error: recErr } = await supabase
        .from('recipes')
        .insert({ name: quick_add_name, portions: 1, status: 'quick_add', user_id: user.id })
        .select('id').single();
      if (recErr) throw new Error(recErr.message);
      
      recipe_id = newRec.id;
      const { error: linkErr } = await supabase
        .from('recipe_ingredients')
        .insert({ recipe_id, ingredient_id: newIng.id, weight_g: 100 });
      if (linkErr) throw new Error(linkErr.message);
    } 
    else if (!recipe_id || isNaN(portions_eaten)) {
      return NextResponse.json({error:'Invalid data'}, {status: 400});
    }

    // Insert the daily log!
    const { data: resultLog, error: logErr } = await supabase
      .from('daily_logs')
      .insert({
        date,
        meal_type: meal_type || 'Snack',
        recipe_id,
        portions_eaten: parseFloat(portions_eaten),
        user_id: user.id
      })
      .select('id').single();

    if (logErr) throw new Error(logErr.message);
    
    return NextResponse.json({ success: true, id: resultLog.id });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
