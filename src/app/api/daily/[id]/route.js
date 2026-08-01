import { NextResponse } from 'next/server';
import { openDb } from '../../../../lib/db';
import { createClient } from '../../../../utils/supabase/server';

export async function DELETE(request, { params }) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const db = await openDb();
    
    // Verify ownership
    const existing = await db.get('SELECT id FROM daily_logs WHERE id = ? AND user_id = ?', [params.id, user.id]);
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await db.run('DELETE FROM daily_logs WHERE id = ? AND user_id = ?', [params.id, user.id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { portions_eaten, meal_type, ingredients, recipe_id } = body;
    const db = await openDb();

    // Verify ownership
    const existing = await db.get('SELECT id FROM daily_logs WHERE id = ? AND user_id = ?', [params.id, user.id]);
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // ── If ingredient list is provided, create a snapshot recipe ────────────
    if (ingredients && Array.isArray(ingredients) && ingredients.length > 0) {
      // Fetch the current log to get original recipe name
      const log = await db.get('SELECT dl.*, r.name as recipe_name FROM daily_logs dl JOIN recipes r ON dl.recipe_id = r.id WHERE dl.id = ?', [params.id]);
      if (!log) return NextResponse.json({ error: 'Log not found' }, { status: 404 });

      // Create a hidden snapshot recipe (portions=1, status='log_snapshot')
      const baseName = log.recipe_name.replace(/ \[custom\]$/, '');
      const recResult = await db.run(
        "INSERT INTO recipes (name, portions, status, user_id) VALUES (?, 1, 'log_snapshot', ?)",
        [`${baseName} [custom]`, user.id]
      );
      const newRecipeId = recResult.lastID;

      // Insert each ingredient into the snapshot recipe
      for (const ing of ingredients) {
        await db.run(
          'INSERT INTO recipe_ingredients (recipe_id, ingredient_id, weight_g) VALUES (?, ?, ?)',
          [newRecipeId, ing.ingredient_id, parseFloat(ing.weight_g)]
        );
      }

      // Update the log to point to the new snapshot recipe, portions_eaten=1 (1:1 mapping)
      const newPe = portions_eaten !== undefined ? parseFloat(portions_eaten) : 1;
      const newMt = meal_type || log.meal_type;
      await db.run(
        'UPDATE daily_logs SET recipe_id = ?, portions_eaten = ?, meal_type = ? WHERE id = ?',
        [newRecipeId, newPe, newMt, params.id]
      );

      return NextResponse.json({ success: true });
    }

    // ── Simple field update (portions / meal_type only) ────────────────────
    const fields = [];
    const values = [];
    if (portions_eaten !== undefined) { fields.push('portions_eaten = ?'); values.push(parseFloat(portions_eaten)); }
    if (meal_type     !== undefined) { fields.push('meal_type = ?');      values.push(meal_type); }
    if (recipe_id     !== undefined) { fields.push('recipe_id = ?');      values.push(recipe_id); }
    if (fields.length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

    values.push(params.id);
    values.push(user.id);
    await db.run(`UPDATE daily_logs SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`, values);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
