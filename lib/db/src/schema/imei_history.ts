import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { inventoryItemsTable } from "./inventory";

export const imeiHistoryTable = pgTable("imei_history", {
  id:                serial("id").primaryKey(),
  inventoryItemId:   integer("inventory_item_id").notNull().references(() => inventoryItemsTable.id, { onDelete: "cascade" }),
  oldImei:           text("old_imei").notNull(),
  newImei:           text("new_imei").notNull(),
  previousStatus:    text("previous_status"),
  restoredStatus:    text("restored_status"),
  reason:            text("reason"),
  source:            text("source").notNull().default("manual"),
  changedAt:         timestamp("changed_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ImeiHistory = typeof imeiHistoryTable.$inferSelect;
