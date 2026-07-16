import { pgTable, serial, text, boolean, timestamp, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const couriersTable = pgTable("couriers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  apiProvider: text("api_provider"),
  apiKey: text("api_key"),
  apiPassword: text("api_password"),
  trackingUrl: text("tracking_url"),
  ledgerBalance: numeric("ledger_balance", { precision: 12, scale: 2 }).notNull().default("0"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCourierSchema = createInsertSchema(couriersTable).omit({ id: true, createdAt: true, ledgerBalance: true });
export type InsertCourier = z.infer<typeof insertCourierSchema>;
export type Courier = typeof couriersTable.$inferSelect;
