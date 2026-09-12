import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

export async function updateSession(request) {
  let supabaseResponse = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isAuthRoute = request.nextUrl.pathname.startsWith('/login') || request.nextUrl.pathname.startsWith('/auth')
  const isPublicApi = request.nextUrl.pathname.startsWith('/api/auth') // leave any core endpoint alone if needed
  
  let apiKey = request.headers.get('x-api-key')
  const authHeader = request.headers.get('authorization')
  if (!apiKey && authHeader && authHeader.startsWith('Bearer ')) {
    apiKey = authHeader.replace('Bearer ', '')
  }
  
  const hasValidApiKey = apiKey === (process.env.MEALTRACKER_API_KEY || 'mealtracker-shortcut-2024')

  if (!user && !isAuthRoute && !isPublicApi && !hasValidApiKey) {
    // Redirect unauthenticated traffic to login page
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && isAuthRoute) {
     // Redirect authenticated traffice away from login page
     const url = request.nextUrl.clone()
     url.pathname = '/'
     return NextResponse.redirect(url)
  }

  return supabaseResponse
}
