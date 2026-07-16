import { pgTable, serial, text, boolean, timestamp, numeric, integer, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { brandsTable } from "./brands";
import { deviceModelsTable } from "./device_models";
import { categoriesTable } from "./categories";
import { vendorsTable } from "./vendors";

export const inventoryItemsTable = pgTable("inventory_items", {
  id: serial("id").primaryKey(),
  imei: text("imei").notNull().unique(),
  deviceId: text("device_id"),
  iccid: text("iccid"),
  msisdn: text("msisdn"),
  brandId: integer("brand_id").notNull().references(() => brandsTable.id),
  modelId: integer("model_id").notNull().references(() => deviceModelsTable.id),
  categoryId: integer("category_id").references(() => categoriesTable.id),
  vendorId: integer("vendor_id").references(() => vendorsTable.id),
  status: text("status").notNull().default("in_stock"),
  previousStatus: text("previous_status"),
  ptaStatus: text("pta_status").notNull().default("approved"),
  psid: text("psid"),
  landedCost: numeric("landed_cost", { precision: 12, scale: 2 }).notNull(),
  sellingPrice: numeric("selling_price", { precision: 12, scale: 2 }).notNull(),
  purchaseDate: date("purchase_date").notNull(),
  warrantyExpiry: date("warranty_expiry"),
  supplierInvoiceNumber: text("supplier_invoice_number"),
  grnNumber: text("grn_number"),
  trackerSimNo: text("tracker_sim_no"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertInventoryItemSchema = createInsertSchema(inventoryItemsTable).omit({ id: true, createdAt: true });
export type InsertInventoryItem = z.infer<typeof insertInventoryItemSchema>;
export type InventoryItem = typeof inventoryItemsTable.$inferSelect;
