import { NextResponse } from 'next/server';
import { openDb } from '../../../lib/db';

export async function GET() {
  try {
    const db = await openDb();
    
    const logs = await db.all(`
      SELECT d.id, d.date, d.meal_type, d.recipe_id, d.portions_eaten, r.name as recipe_name, r.portions as recipe_portions
      FROM daily_logs d
      JOIN recipes r ON d.recipe_id = r.id
      ORDER BY d.date DESC, d.id DESC
    `);
    
    // Calculate macros for each log based on the recipe
    const fullLogs = [];
    for(const log of logs) {
        const ingredients = await db.all(`
            SELECT i.calories_100g, i.protein_100g, i.carbs_100g, i.fat_100g, ri.weight_g
            FROM recipe_ingredients ri
            JOIN ingredients i ON ri.ingredient_id = i.id
            WHERE ri.recipe_id = ?
        `, [log.recipe_id]);

        let totalCals = 0, totalP = 0, totalC = 0, totalF = 0;
        ingredients.forEach(i => {
           const ratio = i.weight_g / 100;
           totalCals += i.calories_100g * ratio;
           totalP += i.protein_100g * ratio;
           totalC += i.carbs_100g * ratio;
           totalF += i.fat_100g * ratio;
        });

        // Macros per portion
        const cpp = totalCals / log.recipe_portions;
        const ppp = totalP / log.recipe_portions;
        const ccpp = totalC / log.recipe_portions;
        const fpp = totalF / log.recipe_portions;

        fullLogs.push({
            ...log,
            calories: cpp * log.portions_eaten,
            protein: ppp * log.portions_eaten,
            carbs: ccpp * log.portions_eaten,
            fat: fpp * log.portions_eaten,
        });
    }

    return NextResponse.json(fullLogs);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { date, meal_type, recipe_id, portions_eaten } = await request.json();
    if (!date || !recipe_id || isNaN(portions_eaten)) return NextResponse.json({error:'Invalid data'}, {status: 400});

    const db = await openDb();
    const res = await db.run('INSERT INTO daily_logs (date, meal_type, recipe_id, portions_eaten) VALUES (?, ?, ?, ?)', 
        [date, meal_type || 'Snack', recipe_id, parseFloat(portions_eaten)]);
    
    return NextResponse.json({ success: true, id: res.lastID });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
