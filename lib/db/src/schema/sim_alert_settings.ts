import { pgTable, serial, numeric, timestamp, integer } from "drizzle-orm/pg-core";

export const simAlertSettingsTable = pgTable("sim_alert_settings", {
  id: serial("id").primaryKey(),
  lowBalancePkr: numeric("low_balance_pkr", { precision: 12, scale: 2 }).notNull().default("0"),
  lowBalanceCny: numeric("low_balance_cny", { precision: 12, scale: 2 }).notNull().default("0"),
  lowBalanceUsd: numeric("low_balance_usd", { precision: 12, scale: 2 }).notNull().default("0"),
  dataUsageThresholdPct: integer("data_usage_threshold_pct").notNull().default(80),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
