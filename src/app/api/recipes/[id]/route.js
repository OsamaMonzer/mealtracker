import { NextResponse } from 'next/server';
import { openDb } from '../../../../lib/db';

export async function DELETE(request, { params }) {
  try {
    const db = await openDb();
    await db.run('DELETE FROM recipe_ingredients WHERE recipe_id = ?', [params.id]);
    await db.run('DELETE FROM recipes WHERE id = ?', [params.id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
