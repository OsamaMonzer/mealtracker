// Implementations of the AI tools in ./tools.js. Shared by /api/mcp,
// /api/actions/[action] (custom GPT) and the legacy /api/gpt endpoint.
//
// Every function receives (ctx, params) where ctx = { supabase, user }.
// Every query is filtered by ctx.user.id.

import { normalizeName, fetchOffProduct, ingredientFromOff, logMacros, recipeTotals, safeFilterText } from '../nutrition';
import { todayInTz, addDays, isDateStr } from '../dates';
import { ALIASES } from './tools';

export class ActionError extends Error {
  constructor(message, status = 400, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

const DEFAULT_GOALS = { calorie_goal: 1800, protein_goal: 150, carbs_goal: 200, fat_goal: 60, weight_target: 75 };
const MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
const HIDDEN_STATUSES = '("quick_add","single_ingredient","one_off")';
const LOG_SELECT =
  'id, date, meal_type, recipe_id, portions_eaten, recipes(name, portions, status, recipe_ingredients(weight_g, ingredients(calories_100g, protein_100g, carbs_100g, fat_100g)))';

// ── small helpers ────────────────────────────────────────────────────────────

function must({ data, error }) {
  if (error) throw new ActionError(error.message, 500);
  return data;
}

const r1 = (n) => Math.round((n || 0) * 10) / 10;

function num(v, field, { required = false, min = 0 } = {}) {
  if (v === undefined || v === null || v === '') {
    if (required) throw new ActionError(`${field} is required`);
    return undefined;
  }
  const n = Number(v);
  if (!Number.isFinite(n) || n < min) throw new ActionError(`${field} must be a number ≥ ${min}`);
  return n;
}

function int(v, field) {
  const n = num(v, field, { required: true, min: 1 });
  return Math.trunc(n);
}

function str(v, field, { required = false } = {}) {
  const s = v === undefined || v === null ? '' : String(v).trim();
  if (!s && required) throw new ActionError(`${field} is required`);
  return s || undefined;
}

export function resolveDate(input, today = todayInTz()) {
  if (input === undefined || input === null || input === '') return today;
  const s = String(input).trim().toLowerCase();
  if (s === 'today') return today;
  if (s === 'yesterday') return addDays(today, -1);
  if (s === 'tomorrow') return addDays(today, 1);
  if (isDateStr(s)) return s;
  throw new ActionError(`Invalid date "${input}". Use YYYY-MM-DD, 'today' or 'yesterday'.`);
}

function mealType(v) {
  if (!v) return 'Snack';
  const m = MEAL_TYPES.find((t) => t.toLowerCase() === String(v).toLowerCase());
  if (!m) throw new ActionError(`meal_type must be one of ${MEAL_TYPES.join(', ')}`);
  return m;
}

async function getGoals({ supabase, user }) {
  const g = must(await supabase.from('goals').select('*').eq('user_id', user.id).maybeSingle());
  return { ...DEFAULT_GOALS, ...(g || {}) };
}

function describeLog(log) {
  const rec = log.recipes || {};
  const m = logMacros(log);
  const entry = { id: log.id, meal_type: log.meal_type, name: rec.name || 'Unknown', ...m };
  if (rec.status === 'single_ingredient') entry.weight_g = Math.round((log.portions_eaten || 0) * 100);
  else if (rec.status !== 'quick_add') entry.portions_eaten = log.portions_eaten;
  if (rec.status === 'active' || rec.status === 'archived') entry.recipe_id = log.recipe_id;
  return entry;
}

function sumEntries(entries) {
  const t = entries.reduce(
    (a, e) => ({ calories: a.calories + e.calories, protein: a.protein + e.protein, carbs: a.carbs + e.carbs, fat: a.fat + e.fat }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );
  return { calories: Math.round(t.calories), protein: r1(t.protein), carbs: r1(t.carbs), fat: r1(t.fat) };
}

function remaining(goals, totals) {
  return {
    calories: Math.round(goals.calorie_goal - totals.calories),
    protein: r1(goals.protein_goal - totals.protein),
    carbs: r1(goals.carbs_goal - totals.carbs),
    fat: r1(goals.fat_goal - totals.fat),
  };
}

const goalView = (g) => ({ calories: g.calorie_goal, protein: g.protein_goal, carbs: g.carbs_goal, fat: g.fat_goal, weight_target_kg: g.weight_target });

async function daySummary(ctx, date) {
  const logs = must(
    await ctx.supabase.from('daily_logs').select(LOG_SELECT).eq('user_id', ctx.user.id).eq('date', date).order('id', { ascending: true })
  );
  const entries = (logs || []).map(describeLog);
  const totals = sumEntries(entries);
  const goals = await getGoals(ctx);
  const byMeal = {};
  for (const e of entries) (byMeal[e.meal_type] ||= []).push(e);
  return { date, entries, by_meal: byMeal, totals, goals: goalView(goals), remaining: remaining(goals, totals) };
}

// ── ingredient matching ──────────────────────────────────────────────────────

const NOISE_WORDS = new Set([
  'raw', 'cooked', 'boiled', 'grilled', 'fried', 'baked', 'steamed', 'roasted', 'fresh', 'frozen', 'dried', 'canned',
  'smoked', 'salted', 'unsalted', 'plain', 'whole', 'boneless', 'skinless', 'lean', 'extra', 'organic', 'natural',
  'low', 'fat', 'reduced', 'light', 'dark', 'white', 'brown', 'ground', 'minced', 'sliced', 'diced', 'chopped',
  'shredded', 'half', 'large', 'small', 'medium', 'of', 'the', 'and', 'with',
]);

// Light singularisation so 'eggs' matches 'Egg' and 'oats' matches 'Oat'.
const stem = (t) => (t.length > 3 && t.endsWith('s') && !t.endsWith('ss') ? t.slice(0, -1) : t);

function tokenize(s) {
  return normalizeName(s).split(/\s+/).filter((t) => t.length > 1 && !NOISE_WORDS.has(t)).map(stem);
}

function scoreMatch(queryTokens, query, candidateName) {
  const candTokens = tokenize(candidateName);
  const candFull = normalizeName(candidateName);
  if (candFull === normalizeName(query)) return 100;
  let score = 0;
  for (const qt of queryTokens) {
    if (candTokens.includes(qt)) score += 10;
    else if (candTokens.some((ct) => ct.startsWith(qt) || qt.startsWith(ct))) score += 6;
    else if (candFull.includes(qt)) score += 3;
  }
  const coverage = queryTokens.filter((qt) => candFull.includes(qt)).length / Math.max(queryTokens.length, 1);
  // Penalise candidates with many extra words ("chicken" should prefer "Chicken breast" over "Chicken curry with rice and peas")
  const extra = Math.max(0, candTokens.length - queryTokens.length);
  return score + coverage * 5 - extra * 0.5;
}

async function searchIngredients(ctx, query) {
  const tokens = tokenize(query).map(safeFilterText).filter(Boolean);
  const words = tokens.length ? tokens : [safeFilterText(query)].filter(Boolean);
  if (!words.length) return [];
  const rows = must(
    await ctx.supabase
      .from('ingredients')
      .select('id, name, brand, category, calories_100g, protein_100g, carbs_100g, fat_100g, serving_label, serving_grams')
      .not('status', 'in', HIDDEN_STATUSES)
      .or(`user_id.is.null,user_id.eq.${ctx.user.id}`)
      .or(words.map((t) => `name.ilike.%${t}%`).join(','))
      .limit(200)
  );
  return (rows || [])
    .map((c) => ({ ...c, score: Math.round(scoreMatch(tokens, query, c.name) * 10) / 10 }))
    .sort((a, b) => b.score - a.score);
}

async function getOrCreateSingleIngredientRecipe(ctx, ingredient) {
  const existing = must(
    await ctx.supabase
      .from('recipes')
      .select('id, recipe_ingredients!inner(ingredient_id)')
      .eq('status', 'single_ingredient')
      .eq('user_id', ctx.user.id)
      .eq('recipe_ingredients.ingredient_id', ingredient.id)
      .limit(1)
  );
  if (existing && existing.length) return existing[0].id;
  const rec = must(
    await ctx.supabase.from('recipes').insert({ name: ingredient.name, portions: 1, status: 'single_ingredient', user_id: ctx.user.id }).select('id').single()
  );
  must(await ctx.supabase.from('recipe_ingredients').insert({ recipe_id: rec.id, ingredient_id: ingredient.id, weight_g: 100 }));
  return rec.id;
}

async function insertLog(ctx, { date, meal_type, recipe_id, portions_eaten }) {
  const row = must(
    await ctx.supabase
      .from('daily_logs')
      .insert({ date, meal_type, recipe_id, portions_eaten, user_id: ctx.user.id })
      .select(LOG_SELECT)
      .single()
  );
  return describeLog(row);
}

async function ownIngredientById(ctx, id) {
  return must(
    await ctx.supabase
      .from('ingredients')
      .select('id, name, calories_100g, protein_100g, carbs_100g, fat_100g')
      .eq('id', id)
      .or(`user_id.is.null,user_id.eq.${ctx.user.id}`)
      .maybeSingle()
  );
}

async function createIngredient(ctx, p, notes) {
  const calories = num(p.calories_100g, 'calories_100g', { required: true });
  return must(
    await ctx.supabase
      .from('ingredients')
      .insert({
        name: str(p.name, 'name', { required: true }),
        category: p.category || 'Other',
        brand: p.brand || '',
        status: 'Raw',
        calories_100g: calories,
        protein_100g: num(p.protein_100g, 'protein_100g') ?? 0,
        carbs_100g: num(p.carbs_100g, 'carbs_100g') ?? 0,
        fat_100g: num(p.fat_100g, 'fat_100g') ?? 0,
        serving_label: p.serving_label || null,
        serving_grams: num(p.serving_grams, 'serving_grams') ?? null,
        notes,
        user_id: ctx.user.id,
      })
      .select('id, name, calories_100g, protein_100g, carbs_100g, fat_100g')
      .single()
  );
}

// Finds (or creates, when macros are supplied) an ingredient and logs it.
async function logOneFood(ctx, item, { date, meal_type }) {
  const name = str(item.name, 'name', { required: true });
  const weight = num(item.weight_g, 'weight_g', { required: true, min: 0.1 });

  const matches = await searchIngredients(ctx, name);
  let ingredient = matches[0] && matches[0].score >= 10 ? matches[0] : null;
  let created = false;

  if (!ingredient) {
    if (item.calories_100g === undefined || item.calories_100g === null) {
      return {
        status: 'ingredient_not_found',
        name,
        message: `"${name}" is not in the ingredient list. Either log a candidate with log_ingredient, or call again with calories_100g, protein_100g, carbs_100g and fat_100g.`,
        candidates: matches.slice(0, 5).map((m) => ({ id: m.id, name: m.name, calories_100g: m.calories_100g })),
      };
    }
    ingredient = await createIngredient(ctx, { ...item, name }, 'Added via AI');
    created = true;
  }

  const recipe_id = await getOrCreateSingleIngredientRecipe(ctx, ingredient);
  const entry = await insertLog(ctx, { date, meal_type, recipe_id, portions_eaten: weight / 100 });
  return { status: 'logged', matched_ingredient: { id: ingredient.id, name: ingredient.name }, created_ingredient: created, entry };
}

async function findRecipe(ctx, { recipe_id, name }) {
  let q = ctx.supabase
    .from('recipes')
    .select('id, name, portions, status, recipe_ingredients(weight_g, ingredients(id, name, calories_100g, protein_100g, carbs_100g, fat_100g))')
    .eq('user_id', ctx.user.id);
  if (recipe_id) q = q.eq('id', int(recipe_id, 'recipe_id'));
  else if (name) q = q.eq('status', 'active').ilike('name', `%${safeFilterText(name)}%`);
  else throw new ActionError('recipe_id or name is required');
  const rows = must(await q.limit(5));
  if (!rows || !rows.length) throw new ActionError('Recipe not found', 404);
  return rows[0];
}

function recipeView(r) {
  const t = recipeTotals(r.recipe_ingredients);
  const p = r.portions || 1;
  return {
    id: r.id,
    name: r.name,
    portions: p,
    per_portion: { calories: Math.round(t.calories / p), protein: r1(t.protein / p), carbs: r1(t.carbs / p), fat: r1(t.fat / p) },
    total: { calories: Math.round(t.calories), protein: r1(t.protein), carbs: r1(t.carbs), fat: r1(t.fat) },
  };
}

// ── actions ──────────────────────────────────────────────────────────────────

const actions = {
  async get_overview(ctx) {
    const today = todayInTz();
    const tz = process.env.APP_TIMEZONE || 'Asia/Kuala_Lumpur';
    const time = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit' }).format(new Date());
    const day = await daySummary(ctx, today);

    const since = addDays(today, -30);
    const recent = must(
      await ctx.supabase
        .from('daily_logs')
        .select('date, recipe_id, portions_eaten, meal_type, recipes(name, status)')
        .eq('user_id', ctx.user.id)
        .gte('date', since)
        .lte('date', today)
    );

    const dates = new Set((recent || []).map((l) => l.date));
    let streak = 0;
    for (let d = dates.has(today) ? today : addDays(today, -1); dates.has(d); d = addDays(d, -1)) streak++;

    const freq = {};
    for (const l of recent || []) {
      const st = l.recipes?.status;
      if (st === 'quick_add' || !l.recipes) continue;
      const key = l.recipe_id;
      const f = (freq[key] ||= { name: l.recipes.name, times: 0, grams: [], portions: [], meals: {} });
      f.times++;
      f.meals[l.meal_type] = (f.meals[l.meal_type] || 0) + 1;
      if (st === 'single_ingredient') f.grams.push(Math.round(l.portions_eaten * 100));
      else f.portions.push(l.portions_eaten);
      f.kind = st === 'single_ingredient' ? 'food' : 'recipe';
      f.recipe_id = key;
    }
    const median = (a) => (a.length ? [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] : undefined);
    const frequent = Object.values(freq)
      .sort((a, b) => b.times - a.times)
      .slice(0, 10)
      .map((f) => ({
        name: f.name,
        kind: f.kind,
        times_last_30_days: f.times,
        usual_meal: Object.entries(f.meals).sort((a, b) => b[1] - a[1])[0][0],
        ...(f.kind === 'recipe' ? { recipe_id: f.recipe_id, usual_portions: median(f.portions) } : { usual_grams: median(f.grams) }),
      }));

    const weights = must(
      await ctx.supabase.from('weight_logs').select('date, weight_kg').eq('user_id', ctx.user.id).order('date', { ascending: false }).limit(1)
    );

    return {
      today,
      local_time: time,
      timezone: tz,
      today_summary: day,
      latest_weight: weights?.[0] || null,
      logging_streak_days: streak,
      frequent_foods: frequent,
    };
  },

  async get_day_summary(ctx, p) {
    return daySummary(ctx, resolveDate(p.date));
  },

  async get_range_summary(ctx, p) {
    const end = resolveDate(p.end_date);
    const start = p.start_date ? resolveDate(p.start_date) : addDays(end, -6);
    if (start > end) throw new ActionError('start_date must be before end_date');
    const span = Math.round((Date.parse(end) - Date.parse(start)) / 86400000) + 1;
    if (span > 93) throw new ActionError('Range is limited to 93 days');

    const logs = must(
      await ctx.supabase.from('daily_logs').select(LOG_SELECT).eq('user_id', ctx.user.id).gte('date', start).lte('date', end)
    );
    const goals = await getGoals(ctx);
    const days = [];
    for (let i = 0; i < span; i++) {
      const date = addDays(start, i);
      const entries = (logs || []).filter((l) => l.date === date).map(describeLog);
      days.push({ date, entries: entries.length, ...sumEntries(entries) });
    }
    const logged = days.filter((d) => d.entries > 0);
    const avg = (k) => (logged.length ? r1(logged.reduce((s, d) => s + d[k], 0) / logged.length) : 0);
    const tolerance = goals.calorie_goal * 0.1;
    return {
      start_date: start,
      end_date: end,
      days,
      days_logged: logged.length,
      averages_on_logged_days: { calories: Math.round(avg('calories')), protein: avg('protein'), carbs: avg('carbs'), fat: avg('fat') },
      goals: goalView(goals),
      calorie_goal_adherence: {
        within_10_percent: logged.filter((d) => Math.abs(d.calories - goals.calorie_goal) <= tolerance).length,
        over: logged.filter((d) => d.calories > goals.calorie_goal + tolerance).length,
        under: logged.filter((d) => d.calories < goals.calorie_goal - tolerance).length,
      },
      protein_goal_hit_days: logged.filter((d) => d.protein >= goals.protein_goal * 0.95).length,
    };
  },

  async log_food(ctx, p) {
    const res = await logOneFood(ctx, p, { date: resolveDate(p.date), meal_type: mealType(p.meal_type) });
    if (res.status === 'ingredient_not_found') throw new ActionError(res.message, 404, { error: 'ingredient_not_found', ...res });
    const day = await daySummary(ctx, resolveDate(p.date));
    return { ...res, day_totals: day.totals, remaining: day.remaining };
  },

  async log_foods(ctx, p) {
    if (!Array.isArray(p.items) || !p.items.length) throw new ActionError('items must be a non-empty array');
    if (p.items.length > 20) throw new ActionError('At most 20 items per call');
    const date = resolveDate(p.date);
    const meal_type = mealType(p.meal_type);
    const results = [];
    for (const item of p.items) {
      try {
        results.push(await logOneFood(ctx, item, { date, meal_type }));
      } catch (e) {
        results.push({ status: 'error', name: item?.name, message: e.message });
      }
    }
    const day = await daySummary(ctx, date);
    return {
      logged: results.filter((r) => r.status === 'logged').length,
      not_found: results.filter((r) => r.status === 'ingredient_not_found').length,
      results,
      day_totals: day.totals,
      remaining: day.remaining,
    };
  },

  async log_meal(ctx, p) {
    const recipe_id = int(p.recipe_id, 'recipe_id');
    const recipe = must(await ctx.supabase.from('recipes').select('id').eq('id', recipe_id).eq('user_id', ctx.user.id).maybeSingle());
    if (!recipe) throw new ActionError('Recipe not found', 404);
    const date = resolveDate(p.date);
    const entry = await insertLog(ctx, { date, meal_type: mealType(p.meal_type), recipe_id, portions_eaten: num(p.portions_eaten, 'portions_eaten', { min: 0.01 }) ?? 1 });
    const day = await daySummary(ctx, date);
    return { status: 'logged', entry, day_totals: day.totals, remaining: day.remaining };
  },

  async log_ingredient(ctx, p) {
    const ing = await ownIngredientById(ctx, int(p.ingredient_id, 'ingredient_id'));
    if (!ing) throw new ActionError('Ingredient not found', 404);
    const date = resolveDate(p.date);
    const recipe_id = await getOrCreateSingleIngredientRecipe(ctx, ing);
    const weight = num(p.weight_g, 'weight_g', { required: true, min: 0.1 });
    const entry = await insertLog(ctx, { date, meal_type: mealType(p.meal_type), recipe_id, portions_eaten: weight / 100 });
    const day = await daySummary(ctx, date);
    return { status: 'logged', entry, day_totals: day.totals, remaining: day.remaining };
  },

  async quick_add_calories(ctx, p) {
    const name = str(p.name, 'name', { required: true });
    const calories = num(p.calories, 'calories', { required: true });
    const date = resolveDate(p.date);
    // Stored as a hidden 100 g ingredient so it fits the recipe-based data model.
    const ing = must(
      await ctx.supabase
        .from('ingredients')
        .insert({
          name: `${name}__qa_${Date.now()}`, category: 'Other', brand: '', status: 'quick_add',
          calories_100g: calories, protein_100g: num(p.protein, 'protein') ?? 0, carbs_100g: num(p.carbs, 'carbs') ?? 0, fat_100g: num(p.fat, 'fat') ?? 0,
          user_id: ctx.user.id,
        })
        .select('id').single()
    );
    const rec = must(await ctx.supabase.from('recipes').insert({ name, portions: 1, status: 'quick_add', user_id: ctx.user.id }).select('id').single());
    must(await ctx.supabase.from('recipe_ingredients').insert({ recipe_id: rec.id, ingredient_id: ing.id, weight_g: 100 }));
    const entry = await insertLog(ctx, { date, meal_type: mealType(p.meal_type), recipe_id: rec.id, portions_eaten: 1 });
    const day = await daySummary(ctx, date);
    return { status: 'logged', entry, day_totals: day.totals, remaining: day.remaining };
  },

  async copy_meals(ctx, p) {
    const from = resolveDate(p.from_date);
    const to = resolveDate(p.to_date);
    if (from === to) throw new ActionError('from_date and to_date are the same');
    let q = ctx.supabase.from('daily_logs').select('meal_type, recipe_id, portions_eaten').eq('user_id', ctx.user.id).eq('date', from).order('id', { ascending: true });
    if (p.meal_type) q = q.eq('meal_type', mealType(p.meal_type));
    const src = must(await q);
    if (!src || !src.length) throw new ActionError(`Nothing logged on ${from}${p.meal_type ? ` for ${p.meal_type}` : ''}`, 404);
    must(await ctx.supabase.from('daily_logs').insert(src.map((l) => ({ ...l, date: to, user_id: ctx.user.id }))));
    const day = await daySummary(ctx, to);
    return { status: 'copied', copied: src.length, from_date: from, to_date: to, day_totals: day.totals, remaining: day.remaining };
  },

  async update_log_entry(ctx, p) {
    const id = int(p.id, 'id');
    const log = must(
      await ctx.supabase.from('daily_logs').select('id, date, recipes(status)').eq('id', id).eq('user_id', ctx.user.id).maybeSingle()
    );
    if (!log) throw new ActionError('Log entry not found', 404);
    const patch = {};
    const weight = num(p.weight_g, 'weight_g', { min: 0.1 });
    if (weight !== undefined) {
      if (log.recipes?.status !== 'single_ingredient') throw new ActionError('weight_g only applies to single-food entries; use portions_eaten for recipes');
      patch.portions_eaten = weight / 100;
    }
    const portions = num(p.portions_eaten, 'portions_eaten', { min: 0.01 });
    if (portions !== undefined) patch.portions_eaten = portions;
    if (p.meal_type) patch.meal_type = mealType(p.meal_type);
    if (p.date) patch.date = resolveDate(p.date);
    if (!Object.keys(patch).length) throw new ActionError('Nothing to update');
    const row = must(await ctx.supabase.from('daily_logs').update(patch).eq('id', id).eq('user_id', ctx.user.id).select(LOG_SELECT).single());
    return { status: 'updated', entry: describeLog(row) };
  },

  async delete_log_entry(ctx, p) {
    const id = int(p.id, 'id');
    const rows = must(await ctx.supabase.from('daily_logs').delete().eq('id', id).eq('user_id', ctx.user.id).select('id, date'));
    if (!rows || !rows.length) throw new ActionError('Log entry not found', 404);
    const day = await daySummary(ctx, rows[0].date);
    return { status: 'deleted', id, day_totals: day.totals, remaining: day.remaining };
  },

  async get_goals(ctx) {
    return goalView(await getGoals(ctx));
  },

  async update_goals(ctx, p) {
    const fields = ['calorie_goal', 'protein_goal', 'carbs_goal', 'fat_goal', 'weight_target'];
    const patch = {};
    for (const f of fields) {
      const v = num(p[f], f, { min: 1 });
      if (v !== undefined) patch[f] = v;
    }
    if (!Object.keys(patch).length) throw new ActionError('Pass at least one goal to change');
    const existing = must(await ctx.supabase.from('goals').select('id').eq('user_id', ctx.user.id).maybeSingle());
    if (existing) must(await ctx.supabase.from('goals').update(patch).eq('user_id', ctx.user.id));
    else must(await ctx.supabase.from('goals').insert({ ...DEFAULT_GOALS, ...patch, user_id: ctx.user.id }));
    return { status: 'updated', goals: goalView(await getGoals(ctx)) };
  },

  async log_weight(ctx, p) {
    const weight_kg = num(p.weight_kg, 'weight_kg', { required: true, min: 20 });
    if (weight_kg > 400) throw new ActionError('weight_kg looks wrong (expected kg)');
    const date = resolveDate(p.date);
    const existing = must(await ctx.supabase.from('weight_logs').select('id').eq('user_id', ctx.user.id).eq('date', date).limit(1));
    if (existing && existing.length) {
      must(await ctx.supabase.from('weight_logs').update({ weight_kg }).eq('id', existing[0].id).eq('user_id', ctx.user.id));
    } else {
      must(await ctx.supabase.from('weight_logs').insert({ date, weight_kg, user_id: ctx.user.id }));
    }
    const hist = await actions.get_weight_history(ctx, { days: 30 });
    return { status: existing?.length ? 'updated' : 'logged', date, weight_kg, last_30_days: { change_kg: hist.change_kg, to_target_kg: hist.to_target_kg } };
  },

  async get_weight_history(ctx, p) {
    const days = Math.min(Math.max(Math.trunc(num(p.days, 'days', { min: 1 }) ?? 90), 1), 730);
    const today = todayInTz();
    const rows = must(
      await ctx.supabase.from('weight_logs').select('date, weight_kg').eq('user_id', ctx.user.id).gte('date', addDays(today, -days)).order('date', { ascending: true })
    );
    const goals = await getGoals(ctx);
    const entries = rows || [];
    if (!entries.length) return { days, entries: [], message: 'No weight entries in this period', weight_target_kg: goals.weight_target };
    const first = entries[0], last = entries[entries.length - 1];
    const spanDays = Math.max(1, (Date.parse(last.date) - Date.parse(first.date)) / 86400000);
    return {
      days,
      entries,
      first,
      latest: last,
      change_kg: r1(last.weight_kg - first.weight_kg),
      avg_change_per_week_kg: entries.length > 1 ? Math.round(((last.weight_kg - first.weight_kg) / spanDays) * 7 * 100) / 100 : null,
      weight_target_kg: goals.weight_target,
      to_target_kg: r1(last.weight_kg - goals.weight_target),
    };
  },

  async search_ingredient(ctx, p) {
    const q = str(p.query, 'query', { required: true });
    const results = (await searchIngredients(ctx, q)).slice(0, 15);
    return { query: q, results };
  },

  async list_ingredients(ctx) {
    const rows = must(
      await ctx.supabase
        .from('ingredients')
        .select('id, name, brand, category, calories_100g, protein_100g, carbs_100g, fat_100g, serving_label, serving_grams')
        .not('status', 'in', HIDDEN_STATUSES)
        .or(`user_id.is.null,user_id.eq.${ctx.user.id}`)
        .order('name', { ascending: true })
    );
    return { count: rows?.length || 0, ingredients: rows || [] };
  },

  async add_ingredient(ctx, p) {
    const name = str(p.name, 'name', { required: true });
    const dupes = (await searchIngredients(ctx, name)).filter((m) => normalizeName(m.name) === normalizeName(name));
    if (dupes.length) return { status: 'exists', ingredient: dupes[0] };
    return { status: 'added', ingredient: await createIngredient(ctx, { ...p, name }, 'Added via AI') };
  },

  async update_ingredient(ctx, p) {
    const id = int(p.id, 'id');
    const patch = {};
    if (p.name !== undefined) patch.name = str(p.name, 'name', { required: true });
    for (const f of ['calories_100g', 'protein_100g', 'carbs_100g', 'fat_100g', 'serving_grams']) {
      const v = num(p[f], f);
      if (v !== undefined) patch[f] = v;
    }
    for (const f of ['brand', 'serving_label']) if (p[f] !== undefined) patch[f] = String(p[f]);
    if (!Object.keys(patch).length) throw new ActionError('Nothing to update');
    const rows = must(
      await ctx.supabase.from('ingredients').update(patch).eq('id', id).eq('user_id', ctx.user.id).select('id, name, calories_100g, protein_100g, carbs_100g, fat_100g')
    );
    if (!rows || !rows.length) throw new ActionError('Ingredient not found or not yours (shared ingredients cannot be edited)', 404);
    return { status: 'updated', ingredient: rows[0] };
  },

  async scan_barcode(ctx, p) {
    const barcode = str(p.barcode, 'barcode', { required: true });
    const product = await fetchOffProduct(barcode);
    if (!product) throw new ActionError(`Barcode ${barcode} not found on OpenFoodFacts`, 404, { status: 'not_found' });
    const record = ingredientFromOff(product, { barcode, userId: ctx.user.id, source: 'AI' });
    const dupes = (await searchIngredients(ctx, record.name)).filter((m) => normalizeName(m.name) === normalizeName(record.name));
    if (dupes.length) return { status: 'exists', ingredient: dupes[0] };
    const saved = must(await ctx.supabase.from('ingredients').insert(record).select('id, name, brand, calories_100g, protein_100g, carbs_100g, fat_100g, serving_label, serving_grams').single());
    return { status: 'added', ingredient: saved };
  },

  async list_recipes(ctx) {
    const rows = must(
      await ctx.supabase
        .from('recipes')
        .select('id, name, portions, status, recipe_ingredients(weight_g, ingredients(calories_100g, protein_100g, carbs_100g, fat_100g))')
        .eq('user_id', ctx.user.id)
        .eq('status', 'active')
        .order('name', { ascending: true })
    );
    return { count: rows?.length || 0, recipes: (rows || []).map(recipeView) };
  },

  async get_recipe(ctx, p) {
    const r = await findRecipe(ctx, p);
    return {
      ...recipeView(r),
      status: r.status,
      ingredients: (r.recipe_ingredients || []).map((ri) => ({ ingredient_id: ri.ingredients?.id, name: ri.ingredients?.name, weight_g: ri.weight_g })),
    };
  },

  async create_recipe(ctx, p) {
    const name = str(p.name, 'name', { required: true });
    if (!Array.isArray(p.ingredients) || !p.ingredients.length) throw new ActionError('ingredients must be a non-empty array');
    const resolved = [];
    const missing = [];
    for (const item of p.ingredients) {
      const weight_g = num(item.weight_g, 'weight_g', { required: true, min: 0.1 });
      let ing = null;
      if (item.ingredient_id) ing = await ownIngredientById(ctx, int(item.ingredient_id, 'ingredient_id'));
      else if (item.name) {
        const m = await searchIngredients(ctx, item.name);
        ing = m[0] && m[0].score >= 10 ? m[0] : null;
      }
      if (!ing) missing.push(item.name || item.ingredient_id);
      else resolved.push({ ingredient_id: ing.id, name: ing.name, weight_g });
    }
    if (missing.length) {
      throw new ActionError(`These ingredients were not found: ${missing.join(', ')}. Add them with add_ingredient first.`, 404, { missing });
    }
    const portions = num(p.portions, 'portions', { min: 0.1 }) ?? 1;
    const rec = must(await ctx.supabase.from('recipes').insert({ name, portions, status: 'active', user_id: ctx.user.id }).select('id').single());
    must(await ctx.supabase.from('recipe_ingredients').insert(resolved.map((r) => ({ recipe_id: rec.id, ingredient_id: r.ingredient_id, weight_g: r.weight_g }))));
    return { status: 'created', recipe: await actions.get_recipe(ctx, { recipe_id: rec.id }) };
  },

  async delete_recipe(ctx, p) {
    const id = int(p.recipe_id, 'recipe_id');
    const rows = must(await ctx.supabase.from('recipes').update({ status: 'archived' }).eq('id', id).eq('user_id', ctx.user.id).eq('status', 'active').select('id, name'));
    if (!rows || !rows.length) throw new ActionError('Recipe not found', 404);
    return { status: 'archived', recipe: rows[0] };
  },
};

export function hasAction(name) {
  return Object.prototype.hasOwnProperty.call(actions, ALIASES[name] || name);
}

export async function runAction(ctx, name, params = {}) {
  const real = ALIASES[name] || name;
  const fn = Object.prototype.hasOwnProperty.call(actions, real) ? actions[real] : null;
  if (!fn) throw new ActionError(`Unknown action: ${name}`, 400);
  // Legacy alias: get_weekly_stats = last 7 days
  return fn(ctx, params && typeof params === 'object' ? params : {});
}
