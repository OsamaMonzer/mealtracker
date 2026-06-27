import { NextResponse } from 'next/server';
import { openDb } from '../../../lib/db';

export const dynamic = 'force-dynamic';

function today() {
  return new Date().toISOString().split('T')[0];
}

function parseServing(s) {
  if (!s) return { label: null, grams: null };
  const str = String(s).trim();
  const gMatch = str.match(/^(\d+(?:\.\d+)?)\s*(g|gr|gram|grams)$/i);
  if (gMatch) return { label: null, grams: parseFloat(gMatch[1]) };
  const mapping = { egg: 60, eggs: 60, slice: 30, slices: 30, tbsp: 15, tablespoon: 15, tsp: 5, teaspoon: 5, cup: 240, ml: 1 };
  const qtyMatch = str.match(/^(\d+(?:\.\d+)?)\s*(\w+)\b/i);
  if (qtyMatch) {
    const qty = parseFloat(qtyMatch[1]);
    const unit = qtyMatch[2].toLowerCase();
    if (mapping[unit]) return { label: str, grams: +(qty * mapping[unit]).toFixed(2) };
  }
  return { label: str, grams: null };
}

function toNum(v) { const n = Number(v); return Number.isFinite(n) ? n : null; }

function resolveKcal(nutr, sg) {
  const k = toNum(nutr['energy-kcal_100g']); if (k !== null) return Math.round(k);
  const ks = toNum(nutr['energy-kcal_serving']); if (ks !== null && sg) return Math.round((ks / sg) * 100);
  const kj = toNum(nutr['energy-kj_100g']) ?? toNum(nutr['energy_100g']); if (kj !== null) return Math.round(kj / 4.184);
  return null;
}

function p100(v100, vs, sg) {
  const v = toNum(v100); if (v !== null) return Math.round(v * 10) / 10;
  const s = toNum(vs); if (s !== null && sg) return Math.round((s / sg) * 1000) / 10;
  return null;
}

function normName(n) {
  return (n || '').toString().trim().toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ');
}

async function fetchOFF(barcode) {
  const fields = 'product_name,generic_name,brands,nutriments,serving_size,categories_tags,code,_id';
  const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=${fields}`,
    { headers: { 'User-Agent': 'MealTracker/1.0' } });
  if (!res.ok) return null;
  const d = await res.json();
  return (d.status === 1 && d.product) ? d.product : null;
}

async function computeMacros(db, recipeId, recipePortions, portionsEaten) {
  const ings = await db.all(`
    SELECT i.calories_100g, i.protein_100g, i.carbs_100g, i.fat_100g, ri.weight_g
    FROM recipe_ingredients ri JOIN ingredients i ON ri.ingredient_id = i.id
    WHERE ri.recipe_id = ?`, [recipeId]);
  let c = 0, p = 0, cb = 0, f = 0;
  ings.forEach(i => { const r = i.weight_g / 100; c += i.calories_100g * r; p += i.protein_100g * r; cb += i.carbs_100g * r; f += i.fat_100g * r; });
  const pp = portionsEaten / recipePortions;
  return { calories: Math.round(c * pp), protein: Math.round(p * pp * 10) / 10, carbs: Math.round(cb * pp * 10) / 10, fat: Math.round(f * pp * 10) / 10 };
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { action, ...p } = body;
    const db = await openDb();

    // ── get_today_summary ────────────────────────────────────────────────
    if (action === 'get_today_summary') {
      const date = p.date || today();
      const logs = await db.all(`
        SELECT d.id, d.meal_type, d.recipe_id, d.portions_eaten, r.name as recipe_name, r.portions as recipe_portions
        FROM daily_logs d JOIN recipes r ON d.recipe_id = r.id WHERE d.date = ? ORDER BY d.id ASC`, [date]);
      const meals = [];
      let tc = 0, tp = 0, tcb = 0, tf = 0;
      for (const log of logs) {
        const m = await computeMacros(db, log.recipe_id, log.recipe_portions, log.portions_eaten);
        tc += m.calories; tp += m.protein; tcb += m.carbs; tf += m.fat;
        meals.push({ id: log.id, meal_type: log.meal_type, name: log.recipe_name, ...m });
      }
      const goals = await db.get('SELECT * FROM goals WHERE id = 1') || { calorie_goal: 1800, protein_goal: 150, carbs_goal: 200, fat_goal: 60 };
      return NextResponse.json({
        date,
        meals,
        totals: { calories: tc, protein: tp, carbs: tcb, fat: tf },
        goals: { calories: goals.calorie_goal, protein: goals.protein_goal, carbs: goals.carbs_goal, fat: goals.fat_goal },
        remaining: { calories: Math.max(0, goals.calorie_goal - tc), protein: Math.max(0, goals.protein_goal - tp), carbs: Math.max(0, goals.carbs_goal - tcb), fat: Math.max(0, goals.fat_goal - tf) },
      });
    }

    // ── get_history ──────────────────────────────────────────────────────
    if (action === 'get_history') {
      const date = p.date || today();
      const logs = await db.all(`
        SELECT d.id, d.meal_type, d.recipe_id, d.portions_eaten, r.name as recipe_name, r.portions as recipe_portions
        FROM daily_logs d JOIN recipes r ON d.recipe_id = r.id WHERE d.date = ? ORDER BY d.id ASC`, [date]);
      const meals = [];
      let tc = 0, tp = 0, tcb = 0, tf = 0;
      for (const log of logs) {
        const m = await computeMacros(db, log.recipe_id, log.recipe_portions, log.portions_eaten);
        tc += m.calories; tp += m.protein; tcb += m.carbs; tf += m.fat;
        meals.push({ id: log.id, meal_type: log.meal_type, name: log.recipe_name, ...m });
      }
      return NextResponse.json({ date, meals, totals: { calories: tc, protein: tp, carbs: tcb, fat: tf } });
    }

    // ── get_weekly_stats ─────────────────────────────────────────────────
    if (action === 'get_weekly_stats') {
      const days = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const date = d.toISOString().split('T')[0];
        const logs = await db.all(`
          SELECT d.recipe_id, d.portions_eaten, r.portions as rp
          FROM daily_logs d JOIN recipes r ON d.recipe_id = r.id WHERE d.date = ?`, [date]);
        let c = 0, pr = 0, cb = 0, f = 0;
        for (const l of logs) { const m = await computeMacros(db, l.recipe_id, l.rp, l.portions_eaten); c += m.calories; pr += m.protein; cb += m.carbs; f += m.fat; }
        days.push({ date, calories: c, protein: pr, carbs: cb, fat: f, meals: logs.length });
      }
      const avg = k => Math.round(days.reduce((s, d) => s + d[k], 0) / days.length);
      return NextResponse.json({ days, averages: { calories: avg('calories'), protein: avg('protein'), carbs: avg('carbs'), fat: avg('fat') } });
    }

    // ── list_ingredients ─────────────────────────────────────────────────
    if (action === 'list_ingredients') {
      const rows = await db.all("SELECT id, name, brand, category, calories_100g, protein_100g, carbs_100g, fat_100g, serving_label, serving_grams FROM ingredients WHERE status NOT IN ('quick_add','single_ingredient','one_off') ORDER BY name ASC");
      return NextResponse.json({ ingredients: rows });
    }

    // ── list_recipes ─────────────────────────────────────────────────────
    if (action === 'list_recipes') {
      const recipes = await db.all("SELECT * FROM recipes WHERE status = 'active' ORDER BY name ASC");
      const full = [];
      for (const r of recipes) {
        const ings = await db.all(`SELECT i.id, i.name, i.calories_100g, i.protein_100g, i.carbs_100g, i.fat_100g, ri.weight_g FROM recipe_ingredients ri JOIN ingredients i ON ri.ingredient_id = i.id WHERE ri.recipe_id = ?`, [r.id]);
        let tc = 0, tp = 0, tcb = 0, tf = 0;
        ings.forEach(i => { const ratio = i.weight_g / 100; tc += i.calories_100g * ratio; tp += i.protein_100g * ratio; tcb += i.carbs_100g * ratio; tf += i.fat_100g * ratio; });
        full.push({ id: r.id, name: r.name, portions: r.portions, ingredients: ings, total: { calories: Math.round(tc), protein: Math.round(tp * 10) / 10, carbs: Math.round(tcb * 10) / 10, fat: Math.round(tf * 10) / 10 }, per_portion: { calories: Math.round(tc / r.portions), protein: Math.round(tp / r.portions * 10) / 10, carbs: Math.round(tcb / r.portions * 10) / 10, fat: Math.round(tf / r.portions * 10) / 10 } });
      }
      return NextResponse.json({ recipes: full });
    }

    // ── search_ingredient ────────────────────────────────────────────────
    if (action === 'search_ingredient') {
      const q = (p.query || '').trim();
      if (!q) return NextResponse.json({ error: 'query required' }, { status: 400 });
      const local = await db.all(`SELECT id, name, brand, category, calories_100g, protein_100g, carbs_100g, fat_100g FROM ingredients WHERE status NOT IN ('quick_add','single_ingredient','one_off') AND (LOWER(name) LIKE ? OR LOWER(brand) LIKE ?)`, [`%${q.toLowerCase()}%`, `%${q.toLowerCase()}%`]);
      return NextResponse.json({ local_results: local });
    }

    // ── log_food (smart: search → add if missing → log) ──────────────────
    if (action === 'log_food') {
      const { name, weight_g, meal_type, date,
              calories_100g, protein_100g, carbs_100g, fat_100g } = p;
      if (!name || !weight_g) return NextResponse.json({ error: 'name and weight_g required' }, { status: 400 });

      // 1. Search DB
      const q = name.trim().toLowerCase();
      const matches = await db.all(
        `SELECT id, name, calories_100g, protein_100g, carbs_100g, fat_100g
         FROM ingredients
         WHERE status NOT IN ('quick_add','single_ingredient','one_off')
           AND LOWER(name) LIKE ?`,
        [`%${q}%`]
      );

      let ingredient;
      if (matches.length > 0) {
        // Use closest match (exact first, otherwise first result)
        ingredient = matches.find(m => normName(m.name) === normName(name)) || matches[0];
      } else {
        // 2. Not found — add it using provided nutrition (AI should supply these)
        if (calories_100g === undefined) {
          return NextResponse.json({
            error: 'ingredient_not_found',
            message: `"${name}" not found in database. Please provide calories_100g (and optionally protein_100g, carbs_100g, fat_100g) to add it automatically.`,
          }, { status: 404 });
        }
        const res = await db.run(
          `INSERT INTO ingredients (name, category, brand, status, calories_100g, protein_100g, carbs_100g, fat_100g, price_kg, notes)
           VALUES (?, 'Other', '', 'Raw', ?, ?, ?, ?, null, 'Added via AI')`,
          [name.trim(), parseFloat(calories_100g), parseFloat(protein_100g) || 0, parseFloat(carbs_100g) || 0, parseFloat(fat_100g) || 0]
        );
        ingredient = await db.get('SELECT * FROM ingredients WHERE id = ?', [res.lastID]);
      }

      // 3. Log it via log_ingredient logic (find/create single_ingredient recipe)
      const existing = await db.get(
        `SELECT r.id FROM recipes r JOIN recipe_ingredients ri ON r.id = ri.recipe_id
         WHERE r.status = 'single_ingredient' AND ri.ingredient_id = ? LIMIT 1`,
        [ingredient.id]
      );
      let recipe_id;
      if (existing) {
        recipe_id = existing.id;
      } else {
        const rr = await db.run("INSERT INTO recipes (name, portions, status) VALUES (?, 1, 'single_ingredient')", [ingredient.name]);
        recipe_id = rr.lastID;
        await db.run('INSERT INTO recipe_ingredients (recipe_id, ingredient_id, weight_g) VALUES (?, ?, 100)', [recipe_id, ingredient.id]);
      }

      const portions_eaten = parseFloat(weight_g) / 100.0;
      const logRes = await db.run(
        'INSERT INTO daily_logs (date, meal_type, recipe_id, portions_eaten) VALUES (?, ?, ?, ?)',
        [date || today(), meal_type || 'Snack', recipe_id, portions_eaten]
      );
      const macros = await computeMacros(db, recipe_id, 1, portions_eaten);

      return NextResponse.json({
        success: true,
        log_id: logRes.lastID,
        ingredient_name: ingredient.name,
        ingredient_id: ingredient.id,
        weight_g: parseFloat(weight_g),
        was_in_db: matches.length > 0,
        ...macros,
      });
    }

    // ── log_meal ─────────────────────────────────────────────────────────
    if (action === 'log_meal') {
      const { recipe_id, portions_eaten, meal_type, date } = p;
      if (!recipe_id || !portions_eaten) return NextResponse.json({ error: 'recipe_id and portions_eaten required' }, { status: 400 });
      const res = await db.run('INSERT INTO daily_logs (date, meal_type, recipe_id, portions_eaten) VALUES (?, ?, ?, ?)',
        [date || today(), meal_type || 'Snack', recipe_id, parseFloat(portions_eaten)]);
      const recipe = await db.get('SELECT * FROM recipes WHERE id = ?', [recipe_id]);
      const macros = await computeMacros(db, recipe_id, recipe.portions, parseFloat(portions_eaten));
      return NextResponse.json({ success: true, log_id: res.lastID, recipe_name: recipe.name, ...macros });
    }

    // ── log_ingredient ───────────────────────────────────────────────────
    if (action === 'log_ingredient') {
      const { ingredient_id, weight_g, meal_type, date } = p;
      if (!ingredient_id || !weight_g) return NextResponse.json({ error: 'ingredient_id and weight_g required' }, { status: 400 });
      const ing = await db.get('SELECT * FROM ingredients WHERE id = ?', [ingredient_id]);
      if (!ing) return NextResponse.json({ error: 'ingredient not found' }, { status: 404 });
      const existing = await db.get(`SELECT r.id FROM recipes r JOIN recipe_ingredients ri ON r.id = ri.recipe_id WHERE r.status = 'single_ingredient' AND ri.ingredient_id = ? LIMIT 1`, [ingredient_id]);
      let recipe_id;
      if (existing) { recipe_id = existing.id; }
      else {
        const rr = await db.run("INSERT INTO recipes (name, portions, status) VALUES (?, 1, 'single_ingredient')", [ing.name]);
        recipe_id = rr.lastID;
        await db.run('INSERT INTO recipe_ingredients (recipe_id, ingredient_id, weight_g) VALUES (?, ?, 100)', [recipe_id, ingredient_id]);
      }
      const portions_eaten = parseFloat(weight_g) / 100.0;
      const res = await db.run('INSERT INTO daily_logs (date, meal_type, recipe_id, portions_eaten) VALUES (?, ?, ?, ?)',
        [date || today(), meal_type || 'Snack', recipe_id, portions_eaten]);
      const macros = await computeMacros(db, recipe_id, 1, portions_eaten);
      return NextResponse.json({ success: true, log_id: res.lastID, ingredient_name: ing.name, weight_g: parseFloat(weight_g), ...macros });
    }

    // ── quick_add_calories ───────────────────────────────────────────────
    if (action === 'quick_add_calories') {
      const { name, calories, meal_type, date } = p;
      if (!name || calories === undefined) return NextResponse.json({ error: 'name and calories required' }, { status: 400 });
      const uniqueKey = `${name}__qa_${Date.now()}`;
      const ingR = await db.run(`INSERT INTO ingredients (name, category, brand, status, calories_100g, protein_100g, carbs_100g, fat_100g, price_kg, notes) VALUES (?, 'Other', '', 'quick_add', ?, 0, 0, 0, null, '')`, [uniqueKey, parseFloat(calories)]);
      const recR = await db.run("INSERT INTO recipes (name, portions, status) VALUES (?, 1, 'quick_add')", [name]);
      await db.run('INSERT INTO recipe_ingredients (recipe_id, ingredient_id, weight_g) VALUES (?, ?, 100)', [recR.lastID, ingR.lastID]);
      const logR = await db.run('INSERT INTO daily_logs (date, meal_type, recipe_id, portions_eaten) VALUES (?, ?, ?, 1)',
        [date || today(), meal_type || 'Snack', recR.lastID]);
      return NextResponse.json({ success: true, log_id: logR.lastID, name, calories: parseFloat(calories) });
    }

    // ── create_recipe ────────────────────────────────────────────────────
    if (action === 'create_recipe') {
      const { name, portions, ingredients } = p;
      if (!name || !ingredients || !ingredients.length) return NextResponse.json({ error: 'name and ingredients required' }, { status: 400 });
      await db.exec('BEGIN TRANSACTION');
      try {
        const rr = await db.run('INSERT INTO recipes (name, portions) VALUES (?, ?)', [name, portions || 1]);
        for (const item of ingredients) {
          await db.run('INSERT INTO recipe_ingredients (recipe_id, ingredient_id, weight_g) VALUES (?, ?, ?)', [rr.lastID, item.ingredient_id, item.weight_g]);
        }
        await db.exec('COMMIT');
        const macros = await computeMacros(db, rr.lastID, portions || 1, portions || 1);
        return NextResponse.json({ success: true, recipe_id: rr.lastID, name, portions: portions || 1, total_macros: macros, per_portion: { calories: Math.round(macros.calories / (portions || 1)), protein: Math.round(macros.protein / (portions || 1) * 10) / 10, carbs: Math.round(macros.carbs / (portions || 1) * 10) / 10, fat: Math.round(macros.fat / (portions || 1) * 10) / 10 } });
      } catch (e) { await db.exec('ROLLBACK'); throw e; }
    }

    // ── add_ingredient ───────────────────────────────────────────────────
    if (action === 'add_ingredient') {
      const { name, calories_100g, protein_100g, carbs_100g, fat_100g, category, brand, serving_label, serving_grams } = p;
      if (!name || calories_100g === undefined) return NextResponse.json({ error: 'name and calories_100g required' }, { status: 400 });
      const res = await db.run(`INSERT INTO ingredients (name, category, brand, status, calories_100g, protein_100g, carbs_100g, fat_100g, price_kg, notes, serving_label, serving_grams) VALUES (?, ?, ?, 'Raw', ?, ?, ?, ?, null, '', ?, ?)`,
        [name, category || 'Other', brand || '', parseFloat(calories_100g), parseFloat(protein_100g) || 0, parseFloat(carbs_100g) || 0, parseFloat(fat_100g) || 0, serving_label || null, serving_grams || null]);
      const saved = await db.get('SELECT * FROM ingredients WHERE id = ?', [res.lastID]);
      return NextResponse.json({ success: true, ingredient: saved });
    }

    // ── scan_barcode ─────────────────────────────────────────────────────
    if (action === 'scan_barcode') {
      const barcode = (p.barcode || '').toString().trim();
      if (!barcode) return NextResponse.json({ error: 'barcode required' }, { status: 400 });
      const product = await fetchOFF(barcode);
      if (!product) return NextResponse.json({ status: 'not_found', message: `Barcode ${barcode} not found on OpenFoodFacts.` });
      const nutr = product.nutriments || {};
      const serv = parseServing(product.serving_size || '');
      const name = product.product_name || product.generic_name || product.brands || 'Unknown';
      const localRows = await db.all("SELECT * FROM ingredients WHERE status NOT IN ('quick_add','single_ingredient','one_off')");
      const existing = localRows.find(r => normName(r.name) === normName(name));
      if (existing) return NextResponse.json({ status: 'exists', message: `Already in DB: ${name}`, ingredient: existing });
      const cals = resolveKcal(nutr, serv.grams) ?? 0;
      const res = await db.run(`INSERT INTO ingredients (name, category, brand, status, calories_100g, protein_100g, carbs_100g, fat_100g, price_kg, notes, serving_label, serving_grams) VALUES (?, ?, ?, 'Raw', ?, ?, ?, ?, null, ?, ?, ?)`,
        [name, product.categories_tags?.[0]?.replace(/^en:/, '').replace(/-/g, ' ') || 'Other', product.brands || '', cals,
          p100(nutr['proteins_100g'] ?? nutr['protein_100g'], nutr['proteins_serving'], serv.grams) ?? 0,
          p100(nutr['carbohydrates_100g'], nutr['carbohydrates_serving'], serv.grams) ?? 0,
          p100(nutr['fat_100g'], nutr['fat_serving'], serv.grams) ?? 0,
          `Scanned via GPT — barcode ${barcode}`, serv.label || product.serving_size || null, serv.grams || null]);
      const saved = await db.get('SELECT * FROM ingredients WHERE id = ?', [res.lastID]);
      return NextResponse.json({ status: 'added', message: `Added: ${name} (${cals} kcal/100g)`, ingredient: saved });
    }

    // ── get_goals ────────────────────────────────────────────────────────
    if (action === 'get_goals') {
      const goals = await db.get('SELECT * FROM goals WHERE id = 1') || { calorie_goal: 1800, protein_goal: 150, carbs_goal: 200, fat_goal: 60, weight_target: 75 };
      return NextResponse.json(goals);
    }

    // ── update_goals ─────────────────────────────────────────────────────
    if (action === 'update_goals') {
      const current = await db.get('SELECT * FROM goals WHERE id = 1') || { calorie_goal: 1800, protein_goal: 150, carbs_goal: 200, fat_goal: 60, weight_target: 75 };
      await db.run('UPDATE goals SET calorie_goal=?, protein_goal=?, carbs_goal=?, fat_goal=?, weight_target=? WHERE id=1',
        [p.calorie_goal ?? current.calorie_goal, p.protein_goal ?? current.protein_goal, p.carbs_goal ?? current.carbs_goal, p.fat_goal ?? current.fat_goal, p.weight_target ?? current.weight_target]);
      return NextResponse.json({ success: true });
    }

    // ── delete_log_entry ─────────────────────────────────────────────────
    if (action === 'delete_log_entry') {
      if (!p.id) return NextResponse.json({ error: 'id required' }, { status: 400 });
      await db.run('DELETE FROM daily_logs WHERE id = ?', [p.id]);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });

  } catch (e) {
    console.error('GPT action error', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
