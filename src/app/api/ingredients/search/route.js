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
    // helper to parse serving into grams when possible
    function parseServing(s) {
      if (!s) return { label: null, grams: null };
      const str = String(s).trim();
      const gMatch = str.match(/^(\d+(?:\.\d+)?)\s*(g|gr|gram|grams)$/i);
      if (gMatch) return { label: null, grams: parseFloat(gMatch[1]) };
      const qtyMatch = str.match(/^(\d+(?:\.\d+)?)\s*(\w+)\b/i);
      const mapping = { egg: 60, eggs: 60, slice: 30, slices: 30, tbsp: 15, tablespoon: 15, tsp: 5, teaspoon: 5, cup: 240, ml: 1 };
      if (qtyMatch) {
        const qty = parseFloat(qtyMatch[1]);
        const unit = qtyMatch[2].toLowerCase();
        if (mapping[unit]) return { label: str, grams: +(qty * mapping[unit]).toFixed(2) };
      }
      return { label: str, grams: null };
    }

    const results = (data.products || []).map(p => {
      const nutr = p.nutriments || {};
      const serv = parseServing(p.serving_size || '');
      return {
        id: p.id || p.code || p._id || `${p.code || p._id}`,
        name: p.product_name || p.generic_name || p.brands || 'Unknown',
        brand: p.brands || '',
        serving_label: serv.label || p.serving_size || null,
        serving_grams: serv.grams,
        calories_100g: nutr['energy-kcal_100g'] ?? nutr['energy_100g'] ?? null,
        protein_100g: nutr['proteins_100g'] ?? nutr['protein_100g'] ?? null,
        carbs_100g: nutr['carbohydrates_100g'] ?? nutr['carbohydrates_100g'] ?? null,
        fat_100g: nutr['fat_100g'] ?? null,
        category: (p.categories_tags && p.categories_tags[0]) ? p.categories_tags[0].replace('en:', '').replace('-', ' ') : 'Other',
        source: 'openfoodfacts'
      };
    });

    return NextResponse.json(results);
  } catch (e) {
    console.error('Search proxy error', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
