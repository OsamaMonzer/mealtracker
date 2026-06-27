import { NextResponse } from 'next/server';
import { openDb } from '../../../../lib/db';

export const dynamic = 'force-dynamic';

// ── Shortcut-friendly barcode scan + auto-save endpoint ──────────────────────
// Called by iPhone Shortcut with:
//   POST /api/shortcut/scan
//   Header: x-api-key: mealtracker-shortcut-2024
//   Body: { "barcode": "1234567890123" }
//
// Every response always includes a top-level "message" string you can
// show directly in the Shortcut as a notification/alert. Possible values:
//
//   status: "added"     → ingredient was found on OpenFoodFacts and saved to your DB
//   status: "exists"    → already in your DB, nothing changed
//   status: "not_found" → barcode not recognised by OpenFoodFacts
//   status: "error"     → something went wrong (see "message")

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
      return NextResponse.json({
        status: 'error',
        message: '❌ No barcode provided.',
      }, { status: 400 });
    }

    const db = await openDb();
    const localRows = await db.all(
      "SELECT * FROM ingredients WHERE status NOT IN ('quick_add','single_ingredient','one_off')"
    );

    const product = await fetchProduct(barcode);

    if (!product) {
      return NextResponse.json({
        status: 'not_found',
        message: `❌ Barcode ${barcode} not found on OpenFoodFacts.`,
        barcode,
      });
    }

    const nutr = product.nutriments || {};
    const serv = parseServing(product.serving_size || '');
    const name = product.product_name || product.generic_name || product.brands || 'Unknown';
    const cals = resolveKcal(nutr, serv.grams) ?? 0;
    const prot = per100(nutr['proteins_100g'] ?? nutr['protein_100g'], nutr['proteins_serving'], serv.grams) ?? 0;
    const carb = per100(nutr['carbohydrates_100g'], nutr['carbohydrates_serving'], serv.grams) ?? 0;
    const fat  = per100(nutr['fat_100g'], nutr['fat_serving'], serv.grams) ?? 0;

    const existing = localRows.find(r => normalizeName(r.name) === normalizeName(name));
    if (existing) {
      return NextResponse.json({
        status: 'exists',
        message: `✅ Already in your DB: ${name}\n${cals} kcal · P ${existing.protein_100g}g · C ${existing.carbs_100g}g · F ${existing.fat_100g}g (per 100g)`,
        ingredient: existing,
      });
    }

    // Save to DB
    const res = await db.run(
      `INSERT INTO ingredients (name, category, brand, status, calories_100g, protein_100g, carbs_100g, fat_100g, price_kg, notes, serving_label, serving_grams)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, null, ?, ?, ?)`,
      [
        name,
        product.categories_tags?.[0]
          ? product.categories_tags[0].replace(/^en:/, '').replace(/-/g, ' ')
          : 'Other',
        product.brands || '',
        'Raw',
        cals, prot, carb, fat,
        `Scanned via Shortcut — barcode ${barcode}`,
        serv.label || product.serving_size || null,
        serv.grams || null,
      ]
    );

    const saved = await db.get('SELECT * FROM ingredients WHERE id = ?', [res.lastID]);
    return NextResponse.json({
      status: 'added',
      message: `✅ Added: ${name}\n${cals} kcal · P ${prot}g · C ${carb}g · F ${fat}g (per 100g)`,
      ingredient: saved,
    });

  } catch (e) {
    console.error('shortcut scan error', e);
    return NextResponse.json({
      status: 'error',
      message: `❌ Error: ${e.message}`,
    }, { status: 500 });
  }
}
