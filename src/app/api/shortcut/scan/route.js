import { NextResponse } from 'next/server';
import { createClient } from '../../../../utils/supabase/server';
import { fetchOffProduct, ingredientFromOff, normalizeName } from '../../../../lib/nutrition';

export const dynamic = 'force-dynamic';

// ── Shortcut-friendly barcode scan + auto-save endpoint ──────────────────────
// Called by the iPhone Shortcut with:
//   POST /api/shortcut/scan
//   Header: x-api-key: <MEALTRACKER_API_KEY>
//   Body: { "barcode": "1234567890123" }
//
// Every response includes a top-level "message" to show in the Shortcut:
//   status: "added"     → found on OpenFoodFacts and saved to your DB
//   status: "exists"    → already in your DB, nothing changed
//   status: "not_found" → barcode not recognised by OpenFoodFacts
//   status: "error"     → something went wrong (see "message")

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const barcode = (body.barcode || '').toString().trim();
    if (!barcode) {
      return NextResponse.json({ status: 'error', message: '❌ No barcode provided.' }, { status: 400 });
    }

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ status: 'error', message: '❌ Unauthorized.' }, { status: 401 });

    const product = await fetchOffProduct(barcode);
    if (!product) {
      return NextResponse.json({ status: 'not_found', message: `❌ Barcode ${barcode} not found on OpenFoodFacts.`, barcode });
    }

    const record = ingredientFromOff(product, { barcode, userId: user.id, source: 'Shortcut' });
    const summary = (r) => `${r.calories_100g} kcal · P ${r.protein_100g}g · C ${r.carbs_100g}g · F ${r.fat_100g}g (per 100g)`;

    const { data: localRows, error: listErr } = await supabase
      .from('ingredients')
      .select('*')
      .not('status', 'in', '("quick_add","single_ingredient","one_off")')
      .eq('user_id', user.id);
    if (listErr) throw new Error(listErr.message);

    const existing = (localRows || []).find(r => normalizeName(r.name) === normalizeName(record.name));
    if (existing) {
      return NextResponse.json({ status: 'exists', message: `✅ Already in your DB: ${existing.name}\n${summary(existing)}`, ingredient: existing });
    }

    const { data: saved, error } = await supabase.from('ingredients').insert(record).select().single();
    if (error) throw new Error(error.message);

    return NextResponse.json({ status: 'added', message: `✅ Added: ${saved.name}\n${summary(saved)}`, ingredient: saved });
  } catch (e) {
    console.error('shortcut scan error', e);
    return NextResponse.json({ status: 'error', message: `❌ Error: ${e.message}` }, { status: 500 });
  }
}
