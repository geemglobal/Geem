import { pgTable, serial, integer, text, numeric, timestamp } from "drizzle-orm/pg-core";
import { simCustomersTable } from "./sim_customers";

export const simOrderHistoryTable = pgTable("sim_order_history", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").references(() => simCustomersTable.id, { onDelete: "set null" }),
  iccid: text("iccid").notNull(),
  action: text("action").notNull(),
  planId: text("plan_id"),
  planName: text("plan_name"),
  orderNumber: text("order_number"),
  currency: text("currency").default("CNY"),
  amountCny: numeric("amount_cny", { precision: 12, scale: 2 }),
  amountUsd: numeric("amount_usd", { precision: 12, scale: 2 }),
  amountPkr: numeric("amount_pkr", { precision: 12, scale: 2 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
