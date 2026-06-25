import { NextResponse } from 'next/server';
import { openDb } from '../../../lib/db';

export const dynamic = 'force-dynamic';

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
                const recResult = await db.run("INSERT INTO recipes (name, portions, status) VALUES (?, 1, 'single_ingredient')", [ing.name]);
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
                (name, category, brand, status, calories_100g, protein_100g, carbs_100g, fat_100g, price_kg, notes, serving_label, serving_grams) 
                VALUES (?, 'Other', '', 'quick_add', ?, 0, 0, 0, null, '', null, null)`,
                [uniqueKey, parseFloat(quick_add_calories)]
            );
            
            // Recipe keeps the user-friendly display name
            const recResult = await db.run("INSERT INTO recipes (name, portions, status) VALUES (?, 1, 'quick_add')", [quick_add_name]);
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

    const res = await db.run('INSERT INTO daily_logs (date, meal_type, recipe_id, portions_eaten) VALUES (?, ?, ?, ?)', 
        [date, meal_type || 'Snack', recipe_id, parseFloat(portions_eaten)]);
    
    return NextResponse.json({ success: true, id: res.lastID });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
