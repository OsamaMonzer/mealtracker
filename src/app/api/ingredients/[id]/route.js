import { NextResponse } from 'next/server';
import { openDb } from '../../../../lib/db';

function numberOrZero(value) {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function optionalNumber(value) {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseServing(serving) {
  if (serving == null) return { label: null, grams: null };
  const s = String(serving).trim();
  if (!s) return { label: null, grams: null };
  const gMatch = s.match(/^(\d+(?:\.\d+)?)\s*(g|gr|gram|grams)?$/i);
  if (gMatch) return { label: null, grams: parseFloat(gMatch[1]) };
  const qtyMatch = s.match(/^(\d+(?:\.\d+)?)\s*(\w+)\b/i);
  const mapping = { egg: 60, eggs: 60, slice: 30, slices: 30, tbsp: 15, tablespoon: 15, tsp: 5, teaspoon: 5, cup: 240 };
  if (qtyMatch) {
    const qty = parseFloat(qtyMatch[1]);
    const unit = qtyMatch[2].toLowerCase();
    if (mapping[unit]) return { label: s, grams: +(qty * mapping[unit]).toFixed(2) };
  }
  return { label: s, grams: null };
}

export async function PUT(request, { params }) {
  try {
    const data = await request.json();
    const { name, category, brand, status, calories_100g, protein_100g, carbs_100g, fat_100g, price_kg, notes, serving_g } = data;
    const calories = parseFloat(calories_100g);
    const protein = parseFloat(protein_100g);
    if (!name || !Number.isFinite(calories) || !Number.isFinite(protein)) {
      return NextResponse.json({ error: 'Missing required numeric fields or name' }, { status: 400 });
    }

    const parsed = parseServing(serving_g);
    const servingLabel = parsed.label;
    const servingGrams = parsed.grams;

    const db = await openDb();
    await db.run(`
      UPDATE ingredients SET name=?, category=?, brand=?, status=?, calories_100g=?, protein_100g=?, carbs_100g=?, fat_100g=?, price_kg=?, notes=?, serving_label=?, serving_grams=?
      WHERE id=?`,
      [name, category, brand, status, calories, protein, numberOrZero(carbs_100g), numberOrZero(fat_100g), optionalNumber(price_kg), notes, servingLabel, servingGrams, params.id]
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const db = await openDb();
    await db.run('DELETE FROM ingredients WHERE id = ?', [params.id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
