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

async function fetchOffProduct(barcode) {
  const url = `https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(barcode)}.json`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  return data.product || null;
}

function toNumber(v) {
  if (v === undefined || v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function per100From(n100, nserv, servGrams) {
  const val100 = toNumber(n100);
  if (val100 !== null) return Math.round(val100);
  const valServ = toNumber(nserv);
  if (valServ !== null && servGrams) {
    const per100 = (valServ / servGrams) * 100;
    return Math.round(per100);
  }
  return null;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const barcode = (searchParams.get('barcode') || '').trim();
    if (!barcode) return NextResponse.json({ error: 'barcode required' }, { status: 400 });

    const p = await fetchOffProduct(barcode);
    if (!p) return NextResponse.json({ foundLocal: false, off: null });

    const nutr = p.nutriments || {};
    const serv = parseServing(p.serving_size || '');
    const servingGrams = serv.grams;
    const calories = per100From(nutr['energy-kcal_100g'] ?? nutr['energy_100g'], nutr['energy-kcal_serving'] ?? nutr['energy_serving'] ?? nutr['energy'], servingGrams);
    const protein = per100From(nutr['proteins_100g'] ?? nutr['protein_100g'], nutr['proteins_serving'] ?? nutr['protein_serving'], servingGrams);
    const carbs = per100From(nutr['carbohydrates_100g'] ?? nutr['carbohydrates_100g'], nutr['carbohydrates_serving'] ?? nutr['carbohydrates'], servingGrams);
    const fat = per100From(nutr['fat_100g'], nutr['fat_serving'] ?? nutr['fat'], servingGrams);

    const offNormalized = {
      barcode,
      id: p.id || p.code || p._id || barcode,
      name: p.product_name || p.generic_name || p.brands || 'Unknown',
      brand: p.brands || '',
      serving_label: serv.label || p.serving_size || null,
      serving_grams: servingGrams,
      calories_100g: calories,
      protein_100g: protein,
      carbs_100g: carbs,
      fat_100g: fat,
      category: (p.categories_tags && p.categories_tags[0]) ? p.categories_tags[0].replace('en:', '').replace('-', ' ') : 'Other',
      source: 'openfoodfacts'
    };

    // check local DB for matching name
    const db = await openDb();
    const localRows = await db.all('SELECT * FROM ingredients');
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
    if (!p) return NextResponse.json({ error: 'product not found' }, { status: 404 });

    const nutr = p.nutriments || {};
    const serv = parseServing(p.serving_size || '');
    const servingGrams = serv.grams;
    const calories = per100From(nutr['energy-kcal_100g'] ?? nutr['energy_100g'], nutr['energy-kcal_serving'] ?? nutr['energy_serving'] ?? nutr['energy'], servingGrams);
    const protein = per100From(nutr['proteins_100g'] ?? nutr['protein_100g'], nutr['proteins_serving'] ?? nutr['protein_serving'], servingGrams);
    const carbs = per100From(nutr['carbohydrates_100g'] ?? nutr['carbohydrates_100g'], nutr['carbohydrates_serving'] ?? nutr['carbohydrates'], servingGrams);
    const fat = per100From(nutr['fat_100g'], nutr['fat_serving'] ?? nutr['fat'], servingGrams);

    const record = {
      name: p.product_name || p.generic_name || p.brands || 'Unknown',
      brand: p.brands || '',
      category: (p.categories_tags && p.categories_tags[0]) ? p.categories_tags[0].replace('en:', '').replace('-', ' ') : (body.category || 'Other'),
      status: 'Raw',
      calories_100g: calories || 0,
      protein_100g: protein || 0,
      carbs_100g: carbs || 0,
      fat_100g: fat || 0,
      serving_label: serv.label || p.serving_size || null,
      serving_grams: servingGrams || null,
      price_kg: null,
      notes: `Imported from OpenFoodFacts barcode ${barcode}`
    };

    if (!create) return NextResponse.json({ created: false, preview: record });

    const db = await openDb();
    const res = await db.run(`INSERT INTO ingredients (name, category, brand, status, calories_100g, protein_100g, carbs_100g, fat_100g, price_kg, notes, serving_label, serving_grams)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [record.name, record.category, record.brand, record.status, record.calories_100g, record.protein_100g, record.carbs_100g, record.fat_100g, record.price_kg, record.notes, record.serving_label, record.serving_grams]);
    const id = res.lastID;
    const created = await db.get('SELECT * FROM ingredients WHERE id = ?', [id]);
    return NextResponse.json({ created: true, ingredient: created });
  } catch (e) {
    console.error('barcode POST error', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
