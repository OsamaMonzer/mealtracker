// Shared nutrition helpers (OpenFoodFacts parsing, serving sizes, macro maths).

export function toNumber(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function numberOrZero(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

export function optionalNumber(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

export function normalizeName(n) {
  return (n || '').toString().trim().toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ');
}

const UNIT_GRAMS = { egg: 60, eggs: 60, slice: 30, slices: 30, tbsp: 15, tablespoon: 15, tsp: 5, teaspoon: 5, cup: 240, ml: 1 };

// "30g" / "30" → { grams: 30 }; "2 eggs" → { label: '2 eggs', grams: 120 }; else just a label.
export function parseServing(serving) {
  if (serving == null) return { label: null, grams: null };
  const s = String(serving).trim();
  if (!s) return { label: null, grams: null };
  const g = s.match(/^(\d+(?:\.\d+)?)\s*(g|gr|gram|grams)?$/i);
  if (g) return { label: null, grams: parseFloat(g[1]) };
  const q = s.match(/^(\d+(?:\.\d+)?)\s*(\w+)\b/i);
  if (q) {
    const unit = q[2].toLowerCase();
    if (UNIT_GRAMS[unit]) return { label: s, grams: +(parseFloat(q[1]) * UNIT_GRAMS[unit]).toFixed(2) };
  }
  return { label: s, grams: null };
}

export function resolveKcal(nutr, servingGrams) {
  const k100 = toNumber(nutr['energy-kcal_100g']);
  if (k100 !== null) return Math.round(k100);
  const kServ = toNumber(nutr['energy-kcal_serving']);
  if (kServ !== null && servingGrams) return Math.round((kServ / servingGrams) * 100);
  const kj = toNumber(nutr['energy-kj_100g']) ?? toNumber(nutr['energy_100g']);
  if (kj !== null) return Math.round(kj / 4.184);
  return null;
}

export function per100From(val100, valServ, servingGrams) {
  const v = toNumber(val100);
  if (v !== null) return Math.round(v * 10) / 10;
  const vs = toNumber(valServ);
  if (vs !== null && servingGrams) return Math.round((vs / servingGrams) * 1000) / 10;
  return null;
}

export function extractMacros(nutr, servingGrams) {
  return {
    calories: resolveKcal(nutr, servingGrams),
    protein: per100From(nutr['proteins_100g'] ?? nutr['protein_100g'], nutr['proteins_serving'] ?? nutr['protein_serving'], servingGrams),
    carbs: per100From(nutr['carbohydrates_100g'], nutr['carbohydrates_serving'], servingGrams),
    fat: per100From(nutr['fat_100g'], nutr['fat_serving'], servingGrams),
  };
}

const OFF_FIELDS = 'product_name,generic_name,brands,nutriments,serving_size,categories_tags,code,_id';

export async function fetchOffProduct(barcode) {
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=${OFF_FIELDS}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'MealTracker/1.0 (personal nutrition app)' } });
  if (!res.ok) return null;
  const data = await res.json();
  return data.status === 1 && data.product ? data.product : null;
}

// Builds an `ingredients` row from an OpenFoodFacts product.
export function ingredientFromOff(product, { barcode, userId, source }) {
  const serv = parseServing(product.serving_size || '');
  const m = extractMacros(product.nutriments || {}, serv.grams);
  return {
    name: product.product_name || product.generic_name || product.brands || 'Unknown',
    category: product.categories_tags?.[0] ? product.categories_tags[0].replace(/^en:/, '').replace(/-/g, ' ') : 'Other',
    brand: product.brands || '',
    status: 'Raw',
    calories_100g: m.calories ?? 0,
    protein_100g: m.protein ?? 0,
    carbs_100g: m.carbs ?? 0,
    fat_100g: m.fat ?? 0,
    notes: `Scanned via ${source} — barcode ${barcode}`,
    serving_label: serv.label || product.serving_size || null,
    serving_grams: serv.grams || null,
    user_id: userId,
  };
}

// Total macros of a recipe from its nested recipe_ingredients → ingredients rows.
export function recipeTotals(recipeIngredients) {
  let calories = 0, protein = 0, carbs = 0, fat = 0;
  for (const ri of recipeIngredients || []) {
    const i = ri.ingredients || {};
    const r = (ri.weight_g || 0) / 100;
    calories += (i.calories_100g || 0) * r;
    protein += (i.protein_100g || 0) * r;
    carbs += (i.carbs_100g || 0) * r;
    fat += (i.fat_100g || 0) * r;
  }
  return { calories, protein, carbs, fat };
}

// Macros eaten for one daily_logs row with nested recipes(portions, recipe_ingredients(...)).
export function logMacros(log) {
  const rec = log.recipes || {};
  const t = recipeTotals(rec.recipe_ingredients);
  const k = (log.portions_eaten ?? 1) / (rec.portions || 1);
  return {
    calories: Math.round(t.calories * k),
    protein: Math.round(t.protein * k * 10) / 10,
    carbs: Math.round(t.carbs * k * 10) / 10,
    fat: Math.round(t.fat * k * 10) / 10,
  };
}

// Escapes user text for PostgREST .or()/.ilike() filters (commas/parens break the filter syntax).
export function safeFilterText(s) {
  return String(s || '').replace(/[,()*%\\"]/g, ' ').trim();
}
