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

export async function POST(request) {
  try {
    const data = await request.json();
    const { name, category, brand, status, calories_100g, protein_100g, carbs_100g, fat_100g, price_kg, notes, serving_g } = data;
    
    const calories = parseFloat(calories_100g);
    const protein = parseFloat(protein_100g);
    if (!name || !Number.isFinite(calories) || !Number.isFinite(protein)) {
        return NextResponse.json({ error: 'Missing required numeric fields or name' }, { status: 400 });
    }

    // If serving_g is non-numeric (e.g., "1 egg"), store it as serving_label. Otherwise leave null.
    const servingLabel = (() => {
      const parsed = parseFloat(serving_g);
      return Number.isFinite(parsed) ? null : (serving_g || null);
    })();

    const db = await openDb();
    const result = await db.run(`
      INSERT INTO ingredients 
      (name, category, brand, status, calories_100g, protein_100g, carbs_100g, fat_100g, price_kg, notes, serving_label) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, category || '', brand || '', status || '', calories, protein, numberOrZero(carbs_100g), numberOrZero(fat_100g), optionalNumber(price_kg), notes || '', servingLabel]
    );
    
    return NextResponse.json({ id: result.lastID, ...data, serving_label: servingLabel }, { status: 201 });
  } catch (error) {
    console.error("Error inserting ingredient:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
