const { readdir, readFile } = require('node:fs/promises');
const path = require('node:path');
const { Pool } = require('pg');

async function migrate() {
  if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL before running migrations.');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 5000 });
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    // Serialize concurrent deploy migrations inside this transaction.
    await client.query('SELECT pg_advisory_xact_lock(741802)');
    await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
    const dir = path.join(__dirname, '..', 'migrations');
    for (const name of (await readdir(dir)).filter(name => /^\d+_.*\.sql$/.test(name)).sort()) {
      const applied = await client.query('SELECT name FROM schema_migrations WHERE name = $1', [name]);
      if (applied.rowCount) continue;
      await client.query(await readFile(path.join(dir, name), 'utf8'));
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [name]);
      console.log(`Applied ${name}`);
    }
    await client.query('COMMIT');
  } catch (error) {
    if (client) await client.query('ROLLBACK');
    throw error;
  } finally {
    client?.release();
    await pool.end();
  }
}

migrate().catch(() => {
  console.error('Migration failed. Check DATABASE_URL, connectivity, and migration SQL.');
  process.exitCode = 1;
});
