import { NextResponse } from 'next/server';
import { openDb } from '../../../../lib/db';

export const dynamic = 'force-dynamic';

function today() {
  return new Date().toISOString().split('T')[0];
}

function normName(n) {
  return (n || '').toString().trim().toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ');
}

async function computeMacros(db, recipeId, recipePortions, portionsEaten) {
  const ings = await db.all(`
    SELECT i.calories_100g, i.protein_100g, i.carbs_100g, i.fat_100g, ri.weight_g
    FROM recipe_ingredients ri JOIN ingredients i ON ri.ingredient_id = i.id
    WHERE ri.recipe_id = ?`, [recipeId]);
  let c = 0, p = 0, cb = 0, f = 0;
  ings.forEach(i => { const r = i.weight_g / 100; c += i.calories_100g * r; p += i.protein_100g * r; cb += i.carbs_100g * r; f += i.fat_100g * r; });
  const pp = portionsEaten / recipePortions;
  return { calories: Math.round(c * pp), protein: Math.round(p * pp * 10) / 10, carbs: Math.round(cb * pp * 10) / 10, fat: Math.round(f * pp * 10) / 10 };
}

export async function POST(request) {
  try {
    const { foods, meal_type, date } = await request.json();
    if (!foods || !foods.length) return NextResponse.json({ error: 'No foods provided' }, { status: 400 });

    const db = await openDb();
    const logged = [];
    let totalCals = 0, totalP = 0, totalC = 0, totalF = 0;

    for (const food of foods) {
      const { name, weight_g, calories_100g, protein_100g, carbs_100g, fat_100g } = food;

      // Search DB first
      const q = name.trim().toLowerCase();
      const matches = await db.all(
        `SELECT id, name, calories_100g, protein_100g, carbs_100g, fat_100g
         FROM ingredients
         WHERE status NOT IN ('quick_add','single_ingredient','one_off')
           AND LOWER(name) LIKE ?`,
        [`%${q}%`]
      );

      let ingredient;
      if (matches.length > 0) {
        ingredient = matches.find(m => normName(m.name) === normName(name)) || matches[0];
      } else {
        // Add new ingredient
        const res = await db.run(
          `INSERT INTO ingredients (name, category, brand, status, calories_100g, protein_100g, carbs_100g, fat_100g, price_kg, notes)
           VALUES (?, 'Other', '', 'Raw', ?, ?, ?, ?, null, 'Added via Meal Scan')`,
          [name.trim(), parseFloat(calories_100g) || 0, parseFloat(protein_100g) || 0, parseFloat(carbs_100g) || 0, parseFloat(fat_100g) || 0]
        );
        ingredient = await db.get('SELECT * FROM ingredients WHERE id = ?', [res.lastID]);
      }

      // Find or create single_ingredient recipe
      const existing = await db.get(
        `SELECT r.id FROM recipes r JOIN recipe_ingredients ri ON r.id = ri.recipe_id
         WHERE r.status = 'single_ingredient' AND ri.ingredient_id = ? LIMIT 1`,
        [ingredient.id]
      );
      let recipe_id;
      if (existing) {
        recipe_id = existing.id;
      } else {
        const rr = await db.run("INSERT INTO recipes (name, portions, status) VALUES (?, 1, 'single_ingredient')", [ingredient.name]);
        recipe_id = rr.lastID;
        await db.run('INSERT INTO recipe_ingredients (recipe_id, ingredient_id, weight_g) VALUES (?, ?, 100)', [recipe_id, ingredient.id]);
      }

      const portions_eaten = parseFloat(weight_g) / 100.0;
      await db.run(
        'INSERT INTO daily_logs (date, meal_type, recipe_id, portions_eaten) VALUES (?, ?, ?, ?)',
        [date || today(), meal_type || 'Snack', recipe_id, portions_eaten]
      );
      const macros = await computeMacros(db, recipe_id, 1, portions_eaten);
      logged.push({ name: ingredient.name, weight_g: parseFloat(weight_g), ...macros });
      totalCals += macros.calories;
      totalP += macros.protein;
      totalC += macros.carbs;
      totalF += macros.fat;
    }

    return NextResponse.json({
      success: true,
      logged,
      total: {
        calories: Math.round(totalCals),
        protein: Math.round(totalP * 10) / 10,
        carbs: Math.round(totalC * 10) / 10,
        fat: Math.round(totalF * 10) / 10,
      }
    });
  } catch (e) {
    console.error('Meal scan log error', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
