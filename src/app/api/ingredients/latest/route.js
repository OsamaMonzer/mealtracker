import { NextResponse } from 'next/server';
import { openDb } from '../../../../lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const db = await openDb();
    const row = await db.get('SELECT MAX(id) as lastId, COUNT(*) as count FROM ingredients');
    return NextResponse.json({ lastId: row?.lastId || 0, count: row?.count || 0 });
  } catch (e) {
    console.error('latest ingredients error', e);
    return NextResponse.json({ lastId: 0, count: 0 });
  }
}
