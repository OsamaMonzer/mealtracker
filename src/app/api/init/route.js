import { openDb } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  const db = await openDb();
  const isPostgres = !!process.env.POSTGRES_URL;
  
  const idType = isPostgres ? 'SERIAL' : 'INTEGER';
  const autoInc = isPostgres ? '' : 'AUTOINCREMENT';

  try {
    if (isPostgres) {
      await db.run(`DROP TABLE IF EXISTS weight_logs`);
      await db.run(`DROP TABLE IF EXISTS daily_logs`);
      await db.run(`DROP TABLE IF EXISTS recipe_ingredients`);
      await db.run(`DROP TABLE IF EXISTS recipes`);
      await db.run(`DROP TABLE IF EXISTS ingredients`);
    }

    await db.run(`
      CREATE TABLE IF NOT EXISTS ingredients (
        id ${idType} PRIMARY KEY ${autoInc},
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        brand TEXT,
        status TEXT NOT NULL,
        calories_100g REAL NOT NULL,
        protein_100g REAL NOT NULL,
        carbs_100g REAL NOT NULL,
        fat_100g REAL NOT NULL,
        price_kg REAL,
        notes TEXT
      )
    `);

    await db.run(`
      CREATE TABLE IF NOT EXISTS recipes (
        id ${idType} PRIMARY KEY ${autoInc},
        name TEXT NOT NULL,
        portions INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.run(`
      CREATE TABLE IF NOT EXISTS recipe_ingredients (
        id ${idType} PRIMARY KEY ${autoInc},
        recipe_id INTEGER,
        ingredient_id INTEGER,
        weight_g REAL NOT NULL
      )
    `);

    await db.run(`
      CREATE TABLE IF NOT EXISTS daily_logs (
        id ${idType} PRIMARY KEY ${autoInc},
        date TEXT NOT NULL,
        meal_type TEXT NOT NULL,
        recipe_id INTEGER NOT NULL,
        portions_eaten REAL NOT NULL
      )
    `);

    await db.run(`
      CREATE TABLE IF NOT EXISTS weight_logs (
        id ${idType} PRIMARY KEY ${autoInc},
        date TEXT NOT NULL,
        weight_kg REAL NOT NULL
      )
    `);

    return NextResponse.json({ success: true, message: 'Database Initialized' });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
