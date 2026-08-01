import { NextResponse } from 'next/server';
import { createClient } from '../../../../utils/supabase/server';

export async function PUT(request, { params }) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = params;
    const { name, portions, ingredients } = await request.json();
    if (!name || !ingredients || ingredients.length === 0) return NextResponse.json({error:'Invalid data'}, {status: 400});

    // Verify ownership
    const { data: existing, error: errEx } = await supabase
      .from('recipes')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();
      
    if (errEx || !existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Mark old recipe as archived
    const { error: updErr } = await supabase
      .from('recipes')
      .update({ status: 'archived' })
      .eq('id', id)
      .eq('user_id', user.id);
      
    if (updErr) throw new Error(updErr.message);

    // Insert new recipe version
    const { data: newRec, error: insErr } = await supabase
      .from('recipes')
      .insert({ name, portions: portions || 1, status: 'active', user_id: user.id })
      .select('id').single();
      
    if (insErr) throw new Error(insErr.message);

    // Insert new ingredients
    const mapping = ingredients.map(item => ({
      recipe_id: newRec.id,
      ingredient_id: item.ingredient_id,
      weight_g: parseFloat(item.weight_g)
    }));

    if (mapping.length > 0) {
      const { error: mapErr } = await supabase.from('recipe_ingredients').insert(mapping);
      if (mapErr) throw new Error(mapErr.message);
    }
    
    return NextResponse.json({ success: true, id: newRec.id });
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

    // Verify ownership
    const { data: existing, error: errEx } = await supabase
      .from('recipes')
      .select('id')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single();
      
    if (errEx || !existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Soft delete to protect existing daily_logs
    const { error: updErr } = await supabase
      .from('recipes')
      .update({ status: 'archived' })
      .eq('id', params.id)
      .eq('user_id', user.id);
      
    if (updErr) throw new Error(updErr.message);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
