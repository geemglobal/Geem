import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Add unique constraint to users.username (if not exists)
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'users_username_unique'
        ) THEN
          ALTER TABLE users ADD CONSTRAINT users_username_unique UNIQUE (username);
        END IF;
      END $$;
    `);

    // 2. sim_customers
    await client.query(`
      CREATE TABLE IF NOT EXISTS sim_customers (
        id              SERIAL PRIMARY KEY,
        username        TEXT UNIQUE,
        iccid           TEXT UNIQUE,
        msisdn          TEXT UNIQUE,
        imsi            TEXT UNIQUE,
        password_hash   TEXT NOT NULL,
        full_name       TEXT,
        email           TEXT,
        phone           TEXT,
        account_type    TEXT NOT NULL DEFAULT 'single',
        is_active       BOOLEAN NOT NULL DEFAULT TRUE,
        must_change_password BOOLEAN NOT NULL DEFAULT TRUE,
        balance_pkr     NUMERIC(12,2) NOT NULL DEFAULT 0,
        balance_cny     NUMERIC(12,2) NOT NULL DEFAULT 0,
        balance_usd     NUMERIC(12,2) NOT NULL DEFAULT 0,
        created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
        last_login_at   TIMESTAMP
      );
    `);

    // 3. sim_customer_sims (one customer → many SIM cards)
    await client.query(`
      CREATE TABLE IF NOT EXISTS sim_customer_sims (
        id          SERIAL PRIMARY KEY,
        customer_id INTEGER NOT NULL REFERENCES sim_customers(id) ON DELETE CASCADE,
        iccid       TEXT NOT NULL,
        msisdn      TEXT,
        nickname    TEXT,
        is_primary  BOOLEAN NOT NULL DEFAULT FALSE,
        created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE(customer_id, iccid)
      );
    `);

    // 4. sim_plans
    await client.query(`
      CREATE TABLE IF NOT EXISTS sim_plans (
        id            SERIAL PRIMARY KEY,
        plan_code     TEXT,
        plan_name     TEXT NOT NULL,
        description   TEXT,
        carrier       TEXT,
        plan_type     TEXT,
        data_limit_mb INTEGER,
        valid_days    INTEGER,
        price_cny     NUMERIC(12,2),
        price_usd     NUMERIC(12,2),
        price_pkr     NUMERIC(12,2),
        is_active     BOOLEAN NOT NULL DEFAULT TRUE,
        sort_order    INTEGER NOT NULL DEFAULT 0,
        created_at    TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    // 5. sim_topups
    await client.query(`
      CREATE TABLE IF NOT EXISTS sim_topups (
        id          SERIAL PRIMARY KEY,
        customer_id INTEGER NOT NULL REFERENCES sim_customers(id) ON DELETE CASCADE,
        amount_pkr  NUMERIC(12,2) NOT NULL DEFAULT 0,
        amount_cny  NUMERIC(12,2) NOT NULL DEFAULT 0,
        amount_usd  NUMERIC(12,2) NOT NULL DEFAULT 0,
        note        TEXT,
        applied_by  INTEGER,
        status      TEXT NOT NULL DEFAULT 'completed',
        created_at  TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    // 6. sim_sms_messages
    await client.query(`
      CREATE TABLE IF NOT EXISTS sim_sms_messages (
        id          SERIAL PRIMARY KEY,
        customer_id INTEGER NOT NULL REFERENCES sim_customers(id) ON DELETE CASCADE,
        iccid       TEXT NOT NULL,
        direction   TEXT NOT NULL DEFAULT 'sent',
        from_number TEXT,
        to_number   TEXT,
        body        TEXT NOT NULL,
        sent_at     TIMESTAMP NOT NULL DEFAULT NOW(),
        created_at  TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    // 7. sim_order_history
    await client.query(`
      CREATE TABLE IF NOT EXISTS sim_order_history (
        id           SERIAL PRIMARY KEY,
        customer_id  INTEGER REFERENCES sim_customers(id) ON DELETE SET NULL,
        iccid        TEXT NOT NULL,
        action       TEXT NOT NULL,
        plan_id      TEXT,
        plan_name    TEXT,
        order_number TEXT,
        currency     TEXT DEFAULT 'CNY',
        amount_cny   NUMERIC(12,2),
        amount_usd   NUMERIC(12,2),
        amount_pkr   NUMERIC(12,2),
        created_at   TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    // 8. Add missing columns to sim_customers (added post-initial-migration)
    await client.query(`
      ALTER TABLE sim_customers
        ADD COLUMN IF NOT EXISTS imsi               TEXT,
        ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT TRUE,
        ADD COLUMN IF NOT EXISTS balance_pkr        NUMERIC(12,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS balance_cny        NUMERIC(12,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS balance_usd        NUMERIC(12,2) NOT NULL DEFAULT 0;
    `);
    // Add imsi unique constraint if not exists
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sim_customers_imsi_unique') THEN
          ALTER TABLE sim_customers ADD CONSTRAINT sim_customers_imsi_unique UNIQUE (imsi);
        END IF;
      END $$;
    `);

    // 9. Cache expiry time and data usage on sim_customer_sims
    await client.query(`
      ALTER TABLE sim_customer_sims
        ADD COLUMN IF NOT EXISTS expire_time    TEXT,
        ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS data_usage_mb  NUMERIC(12,3),
        ADD COLUMN IF NOT EXISTS plan_limit_mb  NUMERIC(12,3);
    `);

    // 9. sim_alert_settings (single-row global config)
    await client.query(`
      CREATE TABLE IF NOT EXISTS sim_alert_settings (
        id               SERIAL PRIMARY KEY,
        low_balance_pkr  NUMERIC(12,2) NOT NULL DEFAULT 0,
        low_balance_cny  NUMERIC(12,2) NOT NULL DEFAULT 0,
        low_balance_usd  NUMERIC(12,2) NOT NULL DEFAULT 0,
        updated_at       TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    // Add data_usage_threshold_pct column if not exists
    await client.query(`
      ALTER TABLE sim_alert_settings
        ADD COLUMN IF NOT EXISTS data_usage_threshold_pct INTEGER NOT NULL DEFAULT 80;
    `);
    // Seed the single settings row if absent
    await client.query(`
      INSERT INTO sim_alert_settings (id, low_balance_pkr, low_balance_cny, low_balance_usd, data_usage_threshold_pct)
      VALUES (1, 0, 0, 0, 80)
      ON CONFLICT (id) DO NOTHING;
    `);

    // 10. sim_notifications (alert log per customer)
    await client.query(`
      CREATE TABLE IF NOT EXISTS sim_notifications (
        id          SERIAL PRIMARY KEY,
        customer_id INTEGER NOT NULL REFERENCES sim_customers(id) ON DELETE CASCADE,
        type        TEXT NOT NULL,
        iccid       TEXT,
        message     TEXT NOT NULL,
        is_read     BOOLEAN NOT NULL DEFAULT FALSE,
        created_at  TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    // 11. sim_plan_requests (customer-submitted plan order requests)
    await client.query(`
      CREATE TABLE IF NOT EXISTS sim_plan_requests (
        id           SERIAL PRIMARY KEY,
        customer_id  INTEGER NOT NULL REFERENCES sim_customers(id) ON DELETE CASCADE,
        iccid        TEXT NOT NULL,
        plan_id      INTEGER,
        plan_name    TEXT,
        currency     TEXT NOT NULL DEFAULT 'PKR',
        region       TEXT,
        note         TEXT,
        status       TEXT NOT NULL DEFAULT 'pending',
        reviewed_by  INTEGER,
        review_note  TEXT,
        order_number TEXT,
        created_at   TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at   TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    // 12. sim_sessions (persistent admin + customer sessions)
    await client.query(`
      CREATE TABLE IF NOT EXISTS sim_sessions (
        token       TEXT PRIMARY KEY,
        role        TEXT NOT NULL,
        user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
        customer_id INTEGER REFERENCES sim_customers(id) ON DELETE CASCADE,
        created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
        expires_at  TIMESTAMP NOT NULL
      );
    `);
    // Index for fast expiry sweeps
    await client.query(`
      CREATE INDEX IF NOT EXISTS sim_sessions_expires_at_idx ON sim_sessions (expires_at);
    `);

    await client.query("COMMIT");
    console.log("✅ SIM tables created/verified successfully");
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
