import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

// Expect JSON: { fileBase64: "..." }
export async function POST(request) {
  try {
    const body = await request.json();
    if (!body || !body.fileBase64) return NextResponse.json({ error: 'Missing fileBase64' }, { status: 400 });
    const buf = Buffer.from(body.fileBase64, 'base64');
    const dbPath = path.resolve(process.cwd(), 'meals.db');
    // write a backup of current DB
    try {
      if (fs.existsSync(dbPath)) {
        const ts = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = path.resolve(process.cwd(), 'backups');
        await fs.promises.mkdir(backupPath, { recursive: true });
        await fs.promises.copyFile(dbPath, path.join(backupPath, `meals-before-restore-${ts}.db`));
      }
    } catch (e) {
      console.warn('Failed to create pre-restore backup', e);
    }

    await fs.promises.writeFile(dbPath, buf);
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('Restore error', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
