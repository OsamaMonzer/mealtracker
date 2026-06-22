import { NextResponse } from 'next/server';
import { openDb } from '../../../lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    if (!date) return NextResponse.json({ error: 'date required' }, { status: 400 });

    const db = await openDb();

    const logs = await db.all(`
      SELECT d.id, d.date, d.meal_type, d.recipe_id, d.portions_eaten,
             r.name as recipe_name, r.portions as recipe_portions
      FROM daily_logs d
      JOIN recipes r ON d.recipe_id = r.id
      WHERE d.date = ?
      ORDER BY d.id ASC
    `, [date]);

    const fullLogs = [];
    for (const log of logs) {
      const ingredients = await db.all(`
        SELECT i.name as ing_name, i.calories_100g, i.protein_100g, i.carbs_100g, i.fat_100g, ri.weight_g
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

      const rp = log.recipe_portions;
      const pe = log.portions_eaten;

      fullLogs.push({
        ...log,
        calories: Math.round((totalCals / rp) * pe),
        protein: Math.round((totalP / rp) * pe * 10) / 10,
        carbs: Math.round((totalC / rp) * pe * 10) / 10,
        fat: Math.round((totalF / rp) * pe * 10) / 10,
        ingredients,
      });
    }

    // Daily totals
    const totals = fullLogs.reduce(
      (acc, l) => ({ cals: acc.cals + l.calories, p: acc.p + l.protein, c: acc.c + l.carbs, f: acc.f + l.fat }),
      { cals: 0, p: 0, c: 0, f: 0 }
    );

    return NextResponse.json({ date, logs: fullLogs, totals });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
