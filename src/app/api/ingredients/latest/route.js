import { NextResponse } from 'next/server';
import { createClient } from '../../../../utils/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = createClient();
    const { count, error } = await supabase
      .from('ingredients')
      .select('*', { count: 'exact', head: true });
      
    if (error) throw new Error(error.message);

    return NextResponse.json({ lastId: 0, count: count || 0 });
  } catch (e) {
    console.error('latest ingredients error', e);
    return NextResponse.json({ lastId: 0, count: 0 });
  }
}
