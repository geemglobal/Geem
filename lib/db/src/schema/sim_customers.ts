import { pgTable, text, serial, timestamp, boolean, numeric } from "drizzle-orm/pg-core";

export const simCustomersTable = pgTable("sim_customers", {
  id: serial("id").primaryKey(),
  username: text("username").unique(),
  iccid: text("iccid").unique(),
  msisdn: text("msisdn").unique(),
  imsi: text("imsi").unique(),
  passwordHash: text("password_hash").notNull(),
  fullName: text("full_name"),
  email: text("email"),
  phone: text("phone"),
  accountType: text("account_type").notNull().default("single"),
  isActive: boolean("is_active").notNull().default(true),
  mustChangePassword: boolean("must_change_password").notNull().default(true),
  balancePkr: numeric("balance_pkr", { precision: 12, scale: 2 }).notNull().default("0"),
  balanceCny: numeric("balance_cny", { precision: 12, scale: 2 }).notNull().default("0"),
  balanceUsd: numeric("balance_usd", { precision: 12, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
});
