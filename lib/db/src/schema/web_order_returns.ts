import { pgTable, serial, text, numeric, timestamp } from "drizzle-orm/pg-core";

export const webOrderReturnsTable = pgTable("web_order_returns", {
  id:                serial("id").primaryKey(),
  orderNumber:       text("order_number").notNull(),
  customerName:      text("customer_name").notNull(),
  customerEmail:     text("customer_email"),
  customerMobile:    text("customer_mobile").notNull(),
  reason:            text("reason").notNull(),
  description:       text("description").notNull(),
  status:            text("status").notNull().default("pending"),
  refundAmount:      numeric("refund_amount", { precision: 12, scale: 2 }),
  adminNotes:        text("admin_notes"),
  createdAt:         timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:         timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type WebOrderReturn = typeof webOrderReturnsTable.$inferSelect;
export type NewWebOrderReturn = typeof webOrderReturnsTable.$inferInsert;
