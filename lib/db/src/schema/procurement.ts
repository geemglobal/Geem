import { pgTable, serial, text, timestamp, numeric, integer, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { vendorsTable } from "./vendors";

export const importOrdersTable = pgTable("import_orders", {
  id: serial("id").primaryKey(),
  importOrderNumber: text("import_order_number").notNull().unique(),
  vendorId: integer("vendor_id").notNull().references(() => vendorsTable.id),
  orderDate: date("order_date").notNull(),
  expectedArrival: date("expected_arrival"),
  currency: text("currency").notNull().default("USD"),
  exchangeRate: numeric("exchange_rate", { precision: 10, scale: 4 }).notNull().default("1"),
  subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull().default("0"),
  shippingCost: numeric("shipping_cost", { precision: 12, scale: 2 }).notNull().default("0"),
  total: numeric("total", { precision: 12, scale: 2 }).notNull().default("0"),
  paymentStatus: text("payment_status").notNull().default("pending"),
  shipmentStatus: text("shipment_status").notNull().default("pending"),
  trackingNumber: text("tracking_number"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const importOrderItemsTable = pgTable("import_order_items", {
  id: serial("id").primaryKey(),
  importOrderId: integer("import_order_id").notNull().references(() => importOrdersTable.id),
  description: text("description").notNull(),
  qty: numeric("qty", { precision: 10, scale: 2 }).notNull().default("1"),
  price: numeric("price", { precision: 12, scale: 2 }).notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
});

export const grnTable = pgTable("grn", {
  id: serial("id").primaryKey(),
  grnNumber: text("grn_number").notNull().unique(),
  importOrderId: integer("import_order_id").notNull().references(() => importOrdersTable.id),
  receivedDate: date("received_date").notNull(),
  status: text("status").notNull().default("complete"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertImportOrderSchema = createInsertSchema(importOrdersTable).omit({ id: true, createdAt: true });
export type InsertImportOrder = z.infer<typeof insertImportOrderSchema>;
export type ImportOrder = typeof importOrdersTable.$inferSelect;
export type Grn = typeof grnTable.$inferSelect;
