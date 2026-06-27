import { NextResponse } from 'next/server';
import { openDb } from '../../../../lib/db';

export const dynamic = 'force-dynamic';

// ── Shortcut-friendly barcode scan + auto-save endpoint ──────────────────────
// Called by iPhone Shortcut with:
//   POST /api/shortcut/scan
//   Header: x-api-key: mealtracker-shortcut-2024
//   Body: { "barcode": "1234567890123" }
//
// Returns:
//   { saved: true, ingredient: {...} }   ← new ingredient created
//   { saved: false, existing: {...} }    ← already in your DB
//   { saved: false, notFound: true }     ← barcode not on OpenFoodFacts

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
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function resolveKcal(nutr, servingGrams) {
  const kcal100 = toNumber(nutr['energy-kcal_100g']);
  if (kcal100 !== null) return Math.round(kcal100);
  const kcalServ = toNumber(nutr['energy-kcal_serving']);
  if (kcalServ !== null && servingGrams) return Math.round((kcalServ / servingGrams) * 100);
  const kj = toNumber(nutr['energy-kj_100g']) ?? toNumber(nutr['energy_100g']);
  if (kj !== null) return Math.round(kj / 4.184);
  return null;
}

function per100(val100, valServ, servingGrams) {
  const v = toNumber(val100);
  if (v !== null) return Math.round(v * 10) / 10;
  const vs = toNumber(valServ);
  if (vs !== null && servingGrams) return Math.round((vs / servingGrams) * 1000) / 10;
  return null;
}

function normalizeName(n) {
  return (n || '').toString().trim().toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ');
}

async function fetchProduct(barcode) {
  const fields = 'product_name,generic_name,brands,nutriments,serving_size,categories_tags,code,_id';
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=${fields}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'MealTracker/1.0 (personal nutrition app)' } });
  if (!res.ok) return null;
  const data = await res.json();
  if (data.status === 0 || !data.product) return null;
  return data.product;
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const barcode = (body.barcode || '').toString().trim();
    if (!barcode) {
      return NextResponse.json({ error: 'barcode is required' }, { status: 400 });
    }

    const db = await openDb();

    // 1. Check if already in local DB (skip hidden ingredients)
    const localRows = await db.all(
      "SELECT * FROM ingredients WHERE status NOT IN ('quick_add','single_ingredient','one_off')"
    );
    const product = await fetchProduct(barcode);

    if (!product) {
      return NextResponse.json({ saved: false, notFound: true, barcode });
    }

    const nutr = product.nutriments || {};
    const serv = parseServing(product.serving_size || '');
    const name = product.product_name || product.generic_name || product.brands || 'Unknown';

    const existing = localRows.find(r => normalizeName(r.name) === normalizeName(name));
    if (existing) {
      return NextResponse.json({ saved: false, existing });
    }

    // 2. Save to DB
    const record = {
      name,
      brand:          product.brands || '',
      category:       product.categories_tags?.[0]
                        ? product.categories_tags[0].replace(/^en:/, '').replace(/-/g, ' ')
                        : 'Other',
      status:         'Raw',
      calories_100g:  resolveKcal(nutr, serv.grams) ?? 0,
      protein_100g:   per100(nutr['proteins_100g'] ?? nutr['protein_100g'], nutr['proteins_serving'], serv.grams) ?? 0,
      carbs_100g:     per100(nutr['carbohydrates_100g'], nutr['carbohydrates_serving'], serv.grams) ?? 0,
      fat_100g:       per100(nutr['fat_100g'], nutr['fat_serving'], serv.grams) ?? 0,
      serving_label:  serv.label || product.serving_size || null,
      serving_grams:  serv.grams || null,
      notes:          `Scanned via Shortcut — barcode ${barcode}`,
    };

    const res = await db.run(
      `INSERT INTO ingredients (name, category, brand, status, calories_100g, protein_100g, carbs_100g, fat_100g, price_kg, notes, serving_label, serving_grams)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, null, ?, ?, ?)`,
      [record.name, record.category, record.brand, record.status,
       record.calories_100g, record.protein_100g, record.carbs_100g, record.fat_100g,
       record.notes, record.serving_label, record.serving_grams]
    );

    const saved = await db.get('SELECT * FROM ingredients WHERE id = ?', [res.lastID]);
    return NextResponse.json({ saved: true, ingredient: saved });

  } catch (e) {
    console.error('shortcut scan error', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
