import { NextResponse } from 'next/server';
import { createClient } from '../../../../utils/supabase/server';
import { numberOrZero, optionalNumber, parseServing } from '../../../../lib/nutrition';

export async function PUT(request, { params }) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const data = await request.json();
    const { name, category, brand, status, calories_100g, protein_100g, carbs_100g, fat_100g, price_kg, notes, serving_g } = data;
    const calories = parseFloat(calories_100g);
    const protein = parseFloat(protein_100g);
    
    if (!name || !Number.isFinite(calories) || !Number.isFinite(protein)) {
      return NextResponse.json({ error: 'Missing required numeric fields or name' }, { status: 400 });
    }

    const parsed = parseServing(serving_g);

    // Ensure they own it before updating
    const { data: existing, error: errEx } = await supabase
      .from('ingredients')
      .select('id')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single();

    if (errEx || !existing) return NextResponse.json({ error: 'Not found or not yours' }, { status: 404 });

    const { error: updErr } = await supabase
      .from('ingredients')
      .update({
        name, category, brand, status,
        calories_100g: calories,
        protein_100g: protein,
        carbs_100g: numberOrZero(carbs_100g),
        fat_100g: numberOrZero(fat_100g),
        price_kg: optionalNumber(price_kg),
        notes,
        serving_label: parsed.label,
        serving_grams: parsed.grams
      })
      .eq('id', params.id)
      .eq('user_id', user.id);

    if (updErr) throw new Error(updErr.message);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Only allow deleting own ingredients
    const { data: existing, error: errEx } = await supabase
      .from('ingredients')
      .select('id')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single();

    if (errEx || !existing) return NextResponse.json({ error: 'Not found or not yours' }, { status: 404 });

    const { error: delErr } = await supabase
      .from('ingredients')
      .delete()
      .eq('id', params.id)
      .eq('user_id', user.id);

    if (delErr) throw new Error(delErr.message);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
