import { openDb } from '../../../lib/db';
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

async function loadSeed() {
  const dataPath = path.resolve(process.cwd(), 'src', 'data', 'seedIngredients.json');
  try {
    if (fs.existsSync(dataPath)) {
      const raw = await fs.promises.readFile(dataPath, 'utf8');
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Failed to load seed file', e);
  }
  return [];
}

export async function GET() {
  try {
    const db = await openDb();
    const INGREDIENTS = await loadSeed();
    let added = 0, skipped = 0;

    for (const item of INGREDIENTS) {
      const exists = await db.get('SELECT id FROM ingredients WHERE name = ?', [item.name]);
      if (exists) { skipped++; continue; }
      await db.run(
        `INSERT INTO ingredients (name, category, brand, status, calories_100g, protein_100g, carbs_100g, fat_100g, price_kg, notes, serving_label) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [item.name, item.category, item.brand, item.status, item.calories_100g, item.protein_100g, item.carbs_100g, item.fat_100g, item.price_kg, item.notes, item.serving_label || null]
      );
      added++;
    }

    return NextResponse.json({ success: true, added, skipped });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
