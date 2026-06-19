import { NextResponse } from 'next/server';
import { openDb } from '../../../lib/db';

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
    const { name, category, brand, status, calories_100g, protein_100g, carbs_100g, fat_100g, price_kg, notes } = data;
    
    if (!name || isNaN(calories_100g) || isNaN(protein_100g) || isNaN(carbs_100g) || isNaN(fat_100g)) {
        return NextResponse.json({ error: 'Missing required numeric fields or name' }, { status: 400 });
    }

    const db = await openDb();
    const result = await db.run(`
      INSERT INTO ingredients 
      (name, category, brand, status, calories_100g, protein_100g, carbs_100g, fat_100g, price_kg, notes) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, category || '', brand || '', status || '', parseFloat(calories_100g), parseFloat(protein_100g), parseFloat(carbs_100g), parseFloat(fat_100g), price_kg ? parseFloat(price_kg) : null, notes || '']
    );
    
    return NextResponse.json({ id: result.lastID, ...data }, { status: 201 });
  } catch (error) {
    console.error("Error inserting ingredient:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
