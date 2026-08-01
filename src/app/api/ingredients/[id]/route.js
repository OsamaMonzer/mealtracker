import { NextResponse } from 'next/server';
import { createClient } from '../../../../utils/supabase/server';

function numberOrZero(value) {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function optionalNumber(value) {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseServing(serving) {
  if (serving == null) return { label: null, grams: null };
  const s = String(serving).trim();
  if (!s) return { label: null, grams: null };
  const gMatch = s.match(/^(\d+(?:\.\d+)?)\s*(g|gr|gram|grams)?$/i);
  if (gMatch) return { label: null, grams: parseFloat(gMatch[1]) };
  const qtyMatch = s.match(/^(\d+(?:\.\d+)?)\s*(\w+)\b/i);
  const mapping = { egg: 60, eggs: 60, slice: 30, slices: 30, tbsp: 15, tablespoon: 15, tsp: 5, teaspoon: 5, cup: 240 };
  if (qtyMatch) {
    const qty = parseFloat(qtyMatch[1]);
    const unit = qtyMatch[2].toLowerCase();
    if (mapping[unit]) return { label: s, grams: +(qty * mapping[unit]).toFixed(2) };
  }
  return { label: s, grams: null };
}

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
      .eq('id', params.id);

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
      .eq('id', params.id);

    if (delErr) throw new Error(delErr.message);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
