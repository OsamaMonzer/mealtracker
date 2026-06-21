import { NextResponse } from 'next/server';
import { openDb } from '../../../../lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get('q') || '').trim();
    if (!q) return NextResponse.json([], { status: 200 });
    const db = await openDb();
    const like = `%${q}%`;
    const rows = await db.all(`SELECT id, name, brand, serving_label, serving_grams, calories_100g, protein_100g, carbs_100g, fat_100g FROM ingredients WHERE name LIKE ? OR brand LIKE ? ORDER BY name LIMIT 50`, [like, like]);
    const results = rows.map(r => ({ ...r, source: 'local' }));
    return NextResponse.json(results);
  } catch (e) {
    console.error('Local search error', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
