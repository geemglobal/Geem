import { pgTable, serial, text, timestamp, numeric, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const webOrdersTable = pgTable("web_orders", {
  id: serial("id").primaryKey(),
  orderNumber: text("order_number").notNull().unique(),
  status: text("status").notNull().default("new"),
  paymentStatus: text("payment_status").notNull().default("pending"),
  customerName: text("customer_name").notNull(),
  customerMobile: text("customer_mobile").notNull(),
  customerEmail: text("customer_email"),
  customerAddress: text("customer_address").notNull(),
  customerCity: text("customer_city").notNull(),
  paymentMethod: text("payment_method").notNull(),
  transactionId: text("transaction_id"),
  subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull().default("0"),
  shipping: numeric("shipping", { precision: 12, scale: 2 }).notNull().default("0"),
  total: numeric("total", { precision: 12, scale: 2 }).notNull().default("0"),
  courierCn: text("courier_cn"),
  rejectionReason: text("rejection_reason"),
  visitorFp: text("visitor_fp"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const webOrderItemsTable = pgTable("web_order_items", {
  id: serial("id").primaryKey(),
  webOrderId: integer("web_order_id").notNull().references(() => webOrdersTable.id),
  productId: integer("product_id"),
  description: text("description").notNull(),
  qty: numeric("qty", { precision: 10, scale: 2 }).notNull().default("1"),
  price: numeric("price", { precision: 12, scale: 2 }).notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
});

export const insertWebOrderSchema = createInsertSchema(webOrdersTable).omit({ id: true, createdAt: true });
export type InsertWebOrder = z.infer<typeof insertWebOrderSchema>;
export type WebOrder = typeof webOrdersTable.$inferSelect;
