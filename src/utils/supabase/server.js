import { createServerClient } from '@supabase/ssr'
import { cookies, headers } from 'next/headers'

export function createClient() {
  const cookieStore = cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )

  // Monkey-patch getUser to allow MCP server bypass via x-api-key
  const originalGetUser = supabase.auth.getUser.bind(supabase.auth)
  supabase.auth.getUser = async (jwt) => {
    try {
      let apiKey = headers().get('x-api-key')
      const authHeader = headers().get('authorization')
      if (!apiKey && authHeader && authHeader.startsWith('Bearer ')) {
        apiKey = authHeader.replace('Bearer ', '')
      }
      if (apiKey === (process.env.MEALTRACKER_API_KEY || 'mealtracker-shortcut-2024')) {
        return { 
          data: { 
            user: { 
              id: '9cc56a4b-9b15-4f91-83e1-42137709fe20', 
              user_metadata: { display_name: 'Osama (MCP)' } 
            } 
          }, 
          error: null 
        }
      }
    } catch (e) {
      // Ignore if headers() throws outside of request context
    }
    return originalGetUser(jwt)
  }

  return supabase
}
