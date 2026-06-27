import { NextResponse } from 'next/server';

const API_KEY = 'mealtracker-shortcut-2024';

export function middleware(request) {
  const { pathname, searchParams } = request.nextUrl;

  // Always allow login page, auth API, and Next.js internals
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname === '/icon.svg'
  ) {
    return NextResponse.next();
  }

  // Accept key via header (iPhone Shortcut, MCP stdio)
  const headerKey = request.headers.get('x-api-key');
  if (headerKey === API_KEY) return NextResponse.next();

  // Accept key via query param (GPT Actions, Perplexity, any URL-only client)
  // e.g. https://your-app.com/api/mcp?key=mealtracker-shortcut-2024
  const queryKey = searchParams.get('key');
  if (queryKey === API_KEY) return NextResponse.next();

  // Allow normal browser sessions with auth cookie
  const auth = request.cookies.get('mt_auth');
  if (auth?.value === 'yes') return NextResponse.next();

  // API routes return 401 JSON instead of HTML redirect
  if (pathname.startsWith('/api/')) {
    return NextResponse.json(
      { error: 'Unauthorized. Add ?key=YOUR_KEY to the URL or send x-api-key header.' },
      { status: 401 }
    );
  }

  return NextResponse.redirect(new URL('/login', request.url));
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
