import { NextResponse } from 'next/server';
import { openDb } from '../../../lib/db';
import { createClient } from '../../../utils/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const db = await openDb();

    // Check if slim mode requested (just id/name/portions for dropdowns)
    const { searchParams } = new URL(request.url);
    const slim = searchParams.get('slim') === '1';

    const recipes = await db.all(
      slim
        ? "SELECT id, name, portions FROM recipes WHERE status = 'active' AND user_id = ? ORDER BY name ASC"
        : "SELECT * FROM recipes WHERE status = 'active' AND user_id = ? ORDER BY name ASC",
      [user.id]
    );

    if (slim) return NextResponse.json(recipes);

    // Fetch ALL recipe ingredients in one query (no N+1)
    const allIngredients = await db.all(`
      SELECT ri.recipe_id, i.name, i.calories_100g, i.protein_100g, i.carbs_100g, i.fat_100g, i.price_kg, ri.weight_g
      FROM recipe_ingredients ri
      JOIN ingredients i ON ri.ingredient_id = i.id
    `);

    // Group ingredients by recipe_id
    const ingByRecipe = {};
    for (const ing of allIngredients) {
      if (!ingByRecipe[ing.recipe_id]) ingByRecipe[ing.recipe_id] = [];
      ingByRecipe[ing.recipe_id].push(ing);
    }

    const fullRecipes = recipes.map(r => {
      const ingredients = ingByRecipe[r.id] || [];
      let totalCals = 0, totalP = 0, totalC = 0, totalF = 0, totalW = 0;
      ingredients.forEach(i => {
        const ratio = i.weight_g / 100;
        totalCals += i.calories_100g * ratio;
        totalP    += i.protein_100g  * ratio;
        totalC    += i.carbs_100g    * ratio;
        totalF    += i.fat_100g      * ratio;
        totalW    += i.weight_g;
      });
      return {
        ...r,
        ingredients,
        totalCals, totalP, totalC, totalF, totalW,
        calsPerPortion: totalCals / r.portions,
        pPerPortion:    totalP    / r.portions,
        cPerPortion:    totalC    / r.portions,
        fPerPortion:    totalF    / r.portions,
      };
    });

    return NextResponse.json(fullRecipes);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { name, portions, ingredients } = await request.json();
    if (!name || !ingredients || ingredients.length === 0) return NextResponse.json({error:'Invalid data'}, {status: 400});

    const db = await openDb();
    
    await db.exec('BEGIN TRANSACTION');
    try {
        const res = await db.run('INSERT INTO recipes (name, portions, user_id) VALUES (?, ?, ?)', [name, portions || 1, user.id]);
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
