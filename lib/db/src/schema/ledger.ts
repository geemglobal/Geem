import { pgTable, serial, text, timestamp, numeric, integer } from "drizzle-orm/pg-core";
import { customersTable } from "./customers";

export const ledgerEntriesTable = pgTable("ledger_entries", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull().references(() => customersTable.id),
  date: timestamp("date", { withTimezone: true }).notNull(),
  type: text("type").notNull(),
  description: text("description").notNull(),
  reference: text("reference"),
  debit: numeric("debit", { precision: 12, scale: 2 }).notNull().default("0"),
  credit: numeric("credit", { precision: 12, scale: 2 }).notNull().default("0"),
  balance: numeric("balance", { precision: 12, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type LedgerEntry = typeof ledgerEntriesTable.$inferSelect;
