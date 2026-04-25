const { Pool } = require("pg");
const bcrypt = require("bcryptjs");

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://postgres:postgres@postgres:5432/ecommerce";

const pool = new Pool({ connectionString });

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'customer',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const adminEmail = process.env.ADMIN_EMAIL || "admin@example.com";
  const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
  const adminFullName = process.env.ADMIN_FULL_NAME || "System Admin";

  const existing = await pool.query("SELECT id FROM users WHERE email = $1", [adminEmail]);
  if (existing.rows.length === 0) {
    const hashed = await bcrypt.hash(adminPassword, 10);
    await pool.query(
      `INSERT INTO users (email, password_hash, full_name, role)
       VALUES ($1, $2, $3, 'admin')`,
      [adminEmail, hashed, adminFullName]
    );
  }
}

module.exports = { pool, initDb };
