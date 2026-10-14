import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import { readApiKey, isValidApiKey } from '../../lib/apiKey'

const unauthorized = () => NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

export async function updateSession(request) {
  const { pathname } = request.nextUrl
  const isApi = pathname.startsWith('/api/')

  // API-key callers: validate here, and pass the key on as a header so route
  // handlers see it even when it arrived as ?key= or a Bearer token.
  if (isApi) {
    const key = readApiKey(request.headers, request.url)
    if (key !== null) {
      if (!isValidApiKey(key)) return unauthorized()
      const forwarded = new Headers(request.headers)
      forwarded.set('x-api-key', key)
      return NextResponse.next({ request: { headers: forwarded } })
    }
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options))
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const isAuthRoute = pathname.startsWith('/login') || pathname.startsWith('/auth')

  if (!user && !isAuthRoute) {
    if (isApi) return unauthorized()
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
