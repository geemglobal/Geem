import { pgTable, serial, integer, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { simCustomersTable } from "./sim_customers";

export const simNotificationsTable = pgTable("sim_notifications", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull().references(() => simCustomersTable.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  iccid: text("iccid"),
  message: text("message").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
