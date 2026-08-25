import { pgTable, serial, integer, numeric, text, timestamp } from "drizzle-orm/pg-core";
import { simCustomersTable } from "./sim_customers";

export const simTopupsTable = pgTable("sim_topups", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull().references(() => simCustomersTable.id, { onDelete: "cascade" }),
  amountPkr: numeric("amount_pkr", { precision: 12, scale: 2 }).notNull().default("0"),
  amountCny: numeric("amount_cny", { precision: 12, scale: 2 }).notNull().default("0"),
  amountUsd: numeric("amount_usd", { precision: 12, scale: 2 }).notNull().default("0"),
  note: text("note"),
  appliedBy: integer("applied_by"),
  status: text("status").notNull().default("completed"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
});
