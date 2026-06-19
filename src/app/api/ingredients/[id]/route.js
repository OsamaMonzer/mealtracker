import { NextResponse } from 'next/server';
import { openDb } from '../../../../lib/db';

export async function PUT(request, { params }) {
  try {
    const data = await request.json();
    const { name, category, brand, status, calories_100g, protein_100g, carbs_100g, fat_100g, price_kg, notes } = data;
    const db = await openDb();
    await db.run(`
      UPDATE ingredients SET name=?, category=?, brand=?, status=?, calories_100g=?, protein_100g=?, carbs_100g=?, fat_100g=?, price_kg=?, notes=?
      WHERE id=?`,
      [name, category, brand, status, parseFloat(calories_100g), parseFloat(protein_100g), parseFloat(carbs_100g), parseFloat(fat_100g), price_kg ? parseFloat(price_kg) : null, notes, params.id]
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
