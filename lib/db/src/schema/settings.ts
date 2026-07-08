import { pgTable, serial, text, timestamp, numeric, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const companySettingsTable = pgTable("company_settings", {
  id: serial("id").primaryKey(),
  companyName: text("company_name").notNull().default("Geem"),
  logo: text("logo"),
  favicon: text("favicon"),
  banner: text("banner"),
  address: text("address"),
  phone: text("phone"),
  fax: text("fax"),
  email: text("email"),
  website: text("website"),
  currency: text("currency").notNull().default("PKR"),
  timezone: text("timezone").notNull().default("Asia/Karachi"),
  taxNumber: text("tax_number"),
  whatsappNumber: text("whatsapp_number"),
  primaryColor: text("primary_color").notNull().default("#2563eb"),
  borderRadius: text("border_radius").notNull().default("md"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const invoiceSettingsTable = pgTable("invoice_settings", {
  id: serial("id").primaryKey(),
  logo: text("logo"),
  invoicePrefix: text("invoice_prefix").notNull().default("INV"),
  nextInvoiceNumber: integer("next_invoice_number").notNull().default(1001),
  defaultPaymentTerms: text("default_payment_terms").notNull().default("Net 30"),
  defaultTaxRate: numeric("default_tax_rate", { precision: 5, scale: 2 }).notNull().default("0"),
  defaultNotes: text("default_notes"),
  defaultFooter: text("default_footer"),
  pdfTemplate: text("pdf_template").notNull().default("default"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type CompanySettings = typeof companySettingsTable.$inferSelect;
export type InvoiceSettings = typeof invoiceSettingsTable.$inferSelect;
