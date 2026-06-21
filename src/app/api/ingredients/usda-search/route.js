import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const CACHE_DIR = path.resolve(process.cwd(), 'src', '.cache', 'usda');
const TTL_MS = (process.env.USDA_CACHE_TTL_HOURS ? Number(process.env.USDA_CACHE_TTL_HOURS) : 24) * 3600 * 1000;

function ensureCacheDir() {
  try { fs.mkdirSync(CACHE_DIR, { recursive: true }); } catch (e) {}
}

function cachePathForQuery(q) {
  const file = Buffer.from(q).toString('base64').replace(/\/+/, '_');
  return path.join(CACHE_DIR, `${file}.json`);
}

function parseServing(serving) {
  if (!serving) return { label: null, grams: null };
  const s = String(serving).trim();
  const gMatch = s.match(/^(\d+(?:\.\d+)?)\s*(g|gr|gram|grams)$/i);
  if (gMatch) return { label: null, grams: parseFloat(gMatch[1]) };
  const qtyMatch = s.match(/^(\d+(?:\.\d+)?)\s*(\w+)\b/i);
  const mapping = { egg: 60, eggs: 60, slice: 30, slices: 30, tbsp: 15, tablespoon: 15, tsp: 5, teaspoon: 5, cup: 240, ml: 1 };
  if (qtyMatch) {
    const qty = parseFloat(qtyMatch[1]);
    const unit = qtyMatch[2].toLowerCase();
    if (mapping[unit]) return { label: s, grams: +(qty * mapping[unit]).toFixed(2) };
  }
  return { label: s, grams: null };
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get('q') || '').trim();
    if (!q) return NextResponse.json([], { status: 200 });

    ensureCacheDir();
    const cp = cachePathForQuery(q);
    try {
      if (fs.existsSync(cp)) {
        const stat = fs.statSync(cp);
        const age = Date.now() - stat.mtimeMs;
        if (age < TTL_MS) {
          const raw = fs.readFileSync(cp, 'utf8');
          return NextResponse.json(JSON.parse(raw));
        }
      }
    } catch (e) { /* ignore cache errors */ }

    const apiKey = process.env.USDA_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'USDA_API_KEY not set' }, { status: 400 });

    const url = 'https://api.nal.usda.gov/fdc/v1/foods/search';
    const res = await fetch(url + `?api_key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: q, pageSize: 25 })
    });

    if (!res.ok) return NextResponse.json({ error: 'USDA API error' }, { status: 502 });
    const data = await res.json();

    const results = (data.foods || []).map(f => {
      // extract nutrients
      const nut = {};
      (f.foodNutrients || []).forEach(n => { if (n.nutrientName && n.unitName) nut[n.nutrientName.toLowerCase()] = n.value; });
      // try to determine per 100g values; USDA may use servingSize and servingSizeUnit
      let calories = nut['energy'] ?? nut['energy (kcal)'] ?? nut['calories'] ?? null;
      let protein = nut['protein'] ?? nut['proteins'] ?? null;
      // if values are per serving, attempt to normalize to per 100g using serving size
      let serving_label = f.servingSize ? `${f.servingSize} ${f.servingSizeUnit || ''}`.trim() : null;
      const parsed = parseServing(serving_label);
      const serving_grams = parsed.grams;

      // if nutrients are per serving and serving_grams present, convert to per 100g
      // USDA doesn't always label per serving vs per 100g; we'll assume values are per 100g when f.labelNutrients absent

      return {
        id: f.fdcId || f.fdcId,
        name: f.description || f.lowercaseDescription || 'Unknown',
        brand: f.brandOwner || '',
        serving_label,
        serving_grams,
        calories_100g: calories,
        protein_100g: protein,
        source: 'usda'
      };
    });

    try { fs.writeFileSync(cp, JSON.stringify(results), 'utf8'); } catch (e) {}
    return NextResponse.json(results);
  } catch (e) {
    console.error('USDA search error', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
