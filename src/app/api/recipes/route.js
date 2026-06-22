import { NextResponse } from 'next/server';
import { openDb } from '../../../lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const db = await openDb();
    const recipes = await db.all("SELECT * FROM recipes WHERE status = 'active' ORDER BY name ASC");
    
    const fullRecipes = [];
    for(const r of recipes) {
        const ingredients = await db.all(`
            SELECT i.*, ri.weight_g 
            FROM recipe_ingredients ri 
            JOIN ingredients i ON ri.ingredient_id = i.id 
            WHERE ri.recipe_id = ?
        `, [r.id]);
        
        let totalCals = 0, totalP = 0, totalC = 0, totalF = 0, totalW = 0;
        
        ingredients.forEach(i => {
           const ratio = i.weight_g / 100;
           totalCals += i.calories_100g * ratio;
           totalP += i.protein_100g * ratio;
           totalC += i.carbs_100g * ratio;
           totalF += i.fat_100g * ratio;
           totalW += i.weight_g;
        });

        fullRecipes.push({
            ...r,
            ingredients,
            totalCals, totalP, totalC, totalF, totalW,
            calsPerPortion: totalCals / r.portions,
            pPerPortion: totalP / r.portions,
            cPerPortion: totalC / r.portions,
            fPerPortion: totalF / r.portions,
        });
    }

    return NextResponse.json(fullRecipes);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { name, portions, ingredients } = await request.json();
    if (!name || !ingredients || ingredients.length === 0) return NextResponse.json({error:'Invalid data'}, {status: 400});

    const db = await openDb();
    
    await db.exec('BEGIN TRANSACTION');
    try {
        const res = await db.run('INSERT INTO recipes (name, portions) VALUES (?, ?)', [name, portions || 1]);
        const recipeId = res.lastID;

        for (const item of ingredients) {
            await db.run('INSERT INTO recipe_ingredients (recipe_id, ingredient_id, weight_g) VALUES (?, ?, ?)', 
                [recipeId, item.ingredient_id, item.weight_g]);
        }
        
        await db.exec('COMMIT');
        return NextResponse.json({ success: true, id: recipeId });
    } catch(err) {
        await db.exec('ROLLBACK');
        throw err;
    }
  } catch (error) {
    console.error("Recipe save error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
