import { NextResponse } from 'next/server';
import { createClient } from '../../../../utils/supabase/server';
import { createAdminClient } from '../../../../lib/supabase/admin';
import { PHOTO_BUCKET, photoPath, ownsPhoto, signPhoto } from '../../../../lib/photos';

export const dynamic = 'force-dynamic';

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_EXT = new Set(['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif']);

// Upload a new photo → { url } (a short-lived signed URL; the API stores only the path)
export async function POST(request) {
  try {
    const { data: { user } } = await createClient().auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const formData = await request.formData();
    const file = formData.get('file');
    const date = formData.get('date') || 'photo';

    if (!file || typeof file === 'string') return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: 'Photo is larger than 10 MB' }, { status: 413 });

    let ext = (file.name.split('.').pop() || '').toLowerCase();
    if (!ALLOWED_EXT.has(ext)) ext = 'jpg';
    const safeDate = String(date).replace(/[^0-9-]/g, '') || 'photo';
    const path = `weight-photos/${user.id}/${safeDate}-${Date.now()}.${ext}`;

    const buffer = Buffer.from(await file.arrayBuffer());
    const { error } = await createAdminClient().storage
      .from(PHOTO_BUCKET)
      .upload(path, buffer, { contentType: file.type || 'image/jpeg', upsert: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ url: await signPhoto(path), path });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Delete a photo by URL or path → { success }
export async function DELETE(request) {
  try {
    const { data: { user } } = await createClient().auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { photo_url } = await request.json();
    const path = photoPath(photo_url);
    if (!path) return NextResponse.json({ error: 'Invalid photo' }, { status: 400 });
    if (!ownsPhoto(path, user.id)) return NextResponse.json({ error: 'Unauthorized to delete this photo' }, { status: 403 });

    const { error } = await createAdminClient().storage.from(PHOTO_BUCKET).remove([path]);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
