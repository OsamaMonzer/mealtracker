import { NextResponse } from 'next/server';
import { currentKitchenName } from '../../lib/currentKitchenName';

export const dynamic = 'force-dynamic';

// Web app manifest with the user's own name (used by Android "Install app").
export async function GET() {
  const name = await currentKitchenName();
  return NextResponse.json(
    {
      name,
      short_name: name,
      description: 'Personal Nutrition & Recipe System',
      start_url: '/',
      display: 'standalone',
      orientation: 'portrait',
      background_color: '#ffffff',
      theme_color: '#16a34a',
      icons: [{ src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
    },
    { headers: { 'Content-Type': 'application/manifest+json', 'Cache-Control': 'private, no-store' } }
  );
}
