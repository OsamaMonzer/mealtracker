import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const { password, rememberMe } = await request.json();
    const correct = process.env.APP_PASSWORD || 'osama123';

    if (password === correct) {
      const maxAge = rememberMe ? 60 * 60 * 24 * 30 : 60 * 60 * 24 * 1; // 30 days or 1 day
      const response = NextResponse.json({ ok: true });
      response.cookies.set('mt_auth', 'yes', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge,
        path: '/',
      });
      return response;
    }

    return NextResponse.json({ ok: false }, { status: 401 });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set('mt_auth', '', { maxAge: 0, path: '/' });
  return response;
}
