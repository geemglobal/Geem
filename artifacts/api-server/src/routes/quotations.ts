import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, quotationsTable, quotationItemsTable, customersTable, invoicesTable, invoiceItemsTable, invoiceSettingsTable, paymentsTable } from "@workspace/db";

const router: IRouter = Router();

async function buildQuotation(q: typeof quotationsTable.$inferSelect) {
  const items = await db.select().from(quotationItemsTable).where(eq(quotationItemsTable.quotationId, q.id));
  const [customer] = await db.select({
    name: customersTable.name,
    mobile: customersTable.mobile,
    address: customersTable.address,
    city: customersTable.city,
  }).from(customersTable).where(eq(customersTable.id, q.customerId));
  return {
    ...q,
    currency: q.currency ?? "PKR",
    currencySymbol: q.currencySymbol ?? "Rs",
    customerName: customer?.name ?? "",
    customerPhone: customer?.mobile ?? null,
    customerAddress: customer?.address ?? null,
    customerCity: customer?.city ?? null,
    subtotal: parseFloat(String(q.subtotal)),
    discount: parseFloat(String(q.discount)),
    tax: parseFloat(String(q.tax)),
    total: parseFloat(String(q.total)),
    notes: q.notes ?? null,
    expiryDate: q.expiryDate ?? null,
    date: String(q.date),
    createdAt: q.createdAt.toISOString(),
    items: items.map(i => ({
      ...i,
      imei: i.imei ?? null,
      inventoryItemId: i.inventoryItemId ?? null,
      deviceId: i.deviceId ?? null,
      ptaStatus: i.ptaStatus ?? null,
      qty: parseFloat(String(i.qty)),
      price: parseFloat(String(i.price)),
      taxRate: parseFloat(String(i.taxRate)),
      amount: parseFloat(String(i.amount)),
    })),
  };
}

router.get("/quotations", async (req, res): Promise<void> => {
  const status = String(req.query.status ?? "");
  const customerId = req.query.customerId ? parseInt(String(req.query.customerId), 10) : undefined;
  let quotations = await db.select().from(quotationsTable).orderBy(sql`${quotationsTable.createdAt} desc`).limit(200);
  if (status) quotations = quotations.filter(q => q.status === status);
  if (customerId) quotations = quotations.filter(q => q.customerId === customerId);
  res.json(await Promise.all(quotations.map(buildQuotation)));
});

router.post("/quotations", async (req, res): Promise<void> => {
  const { customerId, date, expiryDate, items, discount, tax, notes, currency, currencySymbol } = req.body;
  if (!customerId || !date || !items?.length) {
    res.status(400).json({ error: "customerId, date, items required" });
    return;
  }
  const [settings] = await db.select().from(invoiceSettingsTable);
  const num = (settings?.nextInvoiceNumber ?? 100) + 5000;
  const qNumber = `QT-${String(num).padStart(4, "0")}`;
  const subtotal = items.reduce((s: number, i: { qty: number; price: number }) => s + i.qty * i.price, 0);
  const total = subtotal - parseFloat(String(discount ?? 0)) + parseFloat(String(tax ?? 0));

  const [quotation] = await db.insert(quotationsTable).values({
    quotationNumber: qNumber, customerId, date, expiryDate, status: "draft",
    subtotal: String(subtotal), discount: String(discount ?? 0), tax: String(tax ?? 0),
    total: String(total), notes,
    currency: currency ?? "PKR",
    currencySymbol: currencySymbol ?? "Rs",
  }).returning();

  for (const item of items) {
    const qty = parseFloat(String(item.qty ?? 1));
    const price = parseFloat(String(item.price));
    await db.insert(quotationItemsTable).values({
      quotationId: quotation.id, description: item.description,
      imei: item.imei ?? null, inventoryItemId: item.inventoryItemId ?? null,
      deviceId: item.deviceId ?? null, ptaStatus: item.ptaStatus ?? null,
      qty: String(qty), price: String(price),
      taxRate: String(item.taxRate ?? 0), amount: String(qty * price),
    });
  }
  res.status(201).json(await buildQuotation(quotation));
});

router.get("/quotations/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [q] = await db.select().from(quotationsTable).where(eq(quotationsTable.id, id));
  if (!q) { res.status(404).json({ error: "Not found" }); return; }
  res.json(await buildQuotation(q));
});

router.put("/quotations/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { customerId, date, expiryDate, items, discount, tax, notes, currency, currencySymbol } = req.body;
  if (!customerId || !date || !items?.length) {
    res.status(400).json({ error: "customerId, date, items required" });
    return;
  }
  const subtotal = items.reduce((s: number, i: { qty: number; price: number }) => s + i.qty * i.price, 0);
  const total = subtotal - parseFloat(String(discount ?? 0)) + parseFloat(String(tax ?? 0));

  const [q] = await db.update(quotationsTable).set({
    customerId, date, expiryDate: expiryDate ?? null,
    subtotal: String(subtotal), discount: String(discount ?? 0),
    tax: String(tax ?? 0), total: String(total), notes,
    currency: currency ?? "PKR", currencySymbol: currencySymbol ?? "Rs",
  }).where(eq(quotationsTable.id, id)).returning();
  if (!q) { res.status(404).json({ error: "Not found" }); return; }

  await db.delete(quotationItemsTable).where(eq(quotationItemsTable.quotationId, id));
  for (const item of items) {
    const qty = parseFloat(String(item.qty ?? 1));
    const price = parseFloat(String(item.price));
    await db.insert(quotationItemsTable).values({
      quotationId: id, description: item.description,
      imei: item.imei ?? null, inventoryItemId: item.inventoryItemId ?? null,
      deviceId: item.deviceId ?? null, ptaStatus: item.ptaStatus ?? null,
      qty: String(qty), price: String(price),
      taxRate: String(item.taxRate ?? 0), amount: String(qty * price),
    });
  }
  res.json(await buildQuotation(q));
});

router.patch("/quotations/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const updates: Record<string, unknown> = {};
  if (req.body.status !== undefined) updates.status = req.body.status;
  if (req.body.expiryDate !== undefined) updates.expiryDate = req.body.expiryDate;
  if (req.body.notes !== undefined) updates.notes = req.body.notes;
  const [q] = await db.update(quotationsTable).set(updates).where(eq(quotationsTable.id, id)).returning();
  if (!q) { res.status(404).json({ error: "Not found" }); return; }
  res.json(await buildQuotation(q));
});

router.delete("/quotations/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  await db.delete(quotationItemsTable).where(eq(quotationItemsTable.quotationId, id));
  await db.delete(quotationsTable).where(eq(quotationsTable.id, id));
  res.sendStatus(204);
});

router.post("/quotations/:id/convert-invoice", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [q] = await db.select().from(quotationsTable).where(eq(quotationsTable.id, id));
  if (!q) { res.status(404).json({ error: "Not found" }); return; }

  const [settings] = await db.select().from(invoiceSettingsTable);
  const prefix = settings?.invoicePrefix ?? "INV";
  const num = settings?.nextInvoiceNumber ?? 1001;
  if (settings) await db.update(invoiceSettingsTable).set({ nextInvoiceNumber: num + 1 }).where(eq(invoiceSettingsTable.id, settings.id));
  const invNumber = `${prefix}-${String(num).padStart(4, "0")}`;

  const [inv] = await db.insert(invoicesTable).values({
    invoiceNumber: invNumber, customerId: q.customerId,
    date: new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Karachi" }),
    status: "draft", subtotal: q.subtotal, discount: q.discount,
    tax: q.tax, shipping: "0", total: q.total, paid: "0", notes: q.notes,
    currency: q.currency ?? "PKR", currencySymbol: q.currencySymbol ?? "Rs",
  }).returning();

  const items = await db.select().from(quotationItemsTable).where(eq(quotationItemsTable.quotationId, id));
  for (const item of items) {
    await db.insert(invoiceItemsTable).values({
      invoiceId: inv.id, description: item.description,
      imei: item.imei ?? null, qty: item.qty, price: item.price,
      taxRate: item.taxRate, amount: item.amount,
      inventoryItemId: item.inventoryItemId ?? null,
    });
  }
  await db.update(quotationsTable).set({ status: "accepted" }).where(eq(quotationsTable.id, id));
  res.status(201).json({ id: inv.id, invoiceNumber: inv.invoiceNumber });
});


export default router;
