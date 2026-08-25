import { pgTable, serial, text, boolean, timestamp, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const customersTable = pgTable("customers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  mobile: text("mobile").notNull(),
  phone: text("phone"),
  cnic: text("cnic"),
  type: text("type").notNull().default("individual"),
  email: text("email"),
  address: text("address"),
  city: text("city"),
  country: text("country").default("Pakistan"),
  vehicleNumber: text("vehicle_number"),
  notes: text("notes"),
  ledgerBalance: numeric("ledger_balance", { precision: 12, scale: 2 }).notNull().default("0"),
  walletBalance: numeric("wallet_balance", { precision: 12, scale: 2 }).notNull().default("0"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCustomerSchema = createInsertSchema(customersTable).omit({ id: true, createdAt: true, ledgerBalance: true });
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Customer = typeof customersTable.$inferSelect;
