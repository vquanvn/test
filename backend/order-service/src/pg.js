const { Pool } = require("pg");

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://postgres:postgres@postgres:5432/ecommerce";

const pool = new Pool({ connectionString });

async function initPostgres() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      items JSONB NOT NULL,
      total_amount NUMERIC(12, 2) NOT NULL,
      shipping_address TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'created',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

module.exports = { pool, initPostgres };
