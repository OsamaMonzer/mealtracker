import { NextResponse } from 'next/server';
import { createClient } from '../../../../utils/supabase/server';
import { createAdminClient } from '../../../../lib/supabase/admin';
import { PHOTO_BUCKET, photoPath, ownsPhoto } from '../../../../lib/photos';

export async function DELETE(request, { params }) {
  try {
    const { data: { user } } = await createClient().auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = createAdminClient();

    const { data: log } = await supabase
      .from('weight_logs')
      .select('photo_url')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .maybeSingle();
    if (!log) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const { error } = await supabase.from('weight_logs').delete().eq('id', params.id).eq('user_id', user.id);
    if (error) throw error;

    const path = photoPath(log.photo_url);
    if (ownsPhoto(path, user.id)) await supabase.storage.from(PHOTO_BUCKET).remove([path]);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const { data: { user } } = await createClient().auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { photo_url } = await request.json();
    const path = photoPath(photo_url);
    if (path && !ownsPhoto(path, user.id)) return NextResponse.json({ error: 'Invalid photo' }, { status: 403 });

    const { error } = await createAdminClient()
      .from('weight_logs')
      .update({ photo_url: path })
      .eq('id', params.id)
      .eq('user_id', user.id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
