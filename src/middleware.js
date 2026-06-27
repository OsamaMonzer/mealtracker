import { NextResponse } from 'next/server';

// A simple static secret shared with your iPhone Shortcut.
// The Shortcut must send header: x-api-key: mealtracker-shortcut-2024
// You can change this string to anything you want.
const API_KEY = 'mealtracker-shortcut-2024';

export function middleware(request) {
  const { pathname } = request.nextUrl;

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

  // Allow requests from the iPhone Shortcut (or any external tool)
  // that present the shared API key header
  const apiKey = request.headers.get('x-api-key');
  if (apiKey === API_KEY) {
    return NextResponse.next();
  }

  // Allow normal browser sessions that have the auth cookie
  const auth = request.cookies.get('mt_auth');
  if (auth?.value === 'yes') {
    return NextResponse.next();
  }

  // Everything else → redirect to login
  // For API routes, return 401 instead of redirecting
  // so the Shortcut gets a clear error instead of an HTML page
  if (pathname.startsWith('/api/')) {
    return NextResponse.json(
      { error: 'Unauthorized. Send header x-api-key: ' + API_KEY },
      { status: 401 }
    );
  }

  const loginUrl = new URL('/login', request.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
