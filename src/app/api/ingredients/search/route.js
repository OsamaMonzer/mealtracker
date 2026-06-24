import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

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

function toNumber(v) {
  if (v === undefined || v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// OFf sometimes stores energy in kJ instead of kcal — detect & convert
function resolveCalories(nutr, servingGrams) {
  // Try explicit kcal per 100g first
  let val = toNumber(nutr['energy-kcal_100g']);
  if (val !== null && val > 0) return Math.round(val);

  // Try per-serving kcal then convert
  const servKcal = toNumber(nutr['energy-kcal_serving']);
  if (servKcal !== null && servKcal > 0 && servingGrams) {
    return Math.round((servKcal / servingGrams) * 100);
  }

  // Fallback: energy_100g — check if kJ (>900 for normal foods) and divide by 4.184
  const raw100 = toNumber(nutr['energy_100g']);
  if (raw100 !== null && raw100 > 0) {
    // heuristic: kcal values for food are almost never above 900; kJ values usually are
    return raw100 > 900 ? Math.round(raw100 / 4.184) : Math.round(raw100);
  }

  // Last resort: energy_serving
  const rawServ = toNumber(nutr['energy_serving'] ?? nutr['energy']);
  if (rawServ !== null && rawServ > 0 && servingGrams) {
    const per100 = (rawServ / servingGrams) * 100;
    return per100 > 900 ? Math.round(per100 / 4.184) : Math.round(per100);
  }

  return null;
}

function per100From(n100, nserv, servGrams) {
  const val100 = toNumber(n100);
  if (val100 !== null) return Math.round(val100 * 10) / 10;
  const valServ = toNumber(nserv);
  if (valServ !== null && servGrams) {
    return Math.round(((valServ / servGrams) * 100) * 10) / 10;
  }
  return null;
}

function mapProduct(p) {
  const nutr = p.nutriments || {};
  const serv = parseServing(p.serving_size || '');
  const servingGrams = serv.grams;

  const calories = resolveCalories(nutr, servingGrams);
  const protein = per100From(nutr['proteins_100g'] ?? nutr['protein_100g'], nutr['proteins_serving'] ?? nutr['protein_serving'], servingGrams);
  const carbs = per100From(nutr['carbohydrates_100g'], nutr['carbohydrates_serving'] ?? nutr['carbohydrates'], servingGrams);
  const fat = per100From(nutr['fat_100g'], nutr['fat_serving'] ?? nutr['fat'], servingGrams);

  const rawCategory = (p.categories_tags && p.categories_tags[0]) ? p.categories_tags[0].replace('en:', '').replace(/-/g, ' ') : 'Other';

  return {
    id: p.id || p.code || p._id || String(p.code || p._id),
    name: p.product_name_en || p.product_name || p.generic_name || p.brands || 'Unknown',
    brand: p.brands || '',
    serving_label: serv.label || p.serving_size || null,
    serving_grams: servingGrams,
    calories_100g: calories,
    protein_100g: protein,
    carbs_100g: carbs,
    fat_100g: fat,
    category: rawCategory,
    source: 'openfoodfacts',
  };
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') || '';
    const barcodeParam = searchParams.get('barcode') || '';

    // ── Barcode lookup ────────────────────────────────────────────────────
    if (barcodeParam) {
      try {
        const prodUrl = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcodeParam)}.json?fields=product_name,product_name_en,generic_name,brands,serving_size,nutriments,categories_tags,code,id,_id`;
        const pres = await fetch(prodUrl, { headers: { 'User-Agent': 'MealTracker/1.0' } });
        if (!pres.ok) return NextResponse.json([], { status: 200 });
        const pdata = await pres.json();
        if (pdata.status !== 1 || !pdata.product) return NextResponse.json([], { status: 200 });
        return NextResponse.json([mapProduct(pdata.product)]);
      } catch (e) {
        console.error('Barcode lookup error', e);
        return NextResponse.json([], { status: 200 });
      }
    }

    // ── Text search ───────────────────────────────────────────────────────
    if (!q) return NextResponse.json([], { status: 200 });

    const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=20&fields=product_name,product_name_en,generic_name,brands,serving_size,nutriments,categories_tags,code,id,_id`;
    const res = await fetch(url, { headers: { 'User-Agent': 'MealTracker/1.0' } });
    if (!res.ok) return NextResponse.json({ error: 'External API error' }, { status: 502 });
    const data = await res.json();

    const results = (data.products || []).map(mapProduct).filter(p => p.name && p.name !== 'Unknown');
    return NextResponse.json(results);
  } catch (e) {
    console.error('Search proxy error', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
