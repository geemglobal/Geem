import { pgTable, serial, text, timestamp, numeric, integer, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { customersTable } from "./customers";

export const preOrdersTable = pgTable("pre_orders", {
  id: serial("id").primaryKey(),
  preOrderNumber: text("pre_order_number").notNull().unique(),
  status: text("status").notNull().default("confirmed"),
  customerId: integer("customer_id").notNull().references(() => customersTable.id),
  quotationId: integer("quotation_id"),
  orderDate: date("order_date").notNull(),
  expectedDelivery: date("expected_delivery"),
  advanceAmount: numeric("advance_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  paymentMethod: text("payment_method"),
  transactionId: text("transaction_id"),
  total: numeric("total", { precision: 12, scale: 2 }).notNull().default("0"),
  notes: text("notes"),
  currency: text("currency").notNull().default("PKR"),
  currencySymbol: text("currency_symbol").notNull().default("Rs"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const preOrderItemsTable = pgTable("pre_order_items", {
  id: serial("id").primaryKey(),
  preOrderId: integer("pre_order_id").notNull().references(() => preOrdersTable.id),
  description: text("description").notNull(),
  imei: text("imei"),
  inventoryItemId: integer("inventory_item_id"),
  deviceId: text("device_id"),
  ptaStatus: text("pta_status"),
  qty: numeric("qty", { precision: 10, scale: 2 }).notNull().default("1"),
  price: numeric("price", { precision: 12, scale: 2 }).notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
});

export const insertPreOrderSchema = createInsertSchema(preOrdersTable).omit({ id: true, createdAt: true });
export type InsertPreOrder = z.infer<typeof insertPreOrderSchema>;
export type PreOrder = typeof preOrdersTable.$inferSelect;
