import { NextResponse } from 'next/server';
import { openDb } from '../../../lib/db';
import { createClient } from '../../../utils/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const db = await openDb();

    // Limit to the most recent 15 distinct dates to prevent performance issues
    const datesObj = await db.all('SELECT DISTINCT date FROM daily_logs WHERE user_id = ? ORDER BY date DESC LIMIT 15', [user.id]);
    const dateList = datesObj.map(d => d.date);

    if (dateList.length === 0) return NextResponse.json([]);

    const placeholders = dateList.map(() => '?').join(',');

    // Single query: aggregate all recipe ingredient macros per log for the last 15 days in one round trip
    const logs = await db.all(`
      SELECT
        d.id,
        d.date,
        d.meal_type,
        d.recipe_id,
        d.portions_eaten,
        r.name  AS recipe_name,
        r.portions AS recipe_portions,
        COALESCE(SUM(i.calories_100g * ri.weight_g / 100.0), 0) AS total_recipe_cals,
        COALESCE(SUM(i.protein_100g  * ri.weight_g / 100.0), 0) AS total_recipe_p,
        COALESCE(SUM(i.carbs_100g   * ri.weight_g / 100.0), 0) AS total_recipe_c,
        COALESCE(SUM(i.fat_100g     * ri.weight_g / 100.0), 0) AS total_recipe_f
      FROM daily_logs d
      JOIN recipes r ON d.recipe_id = r.id
      LEFT JOIN recipe_ingredients ri ON ri.recipe_id = r.id
      LEFT JOIN ingredients i ON i.id = ri.ingredient_id
      WHERE d.date IN (${placeholders}) AND d.user_id = ?
      GROUP BY d.id, d.date, d.meal_type, d.recipe_id, d.portions_eaten, r.name, r.portions
      ORDER BY d.date DESC, d.id DESC
    `, [...dateList, user.id]);

    const fullLogs = logs.map(log => {
      const portions = log.recipe_portions || 1;
      const eaten    = log.portions_eaten   || 1;
      return {
        id:           log.id,
        date:         log.date,
        meal_type:    log.meal_type,
        recipe_id:    log.recipe_id,
        portions_eaten: log.portions_eaten,
        recipe_name:  log.recipe_name,
        calories: (log.total_recipe_cals / portions) * eaten,
        protein:  (log.total_recipe_p   / portions) * eaten,
        carbs:    (log.total_recipe_c   / portions) * eaten,
        fat:      (log.total_recipe_f   / portions) * eaten,
      };
    });

    return NextResponse.json(fullLogs);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const data = await request.json();
    let { date, meal_type, recipe_id, portions_eaten, quick_add_name, quick_add_calories, ingredient_id, weight_g } = data;
    
    if (!date) return NextResponse.json({error:'Invalid data'}, {status: 400});

    const db = await openDb();
    
    if (ingredient_id) {
        if (isNaN(weight_g)) return NextResponse.json({error:'Invalid weight'}, {status: 400});
        
        await db.exec('BEGIN TRANSACTION');
        try {
            // Check if single_ingredient recipe already exists for this ingredient
            const existing = await db.get(`
                SELECT r.id 
                FROM recipes r 
                JOIN recipe_ingredients ri ON r.id = ri.recipe_id 
                WHERE r.status = 'single_ingredient' AND ri.ingredient_id = ?
                LIMIT 1
            `, [ingredient_id]);
            
            if (existing) {
                recipe_id = existing.id;
            } else {
                // Fetch ingredient name
                const ing = await db.get("SELECT name FROM ingredients WHERE id = ?", [ingredient_id]);
                if (!ing) throw new Error("Ingredient not found");
                
                // Create single ingredient hidden recipe
                const recResult = await db.run("INSERT INTO recipes (name, portions, status, user_id) VALUES (?, 1, 'single_ingredient', ?)", [ing.name, user.id]);
                recipe_id = recResult.lastID;
                
                // Link ingredient 100g = 1 portion
                await db.run('INSERT INTO recipe_ingredients (recipe_id, ingredient_id, weight_g) VALUES (?, ?, 100)', 
                    [recipe_id, ingredient_id]);
            }
            await db.exec('COMMIT');
            
            // Set portions_eaten based on weight
            portions_eaten = parseFloat(weight_g) / 100.0;
        } catch(err) {
            await db.exec('ROLLBACK');
            throw err;
        }
    } else if (recipe_id === 'QUICK_ADD') {
        if (!quick_add_name || isNaN(quick_add_calories)) return NextResponse.json({error:'Invalid quick add data'}, {status: 400});
        
        await db.exec('BEGIN TRANSACTION');
        try {
            // Use a unique internal key so the same display name can be logged
            // multiple times without hitting any UNIQUE constraint on the name column.
            // The user-visible name is stored on the recipe; the ingredient name is
            // never shown to the user for quick_add entries.
            const uniqueKey = `${quick_add_name}__qa_${Date.now()}`;

            // Create hidden ingredient with unique internal name
            const ingResult = await db.run(`
                INSERT INTO ingredients 
                (name, category, brand, status, calories_100g, protein_100g, carbs_100g, fat_100g, price_kg, notes, serving_label, serving_grams, user_id) 
                VALUES (?, 'Other', '', 'quick_add', ?, 0, 0, 0, null, '', null, null, ?)`,
                [uniqueKey, parseFloat(quick_add_calories), user.id]
            );
            
            // Recipe keeps the user-friendly display name
            const recResult = await db.run("INSERT INTO recipes (name, portions, status, user_id) VALUES (?, 1, 'quick_add', ?)", [quick_add_name, user.id]);
            recipe_id = recResult.lastID;
            
            // Link them
            await db.run('INSERT INTO recipe_ingredients (recipe_id, ingredient_id, weight_g) VALUES (?, ?, 100)', 
                [recipe_id, ingResult.lastID]);
                
            await db.exec('COMMIT');
        } catch(err) {
            await db.exec('ROLLBACK');
            throw err;
        }
    } else if (!recipe_id || isNaN(portions_eaten)) {
        return NextResponse.json({error:'Invalid data'}, {status: 400});
    }

    const res = await db.run('INSERT INTO daily_logs (date, meal_type, recipe_id, portions_eaten, user_id) VALUES (?, ?, ?, ?, ?)', 
        [date, meal_type || 'Snack', recipe_id, parseFloat(portions_eaten), user.id]);
    
    return NextResponse.json({ success: true, id: res.lastID });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
