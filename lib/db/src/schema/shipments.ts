import { pgTable, serial, text, timestamp, numeric, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { couriersTable } from "./couriers";

export const shipmentsTable = pgTable("shipments", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoice_id"),
  webOrderId: integer("web_order_id"),
  courierId: integer("courier_id").notNull().references(() => couriersTable.id),
  cn: text("cn"),
  status: text("status").notNull().default("pending"),
  destination: text("destination").notNull(),
  weight: numeric("weight", { precision: 8, scale: 3 }),
  pieces: integer("pieces").default(1),
  codAmount: numeric("cod_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  shippingCharges: numeric("shipping_charges", { precision: 12, scale: 2 }).notNull().default("0"),
  slipLink: text("slip_link"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertShipmentSchema = createInsertSchema(shipmentsTable).omit({ id: true, createdAt: true });
export type InsertShipment = z.infer<typeof insertShipmentSchema>;
export type Shipment = typeof shipmentsTable.$inferSelect;
