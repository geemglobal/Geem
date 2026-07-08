import { pgTable, text, serial, timestamp, boolean, integer, numeric } from "drizzle-orm/pg-core";
import { simCustomersTable } from "./sim_customers";

export const simCustomerSimsTable = pgTable("sim_customer_sims", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull().references(() => simCustomersTable.id, { onDelete: "cascade" }),
  iccid: text("iccid").notNull().unique(),
  msisdn: text("msisdn"),
  nickname: text("nickname"),
  isPrimary: boolean("is_primary").notNull().default(false),
  addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
  expireTime: text("expire_time"),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  dataUsageMb: numeric("data_usage_mb", { precision: 12, scale: 3 }),
  planLimitMb: numeric("plan_limit_mb", { precision: 12, scale: 3 }),
});
