import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const dbPath = path.resolve(process.cwd(), 'meals.db');
    if (!fs.existsSync(dbPath)) return NextResponse.json({ error: 'DB not found' }, { status: 404 });
    const file = await fs.promises.readFile(dbPath);
    return new NextResponse(file, { status: 200, headers: { 'Content-Type': 'application/octet-stream', 'Content-Disposition': 'attachment; filename="meals.db"' } });
  } catch (e) {
    console.error('Backup error', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
