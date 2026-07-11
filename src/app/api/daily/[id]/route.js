import { NextResponse } from 'next/server';
import { openDb } from '../../../../lib/db';

export async function DELETE(request, { params }) {
  try {
    const db = await openDb();
    await db.run('DELETE FROM daily_logs WHERE id = ?', [params.id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const { portions_eaten, meal_type } = await request.json();
    const db = await openDb();

    const fields = [];
    const values = [];
    if (portions_eaten !== undefined) { fields.push('portions_eaten = ?'); values.push(parseFloat(portions_eaten)); }
    if (meal_type     !== undefined) { fields.push('meal_type = ?');      values.push(meal_type); }
    if (fields.length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

    values.push(params.id);
    await db.run(`UPDATE daily_logs SET ${fields.join(', ')} WHERE id = ?`, values);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
