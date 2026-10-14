import { createServerClient } from '@supabase/ssr'
import { cookies, headers } from 'next/headers'
import { createAdminClient } from '../../lib/supabase/admin'
import { readApiKey, isValidApiKey, API_KEY_USER_ID } from '../../lib/apiKey'

// API-key callers (Shortcut / GPT / MCP) have no Supabase session, so they get a
// service-role client pinned to API_KEY_USER_ID. Every route already filters by
// user.id, which keeps them scoped to that one account.
function apiKeyClient() {
  let key = null
  try { key = readApiKey(headers()) } catch { return null }
  if (!key || !isValidApiKey(key)) return null

  const supabase = createAdminClient()
  const user = { id: API_KEY_USER_ID, user_metadata: { display_name: 'API' } }
  supabase.auth.getUser = async () => ({ data: { user }, error: null })
  return supabase
}

export function createClient() {
  const viaKey = apiKeyClient()
  if (viaKey) return viaKey

  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          } catch {
            // Called from a Server Component — middleware refreshes the session instead.
          }
        },
      },
    }
  )
}
