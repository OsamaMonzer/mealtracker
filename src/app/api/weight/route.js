import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('weight_logs')
      .select('*')
      .order('date', { ascending: false });
    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { date, weight_kg, photo_url } = await request.json();
    if (!date || isNaN(weight_kg)) return NextResponse.json({ error: 'Invalid data' }, { status: 400 });

    const { data, error } = await supabase
      .from('weight_logs')
      .insert([{ date, weight_kg: parseFloat(weight_kg), photo_url: photo_url || null }])
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, id: data.id });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
