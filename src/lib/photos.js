import { createAdminClient } from './supabase/admin';

export const PHOTO_BUCKET = 'photos';
const SIGNED_URL_TTL = 60 * 60; // 1 hour

// Accepts a storage path, a public URL or a signed URL and returns the storage path.
export function photoPath(value) {
  if (!value) return null;
  if (!/^https?:\/\//.test(value)) return value;
  const m = value.match(/\/photos\/(weight-photos\/[^?#]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export function ownsPhoto(path, userId) {
  return !!path && path.startsWith(`weight-photos/${userId}/`);
}

// Replaces photo_url on each row with a short-lived signed URL (works with a private bucket).
export async function withSignedPhotos(rows) {
  const list = rows || [];
  const paths = [...new Set(list.map(r => photoPath(r.photo_url)).filter(Boolean))];
  if (paths.length === 0) return list;
  let data = null;
  try {
    ({ data } = await createAdminClient().storage.from(PHOTO_BUCKET).createSignedUrls(paths, SIGNED_URL_TTL));
  } catch (e) {
    console.error('Could not sign photo URLs', e);
    return list; // don't break the page over photos
  }
  const byPath = Object.fromEntries((data || []).map(d => [d.path, d.signedUrl]));
  return list.map(r => {
    const p = photoPath(r.photo_url);
    return p ? { ...r, photo_url: byPath[p] || null } : r;
  });
}

export async function signPhoto(path) {
  const { data } = await createAdminClient().storage.from(PHOTO_BUCKET).createSignedUrl(path, SIGNED_URL_TTL);
  return data?.signedUrl || null;
}
