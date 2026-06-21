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

export async function PUT(request, { params }) {
  try {
    const data = await request.json();
    const { name, category, brand, status, calories_100g, protein_100g, carbs_100g, fat_100g, price_kg, notes, serving_g } = data;
    const calories = parseFloat(calories_100g);
    const protein = parseFloat(protein_100g);
    if (!name || !Number.isFinite(calories) || !Number.isFinite(protein)) {
      return NextResponse.json({ error: 'Missing required numeric fields or name' }, { status: 400 });
    }
    const servingLabel = (() => {
      const parsed = parseFloat(serving_g);
      return Number.isFinite(parsed) ? null : (serving_g || null);
    })();

    const db = await openDb();
    await db.run(`
      UPDATE ingredients SET name=?, category=?, brand=?, status=?, calories_100g=?, protein_100g=?, carbs_100g=?, fat_100g=?, price_kg=?, notes=?, serving_label=?
      WHERE id=?`,
      [name, category, brand, status, calories, protein, numberOrZero(carbs_100g), numberOrZero(fat_100g), optionalNumber(price_kg), notes, servingLabel, params.id]
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
