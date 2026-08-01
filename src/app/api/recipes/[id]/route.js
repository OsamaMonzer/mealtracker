import { NextResponse } from 'next/server';
import { openDb } from '../../../../lib/db';
import { createClient } from '../../../../utils/supabase/server';

export async function PUT(request, { params }) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = params;
    const { name, portions, ingredients } = await request.json();
    if (!name || !ingredients || ingredients.length === 0) return NextResponse.json({error:'Invalid data'}, {status: 400});

    const db = await openDb();
    
    // Verify ownership
    const existing = await db.get('SELECT id FROM recipes WHERE id = ? AND user_id = ?', [id, user.id]);
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await db.exec('BEGIN TRANSACTION');
    try {
        // Mark old recipe as archived
        await db.run("UPDATE recipes SET status = 'archived' WHERE id = ? AND user_id = ?", [id, user.id]);

        // Insert new recipe version
        const res = await db.run("INSERT INTO recipes (name, portions, status, user_id) VALUES (?, ?, 'active', ?)", [name, portions || 1, user.id]);
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
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const db = await openDb();

    // Verify ownership
    const existing = await db.get('SELECT id FROM recipes WHERE id = ? AND user_id = ?', [params.id, user.id]);
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Soft delete to protect existing daily_logs
    await db.run("UPDATE recipes SET status = 'archived' WHERE id = ? AND user_id = ?", [params.id, user.id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
