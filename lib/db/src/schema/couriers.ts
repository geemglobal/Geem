import { pgTable, serial, text, boolean, timestamp, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const couriersTable = pgTable("couriers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  /** Stable provider key, e.g. "leopards", "tcs", "mnp", "trax". Unique — used as ON CONFLICT target for seeding. */
  apiProvider: text("api_provider").unique("couriers_api_provider_unique"),
  apiKey: text("api_key"),
  apiPassword: text("api_password"),
  trackingUrl: text("tracking_url"),
  /** JSON array of city names this courier covers, e.g. '["Karachi","Lahore","Islamabad"]'. NULL means unknown / no restriction. */
  coveredCities: text("covered_cities"),
  ledgerBalance: numeric("ledger_balance", { precision: 12, scale: 2 }).notNull().default("0"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCourierSchema = createInsertSchema(couriersTable).omit({ id: true, createdAt: true, ledgerBalance: true });
export type InsertCourier = z.infer<typeof insertCourierSchema>;
export type Courier = typeof couriersTable.$inferSelect;
