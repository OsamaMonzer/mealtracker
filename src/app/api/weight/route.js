import { NextResponse } from 'next/server';
import { openDb } from '../../../lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const db = await openDb();
    // Add photo_url column if it doesn't exist yet (safe to call every time)
    await db.run('ALTER TABLE weight_logs ADD COLUMN photo_url TEXT').catch(() => {});
    const logs = await db.all('SELECT * FROM weight_logs ORDER BY date DESC, id DESC');
    return NextResponse.json(logs);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { date, weight_kg, photo_url } = await request.json();
    if (!date || isNaN(weight_kg)) return NextResponse.json({ error: 'Invalid data' }, { status: 400 });

    const db = await openDb();
    await db.run('ALTER TABLE weight_logs ADD COLUMN photo_url TEXT').catch(() => {});
    const res = await db.run(
      'INSERT INTO weight_logs (date, weight_kg, photo_url) VALUES (?, ?, ?)',
      [date, parseFloat(weight_kg), photo_url || null]
    );

    return NextResponse.json({ success: true, id: res.lastID });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
