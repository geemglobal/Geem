import { Router, type IRouter } from "express";
import { eq, ilike, and } from "drizzle-orm";
import {
  db,
  brandsTable,
  deviceModelsTable,
  categoriesTable,
  productsTable,
  vendorsTable,
  couriersTable,
  paymentMethodsTable,
} from "@workspace/db";
import { sql, count } from "drizzle-orm";

const router: IRouter = Router();

// --- BRANDS ---
router.get("/brands", async (req, res): Promise<void> => {
  const brands = await db.select().from(brandsTable).orderBy(brandsTable.name);
  const withCounts = await Promise.all(brands.map(async b => {
    const [r] = await db.select({ c: count() }).from(deviceModelsTable).where(eq(deviceModelsTable.brandId, b.id));
    return {
      ...b,
      description: b.description ?? null,
      modelsCount: r?.c ?? 0,
      createdAt: b.createdAt.toISOString(),
    };
  }));
  res.json(withCounts);
});

router.post("/brands", async (req, res): Promise<void> => {
  const { name, description, deviceIdMandatory, active } = req.body;
  if (!name) { res.status(400).json({ error: "Name required" }); return; }
  const [existing] = await db.select({ id: brandsTable.id }).from(brandsTable).where(ilike(brandsTable.name, name.trim()));
  if (existing) { res.status(409).json({ error: `Brand "${name}" already exists` }); return; }
  const [brand] = await db.insert(brandsTable).values({ name, description, deviceIdMandatory: !!deviceIdMandatory, active: active !== false }).returning();
  res.status(201).json({ ...brand, modelsCount: 0, createdAt: brand.createdAt.toISOString() });
});

router.get("/brands/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [brand] = await db.select().from(brandsTable).where(eq(brandsTable.id, id));
  if (!brand) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ ...brand, modelsCount: 0, createdAt: brand.createdAt.toISOString() });
});

router.patch("/brands/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { name, description, deviceIdMandatory, active } = req.body;
  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;
  if (deviceIdMandatory !== undefined) updates.deviceIdMandatory = deviceIdMandatory;
  if (active !== undefined) updates.active = active;
  const [brand] = await db.update(brandsTable).set(updates).where(eq(brandsTable.id, id)).returning();
  if (!brand) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ ...brand, modelsCount: 0, createdAt: brand.createdAt.toISOString() });
});

router.delete("/brands/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  await db.delete(brandsTable).where(eq(brandsTable.id, id));
  res.sendStatus(204);
});

// --- MODELS ---
router.get("/models", async (req, res): Promise<void> => {
  const brandId = req.query.brandId ? parseInt(String(req.query.brandId), 10) : undefined;
  const q = db.select({
    id: deviceModelsTable.id,
    brandId: deviceModelsTable.brandId,
    name: deviceModelsTable.name,
    description: deviceModelsTable.description,
    hasImei: deviceModelsTable.hasImei,
    hasDeviceId: deviceModelsTable.hasDeviceId,
    hasIccid: deviceModelsTable.hasIccid,
    hasMsisdn: deviceModelsTable.hasMsisdn,
    deviceIdMandatory: deviceModelsTable.deviceIdMandatory,
    warrantyDays: deviceModelsTable.warrantyDays,
    active: deviceModelsTable.active,
    createdAt: deviceModelsTable.createdAt,
    brandName: brandsTable.name,
  }).from(deviceModelsTable).leftJoin(brandsTable, eq(deviceModelsTable.brandId, brandsTable.id));
  const models = brandId ? await q.where(eq(deviceModelsTable.brandId, brandId)) : await q;
  res.json(models.map(m => ({ ...m, brandName: m.brandName ?? "", description: m.description ?? null, createdAt: m.createdAt.toISOString() })));
});

router.post("/models", async (req, res): Promise<void> => {
  const { brandId, name, description, hasImei, hasDeviceId, hasIccid, hasMsisdn, deviceIdMandatory, warrantyDays, active } = req.body;
  if (!brandId || !name) { res.status(400).json({ error: "brandId and name required" }); return; }
  const [existingModel] = await db.select({ id: deviceModelsTable.id }).from(deviceModelsTable).where(and(eq(deviceModelsTable.brandId, brandId), ilike(deviceModelsTable.name, name.trim())));
  if (existingModel) { res.status(409).json({ error: `Model "${name}" already exists for this brand` }); return; }
  const [model] = await db.insert(deviceModelsTable).values({ brandId, name, description, hasImei: hasImei !== false, hasDeviceId: !!hasDeviceId, hasIccid: !!hasIccid, hasMsisdn: !!hasMsisdn, deviceIdMandatory: !!deviceIdMandatory, warrantyDays: warrantyDays ?? 365, active: active !== false }).returning();
  const [brand] = await db.select().from(brandsTable).where(eq(brandsTable.id, brandId));
  res.status(201).json({ ...model, brandName: brand?.name ?? "", description: model.description ?? null, createdAt: model.createdAt.toISOString() });
});

router.patch("/models/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const updates: Record<string, unknown> = {};
  const fields = ["name", "description", "warrantyDays", "active", "hasImei", "hasDeviceId", "hasIccid", "hasMsisdn", "deviceIdMandatory"];
  for (const f of fields) if (req.body[f] !== undefined) updates[f] = req.body[f];
  const [model] = await db.update(deviceModelsTable).set(updates).where(eq(deviceModelsTable.id, id)).returning();
  if (!model) { res.status(404).json({ error: "Not found" }); return; }
  const [brand] = await db.select().from(brandsTable).where(eq(brandsTable.id, model.brandId));
  res.json({ ...model, brandName: brand?.name ?? "", description: model.description ?? null, createdAt: model.createdAt.toISOString() });
});

router.delete("/models/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  await db.delete(deviceModelsTable).where(eq(deviceModelsTable.id, id));
  res.sendStatus(204);
});

// --- CATEGORIES ---
router.get("/categories", async (req, res): Promise<void> => {
  const cats = await db.select().from(categoriesTable).orderBy(categoriesTable.name);
  // Count published products per category in one query
  const counts = await db
    .select({ categoryId: productsTable.categoryId, total: count() })
    .from(productsTable)
    .where(eq(productsTable.published, true))
    .groupBy(productsTable.categoryId);
  const countMap = new Map(counts.map(r => [r.categoryId, Number(r.total)]));
  res.json(cats.map(c => ({ ...c, parentName: null, productsCount: countMap.get(c.id) ?? 0, parentId: c.parentId ?? null })));
});

router.post("/categories", async (req, res): Promise<void> => {
  const { name, parentId, active } = req.body;
  if (!name) { res.status(400).json({ error: "Name required" }); return; }
  const [existingCat] = await db.select({ id: categoriesTable.id }).from(categoriesTable).where(ilike(categoriesTable.name, name.trim()));
  if (existingCat) { res.status(409).json({ error: `Category "${name}" already exists` }); return; }
  const [cat] = await db.insert(categoriesTable).values({ name, parentId: parentId ?? null, active: active !== false }).returning();
  res.status(201).json({ ...cat, parentName: null, productsCount: 0 });
});

router.patch("/categories/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const updates: Record<string, unknown> = {};
  if (req.body.name !== undefined) updates.name = req.body.name;
  if (req.body.parentId !== undefined) updates.parentId = req.body.parentId;
  if (req.body.active !== undefined) updates.active = req.body.active;
  const [cat] = await db.update(categoriesTable).set(updates).where(eq(categoriesTable.id, id)).returning();
  if (!cat) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ ...cat, parentName: null, productsCount: 0 });
});

router.delete("/categories/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  await db.delete(categoriesTable).where(eq(categoriesTable.id, id));
  res.sendStatus(204);
});

// --- VENDORS ---
router.get("/vendors", async (req, res): Promise<void> => {
  const vendors = await db.select().from(vendorsTable).orderBy(vendorsTable.name);
  res.json(vendors.map(v => ({ ...v, ledgerBalance: parseFloat(String(v.ledgerBalance)), createdAt: v.createdAt.toISOString(), contactPerson: v.contactPerson ?? null, phone: v.phone ?? null, email: v.email ?? null, address: v.address ?? null, taxNumber: v.taxNumber ?? null, paymentTerms: v.paymentTerms ?? null })));
});

router.post("/vendors", async (req, res): Promise<void> => {
  const { name, contactPerson, phone, email, address, taxNumber, paymentTerms } = req.body;
  if (!name) { res.status(400).json({ error: "Name required" }); return; }
  const [vendor] = await db.insert(vendorsTable).values({ name, contactPerson, phone, email, address, taxNumber, paymentTerms }).returning();
  res.status(201).json({ ...vendor, ledgerBalance: 0, createdAt: vendor.createdAt.toISOString() });
});

router.get("/vendors/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [vendor] = await db.select().from(vendorsTable).where(eq(vendorsTable.id, id));
  if (!vendor) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ ...vendor, ledgerBalance: parseFloat(String(vendor.ledgerBalance)), createdAt: vendor.createdAt.toISOString() });
});

router.patch("/vendors/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const updates: Record<string, unknown> = {};
  const fields = ["name", "contactPerson", "phone", "email", "address", "taxNumber", "paymentTerms", "active"];
  for (const f of fields) if (req.body[f] !== undefined) updates[f] = req.body[f];
  const [vendor] = await db.update(vendorsTable).set(updates).where(eq(vendorsTable.id, id)).returning();
  if (!vendor) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ ...vendor, ledgerBalance: parseFloat(String(vendor.ledgerBalance)), createdAt: vendor.createdAt.toISOString() });
});

router.delete("/vendors/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  await db.delete(vendorsTable).where(eq(vendorsTable.id, id));
  res.sendStatus(204);
});

// --- COURIERS ---
router.get("/couriers", async (req, res): Promise<void> => {
  const couriers = await db.select().from(couriersTable).orderBy(couriersTable.name);
  res.json(couriers.map(c => ({ ...c, ledgerBalance: parseFloat(String(c.ledgerBalance)), apiProvider: c.apiProvider ?? null, createdAt: c.createdAt.toISOString() })));
});

router.post("/couriers", async (req, res): Promise<void> => {
  const { name, apiProvider, apiKey, apiPassword, trackingUrl, active } = req.body;
  if (!name) { res.status(400).json({ error: "Name required" }); return; }
  const [courier] = await db.insert(couriersTable).values({ name, apiProvider, apiKey, apiPassword, trackingUrl, active: active !== false }).returning();
  res.status(201).json({ ...courier, ledgerBalance: 0, createdAt: courier.createdAt.toISOString() });
});

router.patch("/couriers/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const updates: Record<string, unknown> = {};
  if (req.body.name !== undefined) updates.name = req.body.name;
  if (req.body.active !== undefined) updates.active = req.body.active;
  if (req.body.apiProvider !== undefined) updates.apiProvider = req.body.apiProvider;
  if (req.body.apiKey !== undefined) updates.apiKey = req.body.apiKey;
  if (req.body.apiPassword !== undefined) updates.apiPassword = req.body.apiPassword;
  if (req.body.trackingUrl !== undefined) updates.trackingUrl = req.body.trackingUrl;
  const [courier] = await db.update(couriersTable).set(updates).where(eq(couriersTable.id, id)).returning();
  if (!courier) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ ...courier, ledgerBalance: parseFloat(String(courier.ledgerBalance)), createdAt: courier.createdAt.toISOString() });
});

router.delete("/couriers/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  await db.delete(couriersTable).where(eq(couriersTable.id, id));
  res.sendStatus(204);
});

// --- PAYMENT METHODS ---
router.get("/payment-methods", async (req, res): Promise<void> => {
  const pms = await db.select().from(paymentMethodsTable).orderBy(paymentMethodsTable.name);
  res.json(pms.map(p => ({ ...p, accountDetails: p.accountDetails ?? null })));
});

router.post("/payment-methods", async (req, res): Promise<void> => {
  const { name, type, active, accountDetails } = req.body;
  if (!name || !type) { res.status(400).json({ error: "Name and type required" }); return; }
  const [pm] = await db.insert(paymentMethodsTable).values({ name, type, active: active !== false, accountDetails }).returning();
  res.status(201).json(pm);
});

router.patch("/payment-methods/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const updates: Record<string, unknown> = {};
  const fields = ["name", "type", "active", "accountDetails"];
  for (const f of fields) if (req.body[f] !== undefined) updates[f] = req.body[f];
  const [pm] = await db.update(paymentMethodsTable).set(updates).where(eq(paymentMethodsTable.id, id)).returning();
  if (!pm) { res.status(404).json({ error: "Not found" }); return; }
  res.json(pm);
});

router.delete("/payment-methods/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  await db.delete(paymentMethodsTable).where(eq(paymentMethodsTable.id, id));
  res.sendStatus(204);
});

export default router;
