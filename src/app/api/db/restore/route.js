import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

// Expect JSON: { fileBase64: "..." }
export async function POST(request) {
  try {
    const body = await request.json();
    if (!body || !body.fileBase64) return NextResponse.json({ error: 'Missing fileBase64' }, { status: 400 });
    const buf = Buffer.from(body.fileBase64, 'base64');
    const dbPath = path.resolve(process.cwd(), 'meals.db');
    // write a backup of current DB
    try {
      if (fs.existsSync(dbPath)) {
        const ts = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = path.resolve(process.cwd(), 'backups');
        await fs.promises.mkdir(backupPath, { recursive: true });
        await fs.promises.copyFile(dbPath, path.join(backupPath, `meals-before-restore-${ts}.db`));
      }
    } catch (e) {
      console.warn('Failed to create pre-restore backup', e);
    }

    await fs.promises.writeFile(dbPath, buf);
    // After restoring sqlite DB file, attempt to export ingredients into seedIngredients.json
    try {
      // only attempt for sqlite files (if meals.db is a sqlite file)
      const sqlite3 = await import('sqlite3');
      const { open } = await import('sqlite');
      const db = await open({ filename: dbPath, driver: sqlite3.Database });
      const rows = await db.all('SELECT name, category, brand, status, calories_100g, protein_100g, carbs_100g, fat_100g, price_kg, notes, serving_label, serving_grams FROM ingredients');
      if (Array.isArray(rows)) {
        const dataPath = path.resolve(process.cwd(), 'src', 'data', 'seedIngredients.json');
        const simplified = rows.map(r => ({
          name: r.name,
          category: r.category,
          brand: r.brand || '',
          status: r.status || 'Raw',
          calories_100g: r.calories_100g,
          protein_100g: r.protein_100g,
          carbs_100g: r.carbs_100g,
          fat_100g: r.fat_100g,
          price_kg: r.price_kg,
          notes: r.notes || '',
          serving_label: r.serving_label || null,
          serving_grams: r.serving_grams || null
        }));
        await fs.promises.mkdir(path.dirname(dataPath), { recursive: true });
        await fs.promises.writeFile(dataPath, JSON.stringify(simplified, null, 2), 'utf8');
      }
      try { await db.close(); } catch(e){}
    } catch (e) {
      console.warn('Could not export seed ingredients after restore', e);
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('Restore error', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
