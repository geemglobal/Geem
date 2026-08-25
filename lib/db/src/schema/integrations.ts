import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const integrationSettingsTable = pgTable("integration_settings", {
  id: serial("id").primaryKey(),
  type: text("type").notNull().unique(), // 'email' | 'sms' | 'whatsapp'
  enabled: boolean("enabled").notNull().default(false),
  config: text("config").notNull().default("{}"), // JSON string
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type IntegrationSetting = typeof integrationSettingsTable.$inferSelect;
