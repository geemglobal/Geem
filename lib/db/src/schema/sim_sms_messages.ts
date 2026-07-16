import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { simCustomersTable } from "./sim_customers";

export const simSmsMessagesTable = pgTable("sim_sms_messages", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull().references(() => simCustomersTable.id, { onDelete: "cascade" }),
  iccid: text("iccid").notNull(),
  direction: text("direction").notNull().default("sent"),
  fromNumber: text("from_number"),
  toNumber: text("to_number"),
  body: text("body").notNull(),
  sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
