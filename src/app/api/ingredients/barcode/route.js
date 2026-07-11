import { NextResponse } from 'next/server';
import { openDb } from '../../../../lib/db';

export const dynamic = 'force-dynamic';

function normalizeName(n) {
  return (n || '').toString().trim().toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ');
}

function parseServing(s) {
  if (!s) return { label: null, grams: null };
  const str = String(s).trim();
  const gMatch = str.match(/^(\d+(?:\.\d+)?)\s*(g|gr|gram|grams)$/i);
  if (gMatch) return { label: null, grams: parseFloat(gMatch[1]) };
  const qtyMatch = str.match(/^(\d+(?:\.\d+)?)\s*(\w+)\b/i);
  const mapping = { egg: 60, eggs: 60, slice: 30, slices: 30, tbsp: 15, tablespoon: 15, tsp: 5, teaspoon: 5, cup: 240, ml: 1 };
  if (qtyMatch) {
    const qty = parseFloat(qtyMatch[1]);
    const unit = qtyMatch[2].toLowerCase();
    if (mapping[unit]) return { label: str, grams: +(qty * mapping[unit]).toFixed(2) };
  }
  return { label: str, grams: null };
}

// Use v2 — more complete nutriment data, actively maintained
async function fetchOffProduct(barcode) {
  const fields = 'product_name,generic_name,brands,nutriments,serving_size,categories_tags,code,_id';
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=${fields}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'MealTracker/1.0 (personal nutrition app)' },
  });
  if (!res.ok) return null;
  const data = await res.json();
  // v2 wraps in { product: {...}, status: 1 }
  if (data.status === 0 || !data.product) return null;
  return data.product;
}

function toNumber(v) {
  if (v === undefined || v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// OFF stores energy_100g in kJ. Always prefer energy-kcal_100g first.
// Fallback chain: energy-kcal_100g → energy-kcal_serving (scaled) → convert from kJ
function resolveKcal(nutr, servingGrams) {
  // Best: explicit kcal per 100g field
  const kcal100 = toNumber(nutr['energy-kcal_100g']);
  if (kcal100 !== null) return Math.round(kcal100);

  // Second: kcal per serving, scaled to 100g
  const kcalServ = toNumber(nutr['energy-kcal_serving']);
  if (kcalServ !== null && servingGrams) {
    return Math.round((kcalServ / servingGrams) * 100);
  }

  // Last resort: kJ per 100g → divide by 4.184
  const kj100 = toNumber(nutr['energy-kj_100g']) ?? toNumber(nutr['energy_100g']);
  if (kj100 !== null) return Math.round(kj100 / 4.184);

  return null;
}

function per100From(val100, valServ, servingGrams) {
  const v100 = toNumber(val100);
  if (v100 !== null) return Math.round(v100 * 10) / 10; // 1 decimal
  const vServ = toNumber(valServ);
  if (vServ !== null && servingGrams) {
    return Math.round((vServ / servingGrams) * 1000) / 10;
  }
  return null;
}

function extractMacros(nutr, servingGrams) {
  return {
    calories: resolveKcal(nutr, servingGrams),
    protein:  per100From(nutr['proteins_100g']       ?? nutr['protein_100g'],       nutr['proteins_serving']       ?? nutr['protein_serving'],       servingGrams),
    carbs:    per100From(nutr['carbohydrates_100g'],                                 nutr['carbohydrates_serving'],                                    servingGrams),
    fat:      per100From(nutr['fat_100g'],                                           nutr['fat_serving'],                                              servingGrams),
  };
}

function buildRecord(p, barcode, overrideCategory) {
  const nutr = p.nutriments || {};
  const serv = parseServing(p.serving_size || '');
  const { calories, protein, carbs, fat } = extractMacros(nutr, serv.grams);

  return {
    barcode,
    id:             p.code || p._id || barcode,
    name:           p.product_name || p.generic_name || p.brands || 'Unknown',
    brand:          p.brands || '',
    serving_label:  serv.label || p.serving_size || null,
    serving_grams:  serv.grams || null,
    calories_100g:  calories ?? 0,
    protein_100g:   protein  ?? 0,
    carbs_100g:     carbs    ?? 0,
    fat_100g:       fat      ?? 0,
    category:       (p.categories_tags?.[0])
                      ? p.categories_tags[0].replace(/^en:/, '').replace(/-/g, ' ')
                      : (overrideCategory || 'Other'),
    source: 'openfoodfacts',
  };
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const barcode = (searchParams.get('barcode') || '').trim();
    if (!barcode) return NextResponse.json({ error: 'barcode required' }, { status: 400 });

    const p = await fetchOffProduct(barcode);
    if (!p) return NextResponse.json({ foundLocal: false, off: null });

    const offNormalized = buildRecord(p, barcode);

    // Check local DB for matching name
    const db = await openDb();
    const localRows = await db.all('SELECT * FROM ingredients WHERE status NOT IN (\'quick_add\',\'single_ingredient\',\'one_off\')');
    const norm = normalizeName(offNormalized.name);
    const found = localRows.find(r => normalizeName(r.name) === norm);

    return NextResponse.json({ foundLocal: !!found, local: found || null, off: offNormalized });
  } catch (e) {
    console.error('barcode GET error', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const barcode = (body.barcode || '').toString().trim();
    if (!barcode) return NextResponse.json({ error: 'barcode required' }, { status: 400 });

    const create = !!body.create;
    const p = await fetchOffProduct(barcode);
    if (!p) return NextResponse.json({ created: false, message: 'product not found in OpenFoodFacts' });

    const record = buildRecord(p, barcode, body.category);

    const db = await openDb();
    // Check for existing by normalized name to avoid duplicates
    const localRows = await db.all('SELECT * FROM ingredients WHERE status NOT IN (\'quick_add\',\'single_ingredient\',\'one_off\')');
    const norm = normalizeName(record.name);
    const existing = localRows.find(r => normalizeName(r.name) === norm);
    if (existing) return NextResponse.json({ created: false, message: 'already exists', local: existing });

    if (!create) return NextResponse.json({ created: false, preview: record });

    const res = await db.run(
      `INSERT INTO ingredients (name, category, brand, status, calories_100g, protein_100g, carbs_100g, fat_100g, price_kg, notes, serving_label, serving_grams)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [record.name, record.category, record.brand, 'Raw',
       record.calories_100g, record.protein_100g, record.carbs_100g, record.fat_100g,
       null, `Imported from OpenFoodFacts barcode ${barcode}`,
       record.serving_label, record.serving_grams]
    );
    const created = await db.get('SELECT * FROM ingredients WHERE id = ?', [res.lastID]);
    return NextResponse.json({ created: true, ingredient: created });
  } catch (e) {
    console.error('barcode POST error', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
