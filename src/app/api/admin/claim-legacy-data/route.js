import { NextResponse } from 'next/server';
import { openDb } from '../../../../lib/db';
import { createClient } from '../../../../utils/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'You must be logged in to claim data' }, { status: 401 });
    }

    const db = await openDb();

    // Assign all legacy data (where user_id is null) to this newly signed-up user
    await db.exec('BEGIN TRANSACTION');
    try {
      await db.run('UPDATE recipes SET user_id = ? WHERE user_id IS NULL', [user.id]);
      await db.run('UPDATE daily_logs SET user_id = ? WHERE user_id IS NULL', [user.id]);
      await db.run('UPDATE weight_logs SET user_id = ? WHERE user_id IS NULL', [user.id]);
      await db.run('UPDATE goals SET user_id = ? WHERE user_id IS NULL', [user.id]);
      
      // For ingredients, don't update them to avoid claiming global shared ingredients,
      // but if you want to claim custom ones you can uncomment this:
      // await db.run("UPDATE ingredients SET user_id = ? WHERE user_id IS NULL", [user.id]);

      await db.exec('COMMIT');
      return NextResponse.json({ 
        success: true, 
        message: 'Successfully migrated all previous data to your new account! You can now go back to the dashboard.',
        user_id: user.id
      });
    } catch (err) {
      await db.exec('ROLLBACK');
      throw err;
    }
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
