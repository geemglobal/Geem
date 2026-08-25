import { pgTable, serial, text, boolean, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { customersTable } from "./customers";

export const serviceTicketsTable = pgTable("service_tickets", {
  id: serial("id").primaryKey(),
  ticketNumber: text("ticket_number").notNull().unique(),
  status: text("status").notNull().default("received"),
  customerId: integer("customer_id").notNull().references(() => customersTable.id),
  invoiceId: integer("invoice_id"),
  inventoryItemId: integer("inventory_item_id"),
  imei: text("imei"),
  productName: text("product_name"),
  warrantyValid: boolean("warranty_valid").notNull().default(false),
  issueDescription: text("issue_description").notNull(),
  resolutionNotes: text("resolution_notes"),
  replacementItemId: integer("replacement_item_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertServiceTicketSchema = createInsertSchema(serviceTicketsTable).omit({ id: true, createdAt: true });
export type InsertServiceTicket = z.infer<typeof insertServiceTicketSchema>;
export type ServiceTicket = typeof serviceTicketsTable.$inferSelect;
