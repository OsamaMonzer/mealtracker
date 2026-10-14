import { NextResponse } from 'next/server';
import { createClient } from '../../../utils/supabase/server';
import { normalizeName, fetchOffProduct, ingredientFromOff, logMacros } from '../../../lib/nutrition';
import { todayInTz, addDays } from '../../../lib/dates';

export const dynamic = 'force-dynamic';

const today = () => todayInTz();

const LOG_SELECT = 'id, date, meal_type, recipe_id, portions_eaten, recipes(name, portions, recipe_ingredients(weight_g, ingredients(calories_100g, protein_100g, carbs_100g, fat_100g)))';

function summarizeLogs(logs) {
  const meals = [];
  const totals = { calories: 0, protein: 0, carbs: 0, fat: 0 };
  for (const log of logs || []) {
    const m = logMacros(log);
    totals.calories += m.calories; totals.protein += m.protein; totals.carbs += m.carbs; totals.fat += m.fat;
    meals.push({ id: log.id, meal_type: log.meal_type, name: log.recipes?.name, ...m });
  }
  totals.protein = Math.round(totals.protein * 10) / 10;
  totals.carbs = Math.round(totals.carbs * 10) / 10;
  totals.fat = Math.round(totals.fat * 10) / 10;
  return { meals, totals };
}

async function logsForDate(supabase, userId, date) {
  const { data, error } = await supabase.from('daily_logs').select(LOG_SELECT)
    .eq('date', date).eq('user_id', userId).order('id', { ascending: true });
  if (error) throw new Error(error.message);
  return data || [];
}

const NOISE_WORDS = new Set([
  'raw','cooked','boiled','grilled','fried','baked','steamed','roasted',
  'fresh','frozen','dried','canned','smoked','salted','unsalted','plain',
  'whole','boneless','skinless','lean','extra','organic','natural',
  'low','fat','reduced','light','dark','white','brown','ground','minced',
  'sliced','diced','chopped','shredded','half','large','small','medium',
]);

function tokenize(str) {
  return normalizeName(str).split(/\s+/).filter(t => t.length > 1 && !NOISE_WORDS.has(t));
}

function scoreMatch(queryTokens, candidateName) {
  const candTokens = tokenize(candidateName);
  const candFull = normalizeName(candidateName);
  let score = 0;
  for (const qt of queryTokens) {
    if (candTokens.includes(qt)) { score += 10; continue; }
    if (candTokens.some(ct => ct.startsWith(qt) || qt.startsWith(ct))) { score += 6; continue; }
    if (candFull.includes(qt)) { score += 3; }
  }
  const coverage = queryTokens.filter(qt => candFull.includes(qt)).length / Math.max(queryTokens.length, 1);
  score += coverage * 5;
  return score;
}

async function fuzzySearchIngredients(supabase, userId, rawQuery) {
  const tokens = tokenize(rawQuery);
  if (tokens.length === 0) return [];

  // Build OR filter using ilike for each token
  const orFilter = tokens.map(t => `name.ilike.%${t}%`).join(',');

  const { data } = await supabase
    .from('ingredients')
    .select('id, name, brand, category, calories_100g, protein_100g, carbs_100g, fat_100g')
    .not('status', 'in', '("quick_add","single_ingredient","one_off")')
    .or(`user_id.is.null,user_id.eq.${userId}`)
    .or(orFilter);

  if (!data || data.length === 0) return [];
  const scored = data.map(c => ({ ...c, _score: scoreMatch(tokens, c.name) }));
  scored.sort((a, b) => b._score - a._score);
  return scored;
}

async function computeMacros(supabase, recipeId, recipePortions, portionsEaten) {
  const { data: ings } = await supabase
    .from('recipe_ingredients')
    .select('weight_g, ingredients(calories_100g, protein_100g, carbs_100g, fat_100g)')
    .eq('recipe_id', recipeId);
  return logMacros({ portions_eaten: portionsEaten, recipes: { portions: recipePortions, recipe_ingredients: ings } });
}

export async function POST(request) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const { action, ...p } = body;

    // ── get_today_summary ────────────────────────────────────────────────
    if (action === 'get_today_summary') {
      const date = p.date || today();
      const { meals, totals } = summarizeLogs(await logsForDate(supabase, user.id, date));
      const { data: goals } = await supabase.from('goals').select('*').eq('user_id', user.id).maybeSingle();
      const g = goals || { calorie_goal: 1800, protein_goal: 150, carbs_goal: 200, fat_goal: 60 };
      return NextResponse.json({ date, meals, totals, goals: { calories: g.calorie_goal, protein: g.protein_goal, carbs: g.carbs_goal, fat: g.fat_goal }, remaining: { calories: Math.max(0, g.calorie_goal - totals.calories), protein: Math.max(0, g.protein_goal - totals.protein), carbs: Math.max(0, g.carbs_goal - totals.carbs), fat: Math.max(0, g.fat_goal - totals.fat) } });
    }

    // ── get_history ──────────────────────────────────────────────────────
    if (action === 'get_history') {
      const date = p.date || today();
      const { meals, totals } = summarizeLogs(await logsForDate(supabase, user.id, date));
      return NextResponse.json({ date, meals, totals });
    }

    // ── get_weekly_stats ─────────────────────────────────────────────────
    if (action === 'get_weekly_stats') {
      const end = today();
      const start = addDays(end, -6);
      const { data: logs, error } = await supabase.from('daily_logs').select(LOG_SELECT)
        .eq('user_id', user.id).gte('date', start).lte('date', end);
      if (error) throw new Error(error.message);
      const days = [];
      for (let i = 0; i < 7; i++) {
        const date = addDays(start, i);
        const dayLogs = (logs || []).filter(l => l.date === date);
        const { totals } = summarizeLogs(dayLogs);
        days.push({ date, ...totals, meals: dayLogs.length });
      }
      const avg = k => Math.round(days.reduce((s, d) => s + d[k], 0) / days.length);
      return NextResponse.json({ days, averages: { calories: avg('calories'), protein: avg('protein'), carbs: avg('carbs'), fat: avg('fat') } });
    }

    // ── list_ingredients ─────────────────────────────────────────────────
    if (action === 'list_ingredients') {
      const { data } = await supabase.from('ingredients').select('id, name, brand, category, calories_100g, protein_100g, carbs_100g, fat_100g, serving_label, serving_grams')
        .not('status', 'in', '("quick_add","single_ingredient","one_off")')
        .or(`user_id.is.null,user_id.eq.${user.id}`)
        .order('name', { ascending: true });
      return NextResponse.json({ ingredients: data || [] });
    }

    // ── list_recipes ─────────────────────────────────────────────────────
    if (action === 'list_recipes') {
      const { data: recipes } = await supabase.from('recipes').select(`id, name, portions, recipe_ingredients(weight_g, ingredients(id, name, calories_100g, protein_100g, carbs_100g, fat_100g))`).eq('status', 'active').eq('user_id', user.id).order('name', { ascending: true });
      const full = (recipes || []).map(r => {
        const ings = (r.recipe_ingredients || []).map(ri => ({ ...ri.ingredients, weight_g: ri.weight_g }));
        let tc = 0, tp = 0, tcb = 0, tf = 0;
        ings.forEach(i => { const ratio = i.weight_g / 100; tc += (i.calories_100g || 0) * ratio; tp += (i.protein_100g || 0) * ratio; tcb += (i.carbs_100g || 0) * ratio; tf += (i.fat_100g || 0) * ratio; });
        return { id: r.id, name: r.name, portions: r.portions, ingredients: ings, total: { calories: Math.round(tc), protein: Math.round(tp * 10) / 10, carbs: Math.round(tcb * 10) / 10, fat: Math.round(tf * 10) / 10 }, per_portion: { calories: Math.round(tc / r.portions), protein: Math.round(tp / r.portions * 10) / 10, carbs: Math.round(tcb / r.portions * 10) / 10, fat: Math.round(tf / r.portions * 10) / 10 } };
      });
      return NextResponse.json({ recipes: full });
    }

    // ── search_ingredient ────────────────────────────────────────────────
    if (action === 'search_ingredient') {
      const q = (p.query || '').trim();
      if (!q) return NextResponse.json({ error: 'query required' }, { status: 400 });
      const results = await fuzzySearchIngredients(supabase, user.id, q);
      return NextResponse.json({ local_results: results });
    }

    // ── log_food ─────────────────────────────────────────────────────────
    if (action === 'log_food') {
      const { name, weight_g, meal_type, date, calories_100g, protein_100g, carbs_100g, fat_100g } = p;
      if (!name || !weight_g) return NextResponse.json({ error: 'name and weight_g required' }, { status: 400 });

      const matches = await fuzzySearchIngredients(supabase, user.id, name);
      let ingredient = matches.length > 0 && matches[0]._score >= 6 ? matches[0] : null;

      if (!ingredient) {
        if (calories_100g === undefined) {
          return NextResponse.json({ error: 'ingredient_not_found', message: `"${name}" not found. Please provide calories_100g to add it.`, fuzzy_candidates: matches.slice(0, 5).map(m => ({ id: m.id, name: m.name, score: m._score })) }, { status: 404 });
        }
        const { data: newIng } = await supabase.from('ingredients').insert({ name: name.trim(), category: 'Other', brand: '', status: 'Raw', calories_100g: parseFloat(calories_100g), protein_100g: parseFloat(protein_100g) || 0, carbs_100g: parseFloat(carbs_100g) || 0, fat_100g: parseFloat(fat_100g) || 0, notes: 'Added via AI', user_id: user.id }).select().single();
        ingredient = newIng;
      }

      // single_ingredient recipe wrapper
      const { data: existRecs } = await supabase.from('recipes').select('id, recipe_ingredients!inner(ingredient_id)').eq('status', 'single_ingredient').eq('user_id', user.id).eq('recipe_ingredients.ingredient_id', ingredient.id).limit(1);
      let recipe_id;
      if (existRecs && existRecs.length > 0) {
        recipe_id = existRecs[0].id;
      } else {
        const { data: nr } = await supabase.from('recipes').insert({ name: ingredient.name, portions: 1, status: 'single_ingredient', user_id: user.id }).select('id').single();
        recipe_id = nr.id;
        await supabase.from('recipe_ingredients').insert({ recipe_id, ingredient_id: ingredient.id, weight_g: 100 });
      }

      const portions_eaten = parseFloat(weight_g) / 100.0;
      const { data: logRes } = await supabase.from('daily_logs').insert({ date: date || today(), meal_type: meal_type || 'Snack', recipe_id, portions_eaten, user_id: user.id }).select('id').single();
      const macros = await computeMacros(supabase, recipe_id, 1, portions_eaten);
      return NextResponse.json({ success: true, log_id: logRes.id, ingredient_name: ingredient.name, ingredient_id: ingredient.id, weight_g: parseFloat(weight_g), was_in_db: true, matched_from: name, ...macros });
    }

    // ── log_meal ─────────────────────────────────────────────────────────
    if (action === 'log_meal') {
      const { recipe_id, portions_eaten, meal_type, date } = p;
      if (!recipe_id || !portions_eaten) return NextResponse.json({ error: 'recipe_id and portions_eaten required' }, { status: 400 });
      const { data: recipe } = await supabase.from('recipes').select('name, portions').eq('id', recipe_id).eq('user_id', user.id).maybeSingle();
      if (!recipe) return NextResponse.json({ error: 'recipe not found' }, { status: 404 });
      const { data: logRes, error: logErr } = await supabase.from('daily_logs').insert({ date: date || today(), meal_type: meal_type || 'Snack', recipe_id, portions_eaten: parseFloat(portions_eaten), user_id: user.id }).select('id').single();
      if (logErr) throw new Error(logErr.message);
      const macros = await computeMacros(supabase, recipe_id, recipe.portions, parseFloat(portions_eaten));
      return NextResponse.json({ success: true, log_id: logRes.id, recipe_name: recipe.name, ...macros });
    }

    // ── log_ingredient ───────────────────────────────────────────────────
    if (action === 'log_ingredient') {
      const { ingredient_id, weight_g, meal_type, date } = p;
      if (!ingredient_id || !weight_g) return NextResponse.json({ error: 'ingredient_id and weight_g required' }, { status: 400 });
      const { data: ing } = await supabase.from('ingredients').select('name').eq('id', ingredient_id).single();
      if (!ing) return NextResponse.json({ error: 'ingredient not found' }, { status: 404 });

      const { data: existRecs } = await supabase.from('recipes').select('id, recipe_ingredients!inner(ingredient_id)').eq('status', 'single_ingredient').eq('user_id', user.id).eq('recipe_ingredients.ingredient_id', ingredient_id).limit(1);
      let recipe_id;
      if (existRecs && existRecs.length > 0) {
        recipe_id = existRecs[0].id;
      } else {
        const { data: nr } = await supabase.from('recipes').insert({ name: ing.name, portions: 1, status: 'single_ingredient', user_id: user.id }).select('id').single();
        recipe_id = nr.id;
        await supabase.from('recipe_ingredients').insert({ recipe_id, ingredient_id, weight_g: 100 });
      }
      const portions_eaten = parseFloat(weight_g) / 100.0;
      const { data: logRes } = await supabase.from('daily_logs').insert({ date: date || today(), meal_type: meal_type || 'Snack', recipe_id, portions_eaten, user_id: user.id }).select('id').single();
      const macros = await computeMacros(supabase, recipe_id, 1, portions_eaten);
      return NextResponse.json({ success: true, log_id: logRes.id, ingredient_name: ing.name, weight_g: parseFloat(weight_g), ...macros });
    }

    // ── quick_add_calories ───────────────────────────────────────────────
    if (action === 'quick_add_calories') {
      const { name, calories, meal_type, date } = p;
      if (!name || calories === undefined) return NextResponse.json({ error: 'name and calories required' }, { status: 400 });
      const uniqueKey = `${name}__qa_${Date.now()}`;
      const { data: newIng } = await supabase.from('ingredients').insert({ name: uniqueKey, category: 'Other', brand: '', status: 'quick_add', calories_100g: parseFloat(calories), protein_100g: 0, carbs_100g: 0, fat_100g: 0, user_id: user.id }).select('id').single();
      const { data: newRec } = await supabase.from('recipes').insert({ name, portions: 1, status: 'quick_add', user_id: user.id }).select('id').single();
      await supabase.from('recipe_ingredients').insert({ recipe_id: newRec.id, ingredient_id: newIng.id, weight_g: 100 });
      const { data: logRes } = await supabase.from('daily_logs').insert({ date: date || today(), meal_type: meal_type || 'Snack', recipe_id: newRec.id, portions_eaten: 1, user_id: user.id }).select('id').single();
      return NextResponse.json({ success: true, log_id: logRes.id, name, calories: parseFloat(calories) });
    }

    // ── create_recipe ────────────────────────────────────────────────────
    if (action === 'create_recipe') {
      const { name, portions, ingredients } = p;
      if (!name || !ingredients || !ingredients.length) return NextResponse.json({ error: 'name and ingredients required' }, { status: 400 });
      const { data: newRec } = await supabase.from('recipes').insert({ name, portions: portions || 1, user_id: user.id }).select('id').single();
      const mapping = ingredients.map(item => ({ recipe_id: newRec.id, ingredient_id: item.ingredient_id, weight_g: item.weight_g }));
      await supabase.from('recipe_ingredients').insert(mapping);
      const macros = await computeMacros(supabase, newRec.id, portions || 1, portions || 1);
      return NextResponse.json({ success: true, recipe_id: newRec.id, name, portions: portions || 1, total_macros: macros, per_portion: { calories: Math.round(macros.calories / (portions || 1)), protein: Math.round(macros.protein / (portions || 1) * 10) / 10, carbs: Math.round(macros.carbs / (portions || 1) * 10) / 10, fat: Math.round(macros.fat / (portions || 1) * 10) / 10 } });
    }

    // ── add_ingredient ───────────────────────────────────────────────────
    if (action === 'add_ingredient') {
      const { name, calories_100g, protein_100g, carbs_100g, fat_100g, category, brand, serving_label, serving_grams } = p;
      if (!name || calories_100g === undefined) return NextResponse.json({ error: 'name and calories_100g required' }, { status: 400 });
      const { data: saved } = await supabase.from('ingredients').insert({ name, category: category || 'Other', brand: brand || '', status: 'Raw', calories_100g: parseFloat(calories_100g), protein_100g: parseFloat(protein_100g) || 0, carbs_100g: parseFloat(carbs_100g) || 0, fat_100g: parseFloat(fat_100g) || 0, serving_label: serving_label || null, serving_grams: serving_grams || null, user_id: user.id }).select().single();
      return NextResponse.json({ success: true, ingredient: saved });
    }

    // ── scan_barcode ─────────────────────────────────────────────────────
    if (action === 'scan_barcode') {
      const barcode = (p.barcode || '').toString().trim();
      if (!barcode) return NextResponse.json({ error: 'barcode required' }, { status: 400 });
      const product = await fetchOffProduct(barcode);
      if (!product) return NextResponse.json({ status: 'not_found', message: `Barcode ${barcode} not found on OpenFoodFacts.` });
      const record = ingredientFromOff(product, { barcode, userId: user.id, source: 'GPT' });
      const { data: localRows } = await supabase.from('ingredients').select('*').not('status', 'in', '("quick_add","single_ingredient","one_off")').or(`user_id.is.null,user_id.eq.${user.id}`);
      const existing = (localRows || []).find(r => normalizeName(r.name) === normalizeName(record.name));
      if (existing) return NextResponse.json({ status: 'exists', message: `Already in DB: ${existing.name}`, ingredient: existing });
      const { data: saved, error: saveErr } = await supabase.from('ingredients').insert(record).select().single();
      if (saveErr) throw new Error(saveErr.message);
      return NextResponse.json({ status: 'added', message: `Added: ${saved.name} (${saved.calories_100g} kcal/100g)`, ingredient: saved });
    }

    // ── get_goals ────────────────────────────────────────────────────────
    if (action === 'get_goals') {
      const { data: goals } = await supabase.from('goals').select('*').eq('user_id', user.id).maybeSingle();
      return NextResponse.json(goals || { calorie_goal: 1800, protein_goal: 150, carbs_goal: 200, fat_goal: 60, weight_target: 75 });
    }

    // ── update_goals ─────────────────────────────────────────────────────
    if (action === 'update_goals') {
      const { data: current } = await supabase.from('goals').select('*').eq('user_id', user.id).maybeSingle();
      const c = current || { calorie_goal: 1800, protein_goal: 150, carbs_goal: 200, fat_goal: 60, weight_target: 75 };
      const payload = { calorie_goal: p.calorie_goal ?? c.calorie_goal, protein_goal: p.protein_goal ?? c.protein_goal, carbs_goal: p.carbs_goal ?? c.carbs_goal, fat_goal: p.fat_goal ?? c.fat_goal, weight_target: p.weight_target ?? c.weight_target, user_id: user.id };
      if (current) { await supabase.from('goals').update(payload).eq('user_id', user.id); }
      else { await supabase.from('goals').insert(payload); }
      return NextResponse.json({ success: true });
    }

    // ── delete_log_entry ─────────────────────────────────────────────────
    if (action === 'delete_log_entry') {
      if (!p.id) return NextResponse.json({ error: 'id required' }, { status: 400 });
      await supabase.from('daily_logs').delete().eq('id', p.id).eq('user_id', user.id);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });

  } catch (e) {
    console.error('GPT action error', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
