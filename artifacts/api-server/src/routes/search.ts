import { Router, type IRouter } from "express";
import { ilike, or, sql, eq } from "drizzle-orm";
import {
  db, inventoryItemsTable, brandsTable, deviceModelsTable,
  customersTable, invoicesTable, invoiceItemsTable,
} from "@workspace/db";

const router: IRouter = Router();

router.get("/search", async (req, res): Promise<void> => {
  const q = String(req.query.q ?? "").trim();
  if (!q || q.length < 2) { res.json({ inventory: [], customers: [], invoices: [] }); return; }

  const [inventoryItems, customers, invoices] = await Promise.all([
    db.select({
      id: inventoryItemsTable.id,
      imei: inventoryItemsTable.imei,
      deviceId: inventoryItemsTable.deviceId,
      psid: inventoryItemsTable.psid,
      status: inventoryItemsTable.status,
      ptaStatus: inventoryItemsTable.ptaStatus,
      sellingPrice: inventoryItemsTable.sellingPrice,
      purchaseDate: inventoryItemsTable.purchaseDate,
      brandName: brandsTable.name,
      modelName: deviceModelsTable.name,
      // Sale info (populated when sold)
      invoiceId: invoicesTable.id,
      invoiceNumber: invoicesTable.invoiceNumber,
      paymentStatus: invoicesTable.status,
      saleDate: invoicesTable.date,
      customerId: customersTable.id,
      customerName: customersTable.name,
      customerMobile: customersTable.mobile,
      customerCity: customersTable.city,
    })
    .from(inventoryItemsTable)
    .leftJoin(brandsTable, eq(inventoryItemsTable.brandId, brandsTable.id))
    .leftJoin(deviceModelsTable, eq(inventoryItemsTable.modelId, deviceModelsTable.id))
    .leftJoin(invoiceItemsTable, eq(invoiceItemsTable.inventoryItemId, inventoryItemsTable.id))
    .leftJoin(invoicesTable, eq(invoicesTable.id, invoiceItemsTable.invoiceId))
    .leftJoin(customersTable, eq(customersTable.id, invoicesTable.customerId))
    .where(
      or(
        ilike(inventoryItemsTable.imei, `%${q}%`),
        ilike(inventoryItemsTable.deviceId, `%${q}%`),
        ilike(inventoryItemsTable.psid, `%${q}%`),
        ilike(inventoryItemsTable.grnNumber, `%${q}%`),
        sql`${deviceModelsTable.name} ilike ${'%' + q + '%'}`,
        sql`${brandsTable.name} ilike ${'%' + q + '%'}`,
      )
    )
    .limit(20),

    db.select({
      id: customersTable.id,
      name: customersTable.name,
      phone: customersTable.mobile,
      email: customersTable.email,
      cnic: customersTable.cnic,
      city: customersTable.city,
      vehicleNumber: customersTable.vehicleNumber,
    })
    .from(customersTable)
    .where(
      or(
        ilike(customersTable.name, `%${q}%`),
        ilike(customersTable.mobile, `%${q}%`),
        ilike(customersTable.cnic, `%${q}%`),
        ilike(customersTable.email, `%${q}%`),
        ilike(customersTable.vehicleNumber, `%${q}%`),
      )
    )
    .limit(10),

    db.select({
      id: invoicesTable.id,
      invoiceNumber: invoicesTable.invoiceNumber,
      status: invoicesTable.status,
      total: invoicesTable.total,
      date: invoicesTable.date,
      customerId: invoicesTable.customerId,
    })
    .from(invoicesTable)
    .where(ilike(invoicesTable.invoiceNumber, `%${q}%`))
    .limit(10),
  ]);

  res.json({
    inventory: inventoryItems.map(i => ({
      id: i.id,
      imei: i.imei,
      deviceId: i.deviceId ?? null,
      psid: i.psid ?? null,
      status: i.status,
      ptaStatus: i.ptaStatus,
      sellingPrice: parseFloat(String(i.sellingPrice)),
      purchaseDate: String(i.purchaseDate),
      brandName: i.brandName ?? "",
      modelName: i.modelName ?? "",
      saleInfo: i.status === "sold" && i.customerId ? {
        invoiceId: i.invoiceId,
        invoiceNumber: i.invoiceNumber ?? null,
        paymentStatus: i.paymentStatus ?? null,
        saleDate: i.saleDate ? String(i.saleDate) : null,
        customerId: i.customerId,
        customerName: i.customerName ?? null,
        customerMobile: i.customerMobile ?? null,
        customerCity: i.customerCity ?? null,
      } : null,
    })),
    customers,
    invoices: invoices.map(i => ({
      ...i,
      total: parseFloat(String(i.total)),
      date: String(i.date),
    })),
  });
});

export default router;
