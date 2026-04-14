import pg from 'pg';
import { PGlite } from '@electric-sql/pglite';

const { Pool } = pg;

let db = null;
let dbType = null;

async function getDb() {
  if (db) return db;

  if (process.env.DATABASE_URL) {
    // Strip sslmode from URL to avoid pg conflict
    const url = process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/g, '').replace(/\?$/, '');
    const pool = new Pool({
      connectionString: url,
      ssl: { rejectUnauthorized: false },
    });
    db = {
      query: (sql, params) => pool.query(sql, params),
    };
    dbType = 'postgres';
    console.log('[db] Using Postgres (DATABASE_URL)');
  } else {
    const pglite = new PGlite('/tmp/pglite-data');
    await pglite.waitReady;
    db = {
      query: async (sql, params) => {
        const result = await pglite.query(sql, params);
        return { rows: result.rows };
      },
    };
    dbType = 'pglite';
    console.log('[db] Using PGlite at /tmp/pglite-data');
  }

  return db;
}

export async function query(sql, params) {
  const client = await getDb();
  return client.query(sql, params);
}

export async function initDb() {
  await getDb();
  await query(`
    CREATE TABLE IF NOT EXISTS scores (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL,
      time_ms INTEGER NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log('[db] scores table ready');
}
