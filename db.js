// Connects to a hosted Postgres database (e.g. Neon) instead of a local
// file, so your data survives even on hosts that wipe local disk on restart.
const { Pool } = require("pg");

if (!process.env.DATABASE_URL) {
  console.error(
    "\n[FATAL] DATABASE_URL is not set.\n" +
      "Set it in .env to your Neon (or other Postgres) connection string,\n" +
      "e.g. postgresql://user:password@host/dbname?sslmode=require\n"
  );
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS bookmarks (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      surah_number INTEGER NOT NULL,
      surah_name TEXT NOT NULL,
      ayah_number INTEGER NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, surah_number, ayah_number)
    );

    -- Add new columns safely outside CREATE TABLE
    ALTER TABLE bookmarks ADD COLUMN IF NOT EXISTS mode VARCHAR(20) DEFAULT 'surah';
    ALTER TABLE bookmarks ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'plain';

    CREATE TABLE IF NOT EXISTS progress (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      surah_number INTEGER NOT NULL,
      ayah_number INTEGER NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

module.exports = { pool, init };