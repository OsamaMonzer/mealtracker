import { NextResponse } from 'next/server';
import { createClient } from '../../../utils/supabase/server';

export const dynamic = 'force-dynamic';

function numberOrZero(value) {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function optionalNumber(value) {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function GET() {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data, error } = await supabase
      .from('ingredients')
      .select('*')
      .not('status', 'eq', 'quick_add')
      .or(`user_id.is.null,user_id.eq.${user.id}`)
      .order('name', { ascending: true });

    if (error) throw new Error(error.message);
    
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
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

export async function POST(request) {
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

    const parsedServing = parseServing(serving_g);
    const servingLabel = parsedServing.label;
    const servingGrams = parsedServing.grams;

    const { data: result, error } = await supabase
      .from('ingredients')
      .insert({
        name,
        category: category || '',
        brand: brand || '',
        status: status || '',
        calories_100g: calories,
        protein_100g: protein,
        carbs_100g: numberOrZero(carbs_100g),
        fat_100g: numberOrZero(fat_100g),
        price_kg: optionalNumber(price_kg),
        notes: notes || '',
        serving_label: servingLabel,
        serving_grams: servingGrams,
        user_id: user.id
      })
      .select('id').single();
      
    if (error) throw new Error(error.message);
    
    return NextResponse.json({ id: result.id, ...data, serving_label: servingLabel, serving_grams: servingGrams }, { status: 201 });
  } catch (error) {
    console.error("Error inserting ingredient:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
