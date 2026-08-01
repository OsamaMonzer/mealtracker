import { NextResponse } from 'next/server';
import { createClient } from '../../../../utils/supabase/server';

export async function DELETE(request, { params }) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { error } = await supabase
      .from('daily_logs')
      .delete()
      .eq('id', params.id)
      .eq('user_id', user.id);

    if (error) throw new Error(error.message);
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

    // Verify ownership
    const { data: log, error: logErr } = await supabase
      .from('daily_logs')
      .select('id, meal_type, recipe_id, recipes ( name )')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single();

    if (logErr || !log) return NextResponse.json({ error: 'Log not found' }, { status: 404 });

    // ── If ingredient list is provided, create a snapshot recipe ────────────
    if (ingredients && Array.isArray(ingredients) && ingredients.length > 0) {
      const baseName = (log.recipes?.name || 'Recipe').replace(/ \[custom\]$/, '');
      
      const { data: newRecipe, error: recErr } = await supabase
        .from('recipes')
        .insert({ name: `${baseName} [custom]`, portions: 1, status: 'log_snapshot', user_id: user.id })
        .select('id').single();
      
      if (recErr) throw new Error(recErr.message);

      const mapping = ingredients.map(ing => ({
        recipe_id: newRecipe.id,
        ingredient_id: ing.ingredient_id,
        weight_g: parseFloat(ing.weight_g)
      }));

      const { error: insErr } = await supabase.from('recipe_ingredients').insert(mapping);
      if (insErr) throw new Error(insErr.message);

      const newPe = portions_eaten !== undefined ? parseFloat(portions_eaten) : 1;
      const newMt = meal_type || log.meal_type;
      
      const { error: updErr } = await supabase
        .from('daily_logs')
        .update({ recipe_id: newRecipe.id, portions_eaten: newPe, meal_type: newMt })
        .eq('id', params.id)
        .eq('user_id', user.id);

      if (updErr) throw new Error(updErr.message);
      return NextResponse.json({ success: true });
    }

    // ── Simple field update (portions / meal_type only) ────────────────────
    const updatePayload = {};
    if (portions_eaten !== undefined) updatePayload.portions_eaten = parseFloat(portions_eaten);
    if (meal_type !== undefined) updatePayload.meal_type = meal_type;
    if (recipe_id !== undefined) updatePayload.recipe_id = recipe_id;
    
    if (Object.keys(updatePayload).length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

    const { error: updErr } = await supabase
      .from('daily_logs')
      .update(updatePayload)
      .eq('id', params.id)
      .eq('user_id', user.id);

    if (updErr) throw new Error(updErr.message);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
