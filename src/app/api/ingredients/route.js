import { NextResponse } from 'next/server';
import { openDb } from '../../../lib/db';

export const dynamic = 'force-dynamic';

function numberOrZero(value) {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function optionalNumber(value) {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function GET() {
  try {
    const db = await openDb();
    const ingredients = await db.all('SELECT * FROM ingredients ORDER BY name ASC');
    return NextResponse.json(ingredients);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function parseServing(serving) {
  if (serving == null) return { label: null, grams: null };
  const s = String(serving).trim();
  if (!s) return { label: null, grams: null };
  // direct grams like "100" or "100g"
  const gMatch = s.match(/^(\d+(?:\.\d+)?)\s*(g|gr|gram|grams)?$/i);
  if (gMatch) return { label: null, grams: parseFloat(gMatch[1]) };
  // quantity + unit e.g. "1 egg", "2 slices"
  const qtyMatch = s.match(/^(\d+(?:\.\d+)?)\s*(\w+)\b/i);
  const mapping = { egg: 60, eggs: 60, slice: 30, slices: 30, tbsp: 15, tablespoon: 15, tsp: 5, teaspoon: 5, cup: 240 };
  if (qtyMatch) {
    const qty = parseFloat(qtyMatch[1]);
    const unit = qtyMatch[2].toLowerCase();
    if (mapping[unit]) return { label: s, grams: +(qty * mapping[unit]).toFixed(2) };
  }
  return { label: s, grams: null };
}

export async function POST(request) {
  try {
    const data = await request.json();
    const { name, category, brand, status, calories_100g, protein_100g, carbs_100g, fat_100g, price_kg, notes, serving_g } = data;
    
    const calories = parseFloat(calories_100g);
    const protein = parseFloat(protein_100g);
    if (!name || !Number.isFinite(calories) || !Number.isFinite(protein)) {
        return NextResponse.json({ error: 'Missing required numeric fields or name' }, { status: 400 });
    }

    // parse serving into label and grams when possible
    const parsedServing = parseServing(serving_g);
    const servingLabel = parsedServing.label;
    const servingGrams = parsedServing.grams;

    const db = await openDb();
    const result = await db.run(`
      INSERT INTO ingredients 
      (name, category, brand, status, calories_100g, protein_100g, carbs_100g, fat_100g, price_kg, notes, serving_label, serving_grams) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, category || '', brand || '', status || '', calories, protein, numberOrZero(carbs_100g), numberOrZero(fat_100g), optionalNumber(price_kg), notes || '', servingLabel, servingGrams]
    );
    
    return NextResponse.json({ id: result.lastID, ...data, serving_label: servingLabel, serving_grams: servingGrams }, { status: 201 });
  } catch (error) {
    console.error("Error inserting ingredient:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
