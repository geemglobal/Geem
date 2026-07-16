import { pgTable, serial, text, boolean, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { inventoryItemsTable } from "./inventory";

export const imeiPoolTable = pgTable("imei_pool", {
  id: serial("id").primaryKey(),
  prefix12: text("prefix12").notNull(),
  imei15: text("imei15").notNull().unique(),
  serialNumber: integer("serial_number").notNull(),
  isUsed: boolean("is_used").notNull().default(false),
  assignedInventoryItemId: integer("assigned_inventory_item_id").references(() => inventoryItemsTable.id),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertImeiPoolSchema = createInsertSchema(imeiPoolTable).omit({ id: true, createdAt: true });
export type InsertImeiPool = z.infer<typeof insertImeiPoolSchema>;
export type ImeiPool = typeof imeiPoolTable.$inferSelect;
