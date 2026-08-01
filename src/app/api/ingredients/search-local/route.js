import { NextResponse } from 'next/server';
import { createClient } from '../../../../utils/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const q = (searchParams.get('q') || '').trim();
    if (!q) return NextResponse.json([], { status: 200 });

    const { data, error } = await supabase
      .from('ingredients')
      .select('id, name, brand, serving_label, serving_grams, calories_100g, protein_100g, carbs_100g, fat_100g')
      .or(`name.ilike.%${q}%,brand.ilike.%${q}%`)
      .order('name', { ascending: true })
      .limit(50);

    if (error) throw new Error(error.message);

    const results = data.map(r => ({ ...r, source: 'local' }));
    return NextResponse.json(results);
  } catch (e) {
    console.error('Local search error', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
