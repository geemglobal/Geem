import { pgTable, serial, text, boolean, timestamp, numeric, integer, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { customersTable } from "./customers";

export const invoicesTable = pgTable("invoices", {
  id: serial("id").primaryKey(),
  invoiceNumber: text("invoice_number").notNull().unique(),
  status: text("status").notNull().default("draft"),
  date: date("date").notNull(),
  dueDate: date("due_date"),
  customerId: integer("customer_id").notNull().references(() => customersTable.id),
  subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull().default("0"),
  discount: numeric("discount", { precision: 12, scale: 2 }).notNull().default("0"),
  tax: numeric("tax", { precision: 12, scale: 2 }).notNull().default("0"),
  shipping: numeric("shipping", { precision: 12, scale: 2 }).notNull().default("0"),
  total: numeric("total", { precision: 12, scale: 2 }).notNull().default("0"),
  paid: numeric("paid", { precision: 12, scale: 2 }).notNull().default("0"),
  walletAmountUsed: numeric("wallet_amount_used", { precision: 12, scale: 2 }).notNull().default("0"),
  currency: text("currency").notNull().default("PKR"),
  currencySymbol: text("currency_symbol").notNull().default("Rs"),
  notes: text("notes"),
  webOrderId: integer("web_order_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const invoiceItemsTable = pgTable("invoice_items", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoice_id").notNull().references(() => invoicesTable.id),
  description: text("description").notNull(),
  imei: text("imei"),
  inventoryItemId: integer("inventory_item_id"),
  qty: numeric("qty", { precision: 10, scale: 2 }).notNull().default("1"),
  price: numeric("price", { precision: 12, scale: 2 }).notNull(),
  taxRate: numeric("tax_rate", { precision: 5, scale: 2 }).notNull().default("0"),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
});

export const paymentsTable = pgTable("payments", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoice_id").notNull().references(() => invoicesTable.id),
  date: date("date").notNull(),
  method: text("method").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  transactionId: text("transaction_id"),
  memo: text("memo"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const posDraftsTable = pgTable("pos_drafts", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id"),
  customerName: text("customer_name").notNull().default("Walk-in"),
  total: numeric("total", { precision: 12, scale: 2 }).notNull().default("0"),
  cartData: text("cart_data").notNull().default("{}"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertInvoiceSchema = createInsertSchema(invoicesTable).omit({ id: true, createdAt: true });
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Invoice = typeof invoicesTable.$inferSelect;
export type InvoiceItem = typeof invoiceItemsTable.$inferSelect;
export type Payment = typeof paymentsTable.$inferSelect;
export type PosDraft = typeof posDraftsTable.$inferSelect;
