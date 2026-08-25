import { pgTable, serial, varchar, text, timestamp } from "drizzle-orm/pg-core";

export const shopCustomersTable = pgTable("shop_customers", {
  id:           serial("id").primaryKey(),
  name:         varchar("name", { length: 200 }).notNull(),
  username:     varchar("username", { length: 100 }).unique(),
  email:        varchar("email", { length: 255 }).unique(),
  mobile:       varchar("mobile", { length: 20 }).unique(),
  passwordHash: text("password_hash").notNull(),
  address:      text("address"),
  city:         varchar("city", { length: 100 }),
  country:      varchar("country", { length: 100 }).default("Pakistan"),
  createdAt:    timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt:    timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type ShopCustomer = typeof shopCustomersTable.$inferSelect;
export type NewShopCustomer = typeof shopCustomersTable.$inferInsert;
