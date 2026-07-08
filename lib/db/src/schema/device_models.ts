import { pgTable, serial, text, boolean, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { brandsTable } from "./brands";

export const deviceModelsTable = pgTable("device_models", {
  id: serial("id").primaryKey(),
  brandId: integer("brand_id").notNull().references(() => brandsTable.id),
  name: text("name").notNull(),
  description: text("description"),
  hasImei: boolean("has_imei").notNull().default(true),
  hasDeviceId: boolean("has_device_id").notNull().default(false),
  hasIccid: boolean("has_iccid").notNull().default(false),
  hasMsisdn: boolean("has_msisdn").notNull().default(false),
  deviceIdMandatory: boolean("device_id_mandatory").notNull().default(false),
  warrantyDays: integer("warranty_days").notNull().default(365),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertDeviceModelSchema = createInsertSchema(deviceModelsTable).omit({ id: true, createdAt: true });
export type InsertDeviceModel = z.infer<typeof insertDeviceModelSchema>;
export type DeviceModel = typeof deviceModelsTable.$inferSelect;
