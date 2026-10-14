// API-key access for the iPhone Shortcut, the custom GPT and MCP clients.
// Edge-safe (used by middleware), so no Node-only imports here.

const MIN_KEY_LENGTH = 16;

// Which account API-key calls act as. Override with MEALTRACKER_API_USER_ID.
export const API_KEY_USER_ID =
  process.env.MEALTRACKER_API_USER_ID || '9cc56a4b-9b15-4f91-83e1-42137709fe20';

// Reads a key from `x-api-key`, `Authorization: Bearer …`, or `?key=` (in that order).
// Returns null when the request carries no key at all.
export function readApiKey(headers, url) {
  const direct = headers.get('x-api-key');
  if (direct) return direct.trim();
  const auth = headers.get('authorization');
  if (auth && auth.startsWith('Bearer ')) return auth.slice(7).trim();
  if (url) {
    try {
      const q = new URL(url).searchParams.get('key');
      if (q) return q.trim();
    } catch {}
  }
  return null;
}

// Only valid when MEALTRACKER_API_KEY is set and long enough — there is no default.
export function isValidApiKey(key) {
  const expected = process.env.MEALTRACKER_API_KEY;
  if (!expected || expected.length < MIN_KEY_LENGTH || !key) return false;
  if (key.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < key.length; i++) diff |= key.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}
