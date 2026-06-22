#!/usr/bin/env node
// Simple backup importer: reads backups/mealtracker-backup.json and inserts into Postgres
// Usage: set POSTGRES_URL=postgres://... && node scripts/importBackupToPg.js

const fs = require('fs');
const { Client } = require('pg');

async function main() {
  const url = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!url) {
    console.error('Please set POSTGRES_URL (to your Supabase/Postgres connection string)');
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync('backups/mealtracker-backup.json', 'utf8'));
  const client = new Client({ connectionString: url });
  await client.connect();

  try {
    // Ensure tables exist (simple versions, safe to run)
    await client.query(`CREATE TABLE IF NOT EXISTS ingredients (
      id SERIAL PRIMARY KEY, name TEXT NOT NULL UNIQUE, category TEXT NOT NULL,
      brand TEXT, status TEXT NOT NULL, calories_100g REAL NOT NULL,
      protein_100g REAL NOT NULL, carbs_100g REAL NOT NULL, fat_100g REAL NOT NULL,
      price_kg REAL, notes TEXT, serving_label TEXT, serving_grams REAL
    )`);

    // Insert ingredients (idempotent by name)
    for (const ing of data.ingredients || []) {
      // upsert by name
      await client.query(`INSERT INTO ingredients (name, category, brand, status, calories_100g, protein_100g, carbs_100g, fat_100g, price_kg, notes, serving_label, serving_grams)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
        ON CONFLICT (name) DO UPDATE SET
          category = EXCLUDED.category,
          brand = EXCLUDED.brand,
          status = EXCLUDED.status,
          calories_100g = EXCLUDED.calories_100g,
          protein_100g = EXCLUDED.protein_100g,
          carbs_100g = EXCLUDED.carbs_100g,
          fat_100g = EXCLUDED.fat_100g,
          price_kg = EXCLUDED.price_kg,
          notes = EXCLUDED.notes,
          serving_label = EXCLUDED.serving_label,
          serving_grams = EXCLUDED.serving_grams`,
        [ing.name, ing.category, ing.brand, ing.status, ing.calories_100g, ing.protein_100g, ing.carbs_100g, ing.fat_100g, ing.price_kg, ing.notes, ing.serving_label, ing.serving_grams]
      );
    }

    console.log('Imported', (data.ingredients || []).length, 'ingredients');
  } finally {
    await client.end();
  }
}

main().catch(err => { console.error(err); process.exit(1); });
