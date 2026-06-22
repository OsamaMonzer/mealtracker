import { NextResponse } from 'next/server';
import { openDb } from '../../../../lib/db';

export async function PUT(request, { params }) {
  try {
    const { id } = params;
    const { name, portions, ingredients } = await request.json();
    if (!name || !ingredients || ingredients.length === 0) return NextResponse.json({error:'Invalid data'}, {status: 400});

    const db = await openDb();
    
    await db.exec('BEGIN TRANSACTION');
    try {
        // Mark old recipe as archived
        await db.run("UPDATE recipes SET status = 'archived' WHERE id = ?", [id]);

        // Insert new recipe version
        const res = await db.run("INSERT INTO recipes (name, portions, status) VALUES (?, ?, 'active')", [name, portions || 1]);
        const newRecipeId = res.lastID;

        // Insert new ingredients
        for (const item of ingredients) {
            await db.run('INSERT INTO recipe_ingredients (recipe_id, ingredient_id, weight_g) VALUES (?, ?, ?)', 
                [newRecipeId, item.ingredient_id, item.weight_g]);
        }
        
        await db.exec('COMMIT');
        return NextResponse.json({ success: true, id: newRecipeId });
    } catch(err) {
        await db.exec('ROLLBACK');
        throw err;
    }
  } catch (error) {
    console.error("Recipe update error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const db = await openDb();
    // Soft delete to protect existing daily_logs
    await db.run("UPDATE recipes SET status = 'archived' WHERE id = ?", [params.id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
