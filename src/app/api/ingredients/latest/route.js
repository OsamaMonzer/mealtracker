import { NextResponse } from 'next/server';
import { createClient } from '../../../../utils/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { count, error } = await supabase
      .from('ingredients')
      .select('*', { count: 'exact', head: true })
      .or(`user_id.is.null,user_id.eq.${user.id}`);
      
    if (error) throw new Error(error.message);

    return NextResponse.json({ lastId: 0, count: count || 0 });
  } catch (e) {
    console.error('latest ingredients error', e);
    return NextResponse.json({ lastId: 0, count: 0 });
  }
}
