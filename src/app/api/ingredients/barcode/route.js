import { NextResponse } from 'next/server';
import { createClient } from '../../../../utils/supabase/server';
import { normalizeName, parseServing, fetchOffProduct, extractMacros } from '../../../../lib/nutrition';

export const dynamic = 'force-dynamic';

function buildRecord(p, barcode, overrideCategory) {
  const nutr = p.nutriments || {};
  const serv = parseServing(p.serving_size || '');
  const { calories, protein, carbs, fat } = extractMacros(nutr, serv.grams);

  return {
    barcode,
    id:             p.code || p._id || barcode,
    name:           p.product_name || p.generic_name || p.brands || 'Unknown',
    brand:          p.brands || '',
    serving_label:  serv.label || p.serving_size || null,
    serving_grams:  serv.grams || null,
    calories_100g:  calories ?? 0,
    protein_100g:   protein  ?? 0,
    carbs_100g:     carbs    ?? 0,
    fat_100g:       fat      ?? 0,
    category:       (p.categories_tags?.[0])
                      ? p.categories_tags[0].replace(/^en:/, '').replace(/-/g, ' ')
                      : (overrideCategory || 'Other'),
    source: 'openfoodfacts',
  };
}

export async function GET(request) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const barcode = (searchParams.get('barcode') || '').trim();
    if (!barcode) return NextResponse.json({ error: 'barcode required' }, { status: 400 });

    const p = await fetchOffProduct(barcode);
    if (!p) return NextResponse.json({ foundLocal: false, off: null });

    const offNormalized = buildRecord(p, barcode);
    const norm = normalizeName(offNormalized.name);

    // Check local DB for matching name (ignoring quick adds)
    const { data: localRows } = await supabase
      .from('ingredients')
      .select('*')
      .not('status', 'in', '("quick_add","single_ingredient","one_off")')
      .or(`user_id.is.null,user_id.eq.${user.id}`);
      
    const found = (localRows || []).find(r => normalizeName(r.name) === norm);

    return NextResponse.json({ foundLocal: !!found, local: found || null, off: offNormalized });
  } catch (e) {
    console.error('barcode GET error', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const barcode = (body.barcode || '').toString().trim();
    if (!barcode) return NextResponse.json({ error: 'barcode required' }, { status: 400 });

    const create = !!body.create;
    const p = await fetchOffProduct(barcode);
    if (!p) return NextResponse.json({ created: false, message: 'product not found in OpenFoodFacts' });

    const record = buildRecord(p, barcode, body.category);
    const norm = normalizeName(record.name);

    // Check for existing by normalized name to avoid duplicates
    const { data: localRows } = await supabase
      .from('ingredients')
      .select('*')
      .not('status', 'in', '("quick_add","single_ingredient","one_off")')
      .or(`user_id.is.null,user_id.eq.${user.id}`);
      
    const existing = (localRows || []).find(r => normalizeName(r.name) === norm);
    if (existing) return NextResponse.json({ created: false, message: 'already exists', local: existing });

    if (!create) return NextResponse.json({ created: false, preview: record });

    const { data: created, error } = await supabase
      .from('ingredients')
      .insert({
        name: record.name,
        category: record.category,
        brand: record.brand,
        status: 'Raw',
        calories_100g: record.calories_100g,
        protein_100g: record.protein_100g,
        carbs_100g: record.carbs_100g,
        fat_100g: record.fat_100g,
        notes: `Imported from OpenFoodFacts barcode ${barcode}`,
        serving_label: record.serving_label,
        serving_grams: record.serving_grams,
        user_id: user.id
      })
      .select().single();
      
    if (error) throw new Error(error.message);

    return NextResponse.json({ created: true, ingredient: created });
  } catch (e) {
    console.error('barcode POST error', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
