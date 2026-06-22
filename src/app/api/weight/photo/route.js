import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Upload a new photo → returns { url }
export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const date = formData.get('date') || new Date().toISOString().split('T')[0];

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

    const ext = file.name.split('.').pop().toLowerCase() || 'jpg';
    const path = `weight-photos/${date}-${Date.now()}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error } = await supabase.storage
      .from('photos')
      .upload(path, buffer, { contentType: file.type || 'image/jpeg', upsert: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const { data: { publicUrl } } = supabase.storage.from('photos').getPublicUrl(path);

    return NextResponse.json({ url: publicUrl });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Delete a photo from storage by URL → { success }
export async function DELETE(request) {
  try {
    const { photo_url } = await request.json();
    if (!photo_url) return NextResponse.json({ error: 'photo_url required' }, { status: 400 });

    const match = photo_url.match(/\/photos\/(.+)$/);
    if (!match) return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });

    const { error } = await supabase.storage.from('photos').remove([match[1]]);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
