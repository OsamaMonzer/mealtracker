import { Pool } from 'pg';

const postgresUrl = 'postgresql://postgres.jvqyussifqyrfkasvlak:P@ssw0rd2006@@Osama@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres';

async function run() {
  try {
    const userId = '9cc56a4b-9b15-4f91-83e1-42137709fe20'; // Exact ID derived directly from auth.users

    console.log(`Using REAL User ID: ${userId}`);
    console.log('Connecting to PostgreSQL database...');
    const pool = new Pool({ connectionString: postgresUrl });

    console.log('Running migration...');
    const tables = ['recipes', 'daily_logs', 'weight_logs', 'goals'];
    
    for (const table of tables) {
      const res = await pool.query(`UPDATE ${table} SET user_id = $1 WHERE user_id IS NULL`, [userId]);
      console.log(`Updated ${res.rowCount} rows in ${table}`);
    }

    await pool.end();
    console.log('Migration completed successfully!');

  } catch (err) {
    console.error('Error during migration:', err);
  }
}

run();
