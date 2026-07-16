import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, importOrdersTable, importOrderItemsTable, grnTable, vendorsTable } from "@workspace/db";

const router: IRouter = Router();

async function buildImportOrder(io: typeof importOrdersTable.$inferSelect) {
  const items = await db.select().from(importOrderItemsTable).where(eq(importOrderItemsTable.importOrderId, io.id));
  const [vendor] = await db.select({ name: vendorsTable.name }).from(vendorsTable).where(eq(vendorsTable.id, io.vendorId));
  return {
    ...io,
    vendorName: vendor?.name ?? "",
    exchangeRate: parseFloat(String(io.exchangeRate)),
    subtotal: parseFloat(String(io.subtotal)),
    shippingCost: parseFloat(String(io.shippingCost)),
    total: parseFloat(String(io.total)),
    trackingNumber: io.trackingNumber ?? null,
    expectedArrival: io.expectedArrival ?? null,
    notes: io.notes ?? null,
    orderDate: String(io.orderDate),
    createdAt: io.createdAt.toISOString(),
    items: items.map(i => ({
      ...i, imei: null, taxRate: 0,
      qty: parseFloat(String(i.qty)), price: parseFloat(String(i.price)), amount: parseFloat(String(i.amount)),
    })),
  };
}

router.get("/procurement/imports", async (req, res): Promise<void> => {
  const orders = await db.select().from(importOrdersTable).orderBy(sql`${importOrdersTable.createdAt} desc`);
  res.json(await Promise.all(orders.map(buildImportOrder)));
});

router.post("/procurement/imports", async (req, res): Promise<void> => {
  const { vendorId, importOrderNumber, orderDate, expectedArrival, currency, exchangeRate, shippingCost, trackingNumber, items } = req.body;
  if (!vendorId || !currency) { res.status(400).json({ error: "vendorId and currency required" }); return; }
  const num = importOrderNumber || `IMP-${Date.now().toString().slice(-6)}`;
  const subtotal = (items ?? []).reduce((s: number, i: { qty: number; price: number }) => s + i.qty * i.price, 0);
  const totalShipping = parseFloat(String(shippingCost ?? 0));
  const [io] = await db.insert(importOrdersTable).values({
    importOrderNumber: num, vendorId, orderDate: orderDate ?? new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Karachi" }),
    expectedArrival, currency, exchangeRate: String(exchangeRate ?? 1),
    subtotal: String(subtotal), shippingCost: String(totalShipping),
    total: String(subtotal + totalShipping), paymentStatus: "pending", shipmentStatus: "pending", trackingNumber,
  }).returning();
  for (const item of (items ?? [])) {
    const qty = parseFloat(String(item.qty ?? 1));
    const price = parseFloat(String(item.price));
    await db.insert(importOrderItemsTable).values({ importOrderId: io.id, description: item.description, qty: String(qty), price: String(price), amount: String(qty * price) });
  }
  res.status(201).json(await buildImportOrder(io));
});

router.get("/procurement/imports/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [io] = await db.select().from(importOrdersTable).where(eq(importOrdersTable.id, id));
  if (!io) { res.status(404).json({ error: "Not found" }); return; }
  res.json(await buildImportOrder(io));
});

router.patch("/procurement/imports/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const updates: Record<string, unknown> = {};
  const fields = ["paymentStatus", "shipmentStatus", "trackingNumber", "expectedArrival"];
  for (const f of fields) if (req.body[f] !== undefined) updates[f] = req.body[f];
  const [io] = await db.update(importOrdersTable).set(updates).where(eq(importOrdersTable.id, id)).returning();
  if (!io) { res.status(404).json({ error: "Not found" }); return; }
  res.json(await buildImportOrder(io));
});

// GRN
router.get("/procurement/grn", async (req, res): Promise<void> => {
  const grns = await db.select().from(grnTable).orderBy(sql`${grnTable.createdAt} desc`);
  const result = await Promise.all(grns.map(async g => {
    const [io] = await db.select({ num: importOrdersTable.importOrderNumber }).from(importOrdersTable).where(eq(importOrdersTable.id, g.importOrderId));
    return {
      ...g,
      importOrderNumber: io?.num ?? "",
      receivedDate: String(g.receivedDate),
      itemsCount: 0,
      createdAt: g.createdAt.toISOString(),
    };
  }));
  res.json(result);
});

router.post("/procurement/grn", async (req, res): Promise<void> => {
  const { importOrderId, receivedDate } = req.body;
  if (!importOrderId || !receivedDate) { res.status(400).json({ error: "importOrderId and receivedDate required" }); return; }
  const num = `GRN-${Date.now().toString().slice(-6)}`;
  const [grn] = await db.insert(grnTable).values({ grnNumber: num, importOrderId, receivedDate, status: "complete" }).returning();
  const [io] = await db.select({ num: importOrdersTable.importOrderNumber }).from(importOrdersTable).where(eq(importOrdersTable.id, importOrderId));
  res.status(201).json({ ...grn, importOrderNumber: io?.num ?? "", receivedDate: String(grn.receivedDate), itemsCount: 0, createdAt: grn.createdAt.toISOString() });
});

export default router;
