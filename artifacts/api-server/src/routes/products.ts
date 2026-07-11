import { Router, type IRouter } from "express";
import { eq, ilike, and, count, sql } from "drizzle-orm";
import { db, productsTable, brandsTable, categoriesTable } from "@workspace/db";

const router: IRouter = Router();

async function buildProduct(p: typeof productsTable.$inferSelect) {
  const [brand] = p.brandId ? await db.select({ name: brandsTable.name }).from(brandsTable).where(eq(brandsTable.id, p.brandId)) : [null];
  const [cat] = p.categoryId ? await db.select({ name: categoriesTable.name }).from(categoriesTable).where(eq(categoriesTable.id, p.categoryId)) : [null];

  let gallery: string[] = [];
  if (p.galleryImages) {
    try { gallery = JSON.parse(p.galleryImages); } catch { gallery = []; }
  }

  return {
    ...p,
    brandName: brand?.name ?? null,
    categoryName: cat?.name ?? null,
    price: parseFloat(String(p.price)),
    salePrice: p.salePrice ? parseFloat(String(p.salePrice)) : null,
    costPrice: p.costPrice ? parseFloat(String(p.costPrice)) : null,
    shortDescription: p.shortDescription ?? null,
    longDescription: p.longDescription ?? null,
    featuredImage: p.featuredImage ?? null,
    galleryImages: gallery,
    metaTitle: p.metaTitle ?? null,
    metaDescription: p.metaDescription ?? null,
    metaKeywords: p.metaKeywords ?? null,
    brandId: p.brandId ?? null,
    categoryId: p.categoryId ?? null,
    // BUG FIX: was hardcoded to 0 — now reflects live stockQty from DB
    stockCount: p.stockQty ?? 0,
    createdAt: p.createdAt.toISOString(),
  };
}

router.get("/products", async (req, res): Promise<void> => {
  const page = parseInt(String(req.query.page ?? "1"), 10);
  const limit = 50;
  const offset = (page - 1) * limit;
  const search = String(req.query.search ?? "");
  const published = req.query.published;
  const categoryId = req.query.categoryId ? parseInt(String(req.query.categoryId), 10) : undefined;
  const brandId = req.query.brandId ? parseInt(String(req.query.brandId), 10) : undefined;

  const conditions = [];
  if (search) conditions.push(ilike(productsTable.title, `%${search}%`));
  if (published === "true") conditions.push(eq(productsTable.published, true));
  if (published === "false") conditions.push(eq(productsTable.published, false));
  if (categoryId) conditions.push(eq(productsTable.categoryId, categoryId));
  if (brandId) conditions.push(eq(productsTable.brandId, brandId));
  const where = conditions.length ? and(...conditions) : undefined;

  const [{ total }] = await db.select({ total: count() }).from(productsTable).where(where);
  const products = await db.select().from(productsTable).where(where).limit(limit).offset(offset).orderBy(sql`${productsTable.createdAt} desc`);

  res.json({ products: await Promise.all(products.map(buildProduct)), total, page });
});

router.post("/products", async (req, res): Promise<void> => {
  const { title, slug, brandId, categoryId, price, salePrice, shortDescription, longDescription, featuredImage, galleryImages, tags, stockQty, published, featured, hidePrice, metaTitle, metaDescription, metaKeywords, sku, barcode } = req.body;
  if (!title || !price) { res.status(400).json({ error: "title and price required" }); return; }
  const finalSlug = slug || title.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  const [product] = await db.insert(productsTable).values({
    title, slug: finalSlug, brandId, categoryId,
    price: String(price), salePrice: salePrice ? String(salePrice) : null,
    shortDescription, longDescription, featuredImage,
    galleryImages: galleryImages ?? null,
    tags: tags ?? null, stockQty: stockQty ?? 0,
    published: !!published, featured: !!featured, hidePrice: !!hidePrice,
    metaTitle, metaDescription, metaKeywords,
    sku: sku ?? null, barcode: barcode ?? null,
  }).returning();
  res.status(201).json(await buildProduct(product));
});

router.get("/products/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, id));
  if (!product) { res.status(404).json({ error: "Not found" }); return; }
  res.json(await buildProduct(product));
});

router.patch("/products/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const updates: Record<string, unknown> = {};
  const fields = ["title", "slug", "price", "salePrice", "costPrice", "shortDescription", "longDescription", "featuredImage", "galleryImages", "published", "featured", "hidePrice", "metaTitle", "metaDescription", "metaKeywords", "brandId", "categoryId", "tags", "stockQty", "sku", "barcode"];
  for (const f of fields) if (req.body[f] !== undefined) updates[f] = req.body[f];
  if (updates.price) updates.price = String(updates.price);
  if (updates.salePrice) updates.salePrice = String(updates.salePrice);
  if (updates.costPrice) updates.costPrice = String(updates.costPrice);
  const [product] = await db.update(productsTable).set(updates).where(eq(productsTable.id, id)).returning();
  if (!product) { res.status(404).json({ error: "Not found" }); return; }
  res.json(await buildProduct(product));
});

router.delete("/products/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  await db.delete(productsTable).where(eq(productsTable.id, id));
  res.sendStatus(204);
});

export default router;
