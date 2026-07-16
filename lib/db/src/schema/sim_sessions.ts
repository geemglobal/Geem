import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { simCustomersTable } from "./sim_customers";

export const simSessionsTable = pgTable("sim_sessions", {
  token:      text("token").primaryKey(),
  role:       text("role").notNull(),
  userId:     integer("user_id").references(() => usersTable.id, { onDelete: "cascade" }),
  customerId: integer("customer_id").references(() => simCustomersTable.id, { onDelete: "cascade" }),
  createdAt:  timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt:  timestamp("expires_at", { withTimezone: true }).notNull(),
});
