import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { shopCustomersTable } from "./shop_customers";

export const shopSessionsTable = pgTable("shop_sessions", {
  id:         serial("id").primaryKey(),
  token:      text("token").notNull().unique(),
  customerId: integer("customer_id").notNull().references(() => shopCustomersTable.id, { onDelete: "cascade" }),
  name:       text("name").notNull(),
  email:      text("email"),
  mobile:     text("mobile"),
  username:   text("username"),
  expiresAt:  timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt:  timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ShopSession = typeof shopSessionsTable.$inferSelect;
