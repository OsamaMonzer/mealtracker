import { NextResponse } from 'next/server';
import { createClient } from '../../../utils/supabase/server';
import { createAdminClient } from '../../../lib/supabase/admin';
import { photoPath, ownsPhoto, withSignedPhotos } from '../../../lib/photos';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { data: { user } } = await createClient().auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data, error } = await createAdminClient()
      .from('weight_logs')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: false });
    if (error) throw error;
    return NextResponse.json(await withSignedPhotos(data));
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { data: { user } } = await createClient().auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { date, weight_kg, photo_url } = await request.json();
    if (!date || isNaN(weight_kg)) return NextResponse.json({ error: 'Invalid data' }, { status: 400 });

    // Store the storage path, not a URL — URLs are signed on read.
    const path = photoPath(photo_url);
    if (path && !ownsPhoto(path, user.id)) return NextResponse.json({ error: 'Invalid photo' }, { status: 403 });

    const { data, error } = await createAdminClient()
      .from('weight_logs')
      .insert([{ date, weight_kg: parseFloat(weight_kg), photo_url: path, user_id: user.id }])
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, id: data.id });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
