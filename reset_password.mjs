import { Pool } from 'pg';

const postgresUrl = 'postgresql://postgres.jvqyussifqyrfkasvlak:P@ssw0rd2006@@Osama@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres';

async function run() {
  const pool = new Pool({ connectionString: postgresUrl });
  try {
    const res = await pool.query(
      `UPDATE auth.users SET encrypted_password = crypt('P@ssw0rd2006', gen_salt('bf')) WHERE email = 'osamamonzer@gmail.com'`
    );
    console.log(`Updated password for ${res.rowCount} user(s)`);
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}

run();
