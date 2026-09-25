require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL non configurato.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === 'disable' ? false : (process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined),
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

(async () => {
  const client = await pool.connect();
  try {
    const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await client.query("SELECT set_config('app.platform_admin','true',false), set_config('app.workshop_id','1',false)");
    await client.query(sql);
    console.log('Schema GO applicato.');
  } catch (error) {
    console.error('Migrazione non riuscita:', error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
})();
