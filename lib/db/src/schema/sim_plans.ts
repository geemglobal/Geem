import { pgTable, text, serial, timestamp, boolean, integer, numeric } from "drizzle-orm/pg-core";

export const simPlansTable = pgTable("sim_plans", {
  id: serial("id").primaryKey(),
  planCode: text("plan_code"),
  planName: text("plan_name").notNull(),
  description: text("description"),
  carrier: text("carrier"),
  planType: text("plan_type"),
  dataLimitMb: integer("data_limit_mb"),
  validDays: integer("valid_days"),
  priceCny: numeric("price_cny", { precision: 10, scale: 2 }),
  priceUsd: numeric("price_usd", { precision: 10, scale: 2 }),
  pricePkr: numeric("price_pkr", { precision: 10, scale: 2 }),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
