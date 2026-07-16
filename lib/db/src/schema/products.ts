import { pgTable, serial, text, boolean, timestamp, numeric, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { brandsTable } from "./brands";
import { categoriesTable } from "./categories";

export const productsTable = pgTable("products", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  sku: text("sku"),
  barcode: text("barcode"),
  brandId: integer("brand_id").references(() => brandsTable.id),
  categoryId: integer("category_id").references(() => categoriesTable.id),
  tags: text("tags"),
  price: numeric("price", { precision: 12, scale: 2 }).notNull(),
  salePrice: numeric("sale_price", { precision: 12, scale: 2 }),
  costPrice: numeric("cost_price", { precision: 12, scale: 2 }),
  stockQty: integer("stock_qty").notNull().default(0),
  shortDescription: text("short_description"),
  longDescription: text("long_description"),
  featuredImage: text("featured_image"),
  galleryImages: text("gallery_images"),
  published: boolean("published").notNull().default(false),
  featured: boolean("featured").notNull().default(false),
  hidePrice: boolean("hide_price").notNull().default(false),
  metaTitle: text("meta_title"),
  metaDescription: text("meta_description"),
  metaKeywords: text("meta_keywords"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertProductSchema = createInsertSchema(productsTable).omit({ id: true, createdAt: true });
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof productsTable.$inferSelect;
