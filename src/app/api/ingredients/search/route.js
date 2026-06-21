import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Simple proxy to Open Food Facts search. No API key required.
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') || '';
    if (!q) return NextResponse.json([], { status: 200 });

    const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=20`;
    const res = await fetch(url);
    if (!res.ok) return NextResponse.json({ error: 'External API error' }, { status: 502 });
    const data = await res.json();

    const results = (data.products || []).map(p => {
      const nutr = p.nutriments || {};
      return {
        id: p.id || p.code || p._id || `${p.code || p._id}`,
        name: p.product_name || p.generic_name || p.brands || 'Unknown',
        brand: p.brands || '',
        serving_label: p.serving_size || '',
        calories_100g: nutr['energy-kcal_100g'] ?? nutr['energy_100g'] ?? null,
        protein_100g: nutr['proteins_100g'] ?? nutr['protein_100g'] ?? null,
        carbs_100g: nutr['carbohydrates_100g'] ?? nutr['carbohydrates_100g'] ?? null,
        fat_100g: nutr['fat_100g'] ?? null,
        category: (p.categories_tags && p.categories_tags[0]) ? p.categories_tags[0].replace('en:', '').replace('-', ' ') : 'Other'
      };
    });

    return NextResponse.json(results);
  } catch (e) {
    console.error('Search proxy error', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
