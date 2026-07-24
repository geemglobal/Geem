import { pgTable, serial, text, boolean, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const chatSessionsTable = pgTable("chat_sessions", {
  id: serial("id").primaryKey(),
  sessionKey: text("session_key").unique(),        // anonymous shop persistence key
  customerName: text("customer_name"),
  customerEmail: text("customer_email"),
  customerMobile: text("customer_mobile"),
  assignedStaffId: integer("assigned_staff_id"),
  status: text("status").notNull().default("open"), // open | resolved | closed
  aiMode: boolean("ai_mode").notNull().default(true), // true = AI handles, false = human agent
  unreadCount: integer("unread_count").notNull().default(0),
  lastMessage: text("last_message"),
  ticketNumber: text("ticket_number"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const chatMessagesTable = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull().references(() => chatSessionsTable.id),
  role: text("role").notNull().default("customer"),        // customer | agent | system
  messageType: text("message_type").notNull().default("text"), // text | voice | image | file
  content: text("content").notNull().default(""),
  fileUrl: text("file_url"),
  fileName: text("file_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  readAt: timestamp("read_at", { withTimezone: true }),
});

export const insertChatSessionSchema = createInsertSchema(chatSessionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertChatMessageSchema = createInsertSchema(chatMessagesTable).omit({ id: true, createdAt: true });

export type ChatSession = typeof chatSessionsTable.$inferSelect;
export type ChatMessage = typeof chatMessagesTable.$inferSelect;
export type InsertChatSession = z.infer<typeof insertChatSessionSchema>;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
