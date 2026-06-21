const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');

const fs = require('fs');
const dataPath = path.resolve(process.cwd(), 'src', 'data', 'seedIngredients.json');
let INGREDIENTS = null;
try {
  if (fs.existsSync(dataPath)) {
    INGREDIENTS = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    console.log('Loaded seed ingredients from', dataPath);
  }
} catch (e) {
  console.error('Failed to load seedIngredients.json, will fall back to built-in list.', e);
}

if (!INGREDIENTS) {
  // Fallback built-in list (small set)
  INGREDIENTS = [
    { name: 'Chicken Breast (Raw)', category: 'Protein', brand: '', status: 'Raw', calories_100g: 120, protein_100g: 22.5, carbs_100g: 0, fat_100g: 2.6, price_kg: 12.0, notes: 'Boneless, skinless' },
    { name: 'Whole Egg', category: 'Protein', brand: '', status: 'Raw', calories_100g: 155, protein_100g: 13.0, carbs_100g: 1.1, fat_100g: 10.6, price_kg: 6.0, notes: '~60g per egg', serving_label: '1 egg' },
    { name: 'White Rice (Cooked)', category: 'Carb', brand: '', status: 'Cooked', calories_100g: 130, protein_100g: 2.7, carbs_100g: 28.2, fat_100g: 0.3, price_kg: 2.0, notes: '' },
    { name: 'Broccoli', category: 'Vegetable', brand: '', status: 'Raw', calories_100g: 34, protein_100g: 2.8, carbs_100g: 6.6, fat_100g: 0.4, price_kg: 5.0, notes: '' }
  ];
}

async function seed() {
  const dbPath = path.resolve(process.cwd(), 'meals.db');
  console.log(`Seeding database at ${dbPath}...`);
  
  const db = await open({ filename: dbPath, driver: sqlite3.Database });

  let added = 0;
  let skipped = 0;

  for (const item of INGREDIENTS) {
    const exists = await db.get('SELECT id FROM ingredients WHERE name = ?', [item.name]);
    if (exists) {
      console.log(`  ↳ Skipping (already exists): ${item.name}`);
      skipped++;
      continue;
    }
    await db.run(`
      INSERT INTO ingredients (name, category, brand, status, calories_100g, protein_100g, carbs_100g, fat_100g, price_kg, notes, serving_label, serving_grams)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [item.name, item.category, item.brand, item.status, item.calories_100g, item.protein_100g, item.carbs_100g, item.fat_100g, item.price_kg, item.notes, item.serving_label || null, item.serving_grams || null]
    );
    console.log(`  ✓ Added: ${item.name}`);
    added++;
  }

  console.log(`\nDone! ${added} added, ${skipped} already existed.`);
}

seed().catch(err => { console.error('Seed error:', err); process.exit(1); });
