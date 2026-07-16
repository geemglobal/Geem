import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { simCustomersTable } from "./sim_customers";

export const simPlanRequestsTable = pgTable("sim_plan_requests", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull().references(() => simCustomersTable.id, { onDelete: "cascade" }),
  iccid: text("iccid").notNull(),
  planId: integer("plan_id"),
  planName: text("plan_name"),
  currency: text("currency").notNull().default("PKR"),
  region: text("region"),
  note: text("note"),
  status: text("status").notNull().default("pending"),
  reviewedBy: integer("reviewed_by"),
  reviewNote: text("review_note"),
  orderNumber: text("order_number"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
