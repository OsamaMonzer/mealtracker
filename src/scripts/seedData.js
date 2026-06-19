const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');

// Real food data from USDA / common nutrition databases (per 100g)
const INGREDIENTS = [
  // ── Proteins ──
  { name: 'Chicken Breast (Raw)', category: 'Protein', brand: '', status: 'Raw', calories_100g: 120, protein_100g: 22.5, carbs_100g: 0, fat_100g: 2.6, price_kg: 12.0, notes: 'Boneless, skinless' },
  { name: 'Chicken Breast (Cooked)', category: 'Protein', brand: '', status: 'Cooked', calories_100g: 165, protein_100g: 31.0, carbs_100g: 0, fat_100g: 3.6, price_kg: null, notes: '' },
  { name: 'Chicken Thigh (Raw)', category: 'Protein', brand: '', status: 'Raw', calories_100g: 177, protein_100g: 18.3, carbs_100g: 0, fat_100g: 11.5, price_kg: 8.0, notes: 'Boneless, skinless' },
  { name: 'Whole Egg', category: 'Protein', brand: '', status: 'Raw', calories_100g: 155, protein_100g: 13.0, carbs_100g: 1.1, fat_100g: 10.6, price_kg: 6.0, notes: '~60g per egg' },
  { name: 'Egg White', category: 'Protein', brand: '', status: 'Raw', calories_100g: 52, protein_100g: 10.9, carbs_100g: 0.7, fat_100g: 0.2, price_kg: null, notes: '' },
  { name: 'Ground Beef 80/20', category: 'Protein', brand: '', status: 'Raw', calories_100g: 254, protein_100g: 17.2, carbs_100g: 0, fat_100g: 20.0, price_kg: 15.0, notes: '80% lean, 20% fat' },
  { name: 'Ground Beef 90/10', category: 'Protein', brand: '', status: 'Raw', calories_100g: 176, protein_100g: 20.4, carbs_100g: 0, fat_100g: 10.0, price_kg: 18.0, notes: '90% lean, 10% fat' },
  { name: 'Salmon Fillet', category: 'Protein', brand: '', status: 'Raw', calories_100g: 208, protein_100g: 20.0, carbs_100g: 0, fat_100g: 13.4, price_kg: 35.0, notes: 'Atlantic salmon' },
  { name: 'Tuna (Canned in Water)', category: 'Protein', brand: '', status: 'Cooked', calories_100g: 116, protein_100g: 25.5, carbs_100g: 0, fat_100g: 1.0, price_kg: 14.0, notes: 'Drained weight' },
  { name: 'Whey Protein Powder', category: 'Protein', brand: '', status: 'Raw', calories_100g: 380, protein_100g: 80.0, carbs_100g: 6.0, fat_100g: 4.0, price_kg: 40.0, notes: 'Avg. standard whey isolate' },
  { name: 'Greek Yogurt (0% Fat)', category: 'Dairy', brand: '', status: 'Raw', calories_100g: 59, protein_100g: 10.0, carbs_100g: 3.6, fat_100g: 0.4, price_kg: 8.0, notes: 'Plain, unsweetened' },
  { name: 'Cottage Cheese', category: 'Dairy', brand: '', status: 'Raw', calories_100g: 98, protein_100g: 11.1, carbs_100g: 3.4, fat_100g: 4.3, price_kg: 9.0, notes: 'Low fat' },
  { name: 'Beef Sirloin', category: 'Protein', brand: '', status: 'Raw', calories_100g: 207, protein_100g: 21.4, carbs_100g: 0, fat_100g: 13.0, price_kg: 25.0, notes: '' },

  // ── Carbs ──
  { name: 'White Rice (Cooked)', category: 'Carb', brand: '', status: 'Cooked', calories_100g: 130, protein_100g: 2.7, carbs_100g: 28.2, fat_100g: 0.3, price_kg: 2.0, notes: '' },
  { name: 'White Rice (Raw)', category: 'Carb', brand: '', status: 'Raw', calories_100g: 365, protein_100g: 7.1, carbs_100g: 80.0, fat_100g: 0.7, price_kg: 2.0, notes: '1g raw ≈ 2.8g cooked' },
  { name: 'Brown Rice (Cooked)', category: 'Carb', brand: '', status: 'Cooked', calories_100g: 110, protein_100g: 2.6, carbs_100g: 23.0, fat_100g: 0.9, price_kg: 3.0, notes: '' },
  { name: 'Oats (Rolled)', category: 'Carb', brand: '', status: 'Raw', calories_100g: 389, protein_100g: 16.9, carbs_100g: 66.3, fat_100g: 6.9, price_kg: 3.0, notes: 'Dry weight' },
  { name: 'Sweet Potato', category: 'Carb', brand: '', status: 'Raw', calories_100g: 86, protein_100g: 1.6, carbs_100g: 20.1, fat_100g: 0.1, price_kg: 4.0, notes: '' },
  { name: 'Regular Pasta (Dry)', category: 'Carb', brand: '', status: 'Raw', calories_100g: 371, protein_100g: 13.0, carbs_100g: 74.7, fat_100g: 1.5, price_kg: 3.0, notes: '' },
  { name: 'Pasta (Cooked)', category: 'Carb', brand: '', status: 'Cooked', calories_100g: 158, protein_100g: 5.8, carbs_100g: 30.9, fat_100g: 0.9, price_kg: null, notes: '' },
  { name: 'Banana', category: 'Fruit', brand: '', status: 'Raw', calories_100g: 89, protein_100g: 1.1, carbs_100g: 22.8, fat_100g: 0.3, price_kg: 2.5, notes: '' },
  { name: 'White Bread', category: 'Carb', brand: '', status: 'Cooked', calories_100g: 265, protein_100g: 9.0, carbs_100g: 49.0, fat_100g: 3.2, price_kg: 4.0, notes: '~30g per slice' },

  // ── Vegetables ──
  { name: 'Broccoli', category: 'Vegetable', brand: '', status: 'Raw', calories_100g: 34, protein_100g: 2.8, carbs_100g: 6.6, fat_100g: 0.4, price_kg: 5.0, notes: '' },
  { name: 'Spinach', category: 'Vegetable', brand: '', status: 'Raw', calories_100g: 23, protein_100g: 2.9, carbs_100g: 3.6, fat_100g: 0.4, price_kg: 8.0, notes: '' },
  { name: 'Tomatoes', category: 'Vegetable', brand: '', status: 'Raw', calories_100g: 18, protein_100g: 0.9, carbs_100g: 3.9, fat_100g: 0.2, price_kg: 4.0, notes: '' },
  { name: 'Cucumber', category: 'Vegetable', brand: '', status: 'Raw', calories_100g: 15, protein_100g: 0.7, carbs_100g: 3.6, fat_100g: 0.1, price_kg: 2.5, notes: '' },
  { name: 'Mixed Salad Greens', category: 'Vegetable', brand: '', status: 'Raw', calories_100g: 20, protein_100g: 1.5, carbs_100g: 3.0, fat_100g: 0.3, price_kg: 10.0, notes: '' },
  { name: 'Bell Pepper (Red)', category: 'Vegetable', brand: '', status: 'Raw', calories_100g: 31, protein_100g: 1.0, carbs_100g: 6.0, fat_100g: 0.3, price_kg: 6.0, notes: '' },
  { name: 'Onion', category: 'Vegetable', brand: '', status: 'Raw', calories_100g: 40, protein_100g: 1.1, carbs_100g: 9.3, fat_100g: 0.1, price_kg: 2.0, notes: '' },

  // ── Fats ──
  { name: 'Olive Oil', category: 'Fat', brand: '', status: 'Raw', calories_100g: 884, protein_100g: 0, carbs_100g: 0, fat_100g: 100.0, price_kg: 20.0, notes: 'Extra virgin' },
  { name: 'Avocado', category: 'Fat', brand: '', status: 'Raw', calories_100g: 160, protein_100g: 2.0, carbs_100g: 8.5, fat_100g: 14.7, price_kg: 15.0, notes: '' },
  { name: 'Almonds', category: 'Fat', brand: '', status: 'Raw', calories_100g: 579, protein_100g: 21.2, carbs_100g: 21.6, fat_100g: 49.9, price_kg: 25.0, notes: '' },
  { name: 'Peanut Butter', category: 'Fat', brand: '', status: 'Raw', calories_100g: 588, protein_100g: 25.1, carbs_100g: 20.1, fat_100g: 50.4, price_kg: 10.0, notes: 'Natural, no added sugar' },

  // ── Dairy ──
  { name: 'Whole Milk', category: 'Dairy', brand: '', status: 'Raw', calories_100g: 61, protein_100g: 3.2, carbs_100g: 4.8, fat_100g: 3.3, price_kg: 2.0, notes: '' },
  { name: 'Cheddar Cheese', category: 'Dairy', brand: '', status: 'Raw', calories_100g: 403, protein_100g: 25.0, carbs_100g: 1.3, fat_100g: 33.1, price_kg: 14.0, notes: '' },
  { name: 'Butter', category: 'Fat', brand: '', status: 'Raw', calories_100g: 717, protein_100g: 0.9, carbs_100g: 0.1, fat_100g: 81.1, price_kg: 12.0, notes: '' },

  // ── Sauces ──
  { name: 'Soy Sauce', category: 'Sauce', brand: '', status: 'Raw', calories_100g: 53, protein_100g: 8.1, carbs_100g: 4.9, fat_100g: 0.1, price_kg: 4.0, notes: '' },
  { name: 'Tomato Sauce (Passata)', category: 'Sauce', brand: '', status: 'Cooked', calories_100g: 27, protein_100g: 1.2, carbs_100g: 4.9, fat_100g: 0.2, price_kg: 3.0, notes: '' },
];

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
      INSERT INTO ingredients (name, category, brand, status, calories_100g, protein_100g, carbs_100g, fat_100g, price_kg, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [item.name, item.category, item.brand, item.status, item.calories_100g, item.protein_100g, item.carbs_100g, item.fat_100g, item.price_kg, item.notes]
    );
    console.log(`  ✓ Added: ${item.name}`);
    added++;
  }

  console.log(`\nDone! ${added} added, ${skipped} already existed.`);
}

seed().catch(err => { console.error('Seed error:', err); process.exit(1); });
