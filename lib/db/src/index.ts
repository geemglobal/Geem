import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Force every connection to use UTC so timestamp columns are always
// stored and read in UTC regardless of the Postgres server's system timezone.
pool.on("connect", (client) => {
  client.query("SET timezone='UTC'").catch(() => { /* ignore */ });
});

export const db = drizzle(pool, { schema });

export * from "./schema";
