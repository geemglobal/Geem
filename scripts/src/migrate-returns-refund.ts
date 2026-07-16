import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`
      ALTER TABLE web_order_returns
        ADD COLUMN IF NOT EXISTS refund_amount NUMERIC(12,2);
    `);
    await client.query("COMMIT");
    console.log("✅ web_order_returns.refund_amount column added");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Migration failed:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
