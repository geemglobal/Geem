import pg from "pg";

const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS shop_sessions (
      id          SERIAL PRIMARY KEY,
      token       TEXT NOT NULL UNIQUE,
      customer_id INTEGER NOT NULL REFERENCES shop_customers(id) ON DELETE CASCADE,
      name        TEXT NOT NULL,
      email       TEXT,
      mobile      TEXT,
      username    TEXT,
      expires_at  TIMESTAMP NOT NULL,
      created_at  TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS shop_sessions_token_idx ON shop_sessions(token)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS shop_sessions_expires_at_idx ON shop_sessions(expires_at)`);
  console.log("shop_sessions table created (or already exists)");
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
