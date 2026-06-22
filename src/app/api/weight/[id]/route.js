import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function DELETE(request, { params }) {
  try {
    const id = params.id;

    // Fetch photo_url before deleting so we can clean up storage too
    const { data: log } = await supabase
      .from('weight_logs')
      .select('photo_url')
      .eq('id', id)
      .single();

    // Delete row
    const { error } = await supabase
      .from('weight_logs')
      .delete()
      .eq('id', id);

    if (error) throw error;

    // Delete photo from storage if it exists
    if (log?.photo_url) {
      const url = log.photo_url;
      // Extract path after "/photos/"
      const match = url.match(/\/photos\/(.+)$/);
      if (match) {
        await supabase.storage.from('photos').remove([match[1]]);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const id = params.id;
    const { photo_url } = await request.json();

    const { error } = await supabase
      .from('weight_logs')
      .update({ photo_url: photo_url ?? null })
      .eq('id', id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
