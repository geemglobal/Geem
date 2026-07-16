import { Router, type IRouter } from "express";
import { eq, count, sql, or, isNull, and, ilike } from "drizzle-orm";
import { db, webOrdersTable, webOrderItemsTable, webOrderReturnsTable, customersTable, walletTransactionsTable, invoicesTable, invoiceItemsTable, paymentsTable, productsTable, inventoryItemsTable, deviceModelsTable, ledgerEntriesTable, couriersTable } from "@workspace/db";
import { buildInvoicePrintHtml } from "./invoices";
import { desc } from "drizzle-orm";
import { sendPushToAdmins, sendPushToUser } from "../lib/push";
import { sendOrderConfirmation, sendShippingNotification, sendOrderStatusUpdate, sendAdminAlert } from "../lib/mailer";
import { sendSms, sendWhatsApp } from "../lib/sms";
import { logger } from "../lib/logger";
import { pakToday } from "../lib/format";

const router: IRouter = Router();

// ─── Ledger helpers (mirrors invoices.ts) ────────────────────────────────────
async function recalculateCustomerLedger(customerId: number): Promise<void> {
  const entries = await db.select()
    .from(ledgerEntriesTable)
    .where(eq(ledgerEntriesTable.customerId, customerId))
    .orderBy(ledgerEntriesTable.date, ledgerEntriesTable.id);
  let running = 0;
  for (const e of entries) {
    running += parseFloat(String(e.debit)) - parseFloat(String(e.credit));
    await db.update(ledgerEntriesTable).set({ balance: String(running) }).where(eq(ledgerEntriesTable.id, e.id));
  }
  await db.update(customersTable).set({ ledgerBalance: String(running) }).where(eq(customersTable.id, customerId));
}

async function addLedgerEntry(opts: {
  customerId: number; type: string; description: string;
  reference: string; debit: number; credit: number; date: Date;
}): Promise<void> {
  if (!opts.customerId) return;
  await db.insert(ledgerEntriesTable).values({
    customerId: opts.customerId, type: opts.type, description: opts.description,
    reference: opts.reference, debit: String(opts.debit), credit: String(opts.credit),
    balance: "0", date: opts.date,
  });
  await recalculateCustomerLedger(opts.customerId);
}
// ─────────────────────────────────────────────────────────────────────────────

// Recounts in_stock inventory for a brand+model and pushes the number to the
// matching shop product so the live stock counter stays accurate.
async function syncProductStock(brandId: number, modelId: number): Promise<void> {
  const [{ newStock }] = await db.select({ newStock: count() })
    .from(inventoryItemsTable)
    .where(and(eq(inventoryItemsTable.brandId, brandId), eq(inventoryItemsTable.modelId, modelId), eq(inventoryItemsTable.status, "in_stock")));

  const [model] = await db.select({ name: deviceModelsTable.name })
    .from(deviceModelsTable).where(eq(deviceModelsTable.id, modelId));
  if (!model) return;

  await db.update(productsTable)
    .set({ stockQty: newStock })
    .where(and(eq(productsTable.brandId, brandId), ilike(productsTable.title, `%${model.name}%`)));
}

async function buildWebOrder(wo: typeof webOrdersTable.$inferSelect) {
  const items = await db.select().from(webOrderItemsTable).where(eq(webOrderItemsTable.webOrderId, wo.id));
  const [inv] = await db.select({ id: invoicesTable.id, status: invoicesTable.status, paid: invoicesTable.paid, total: invoicesTable.total })
    .from(invoicesTable).where(eq(invoicesTable.invoiceNumber, wo.orderNumber));
  return {
    ...wo,
    subtotal: parseFloat(String(wo.subtotal)),
    shipping: parseFloat(String(wo.shipping)),
    total: parseFloat(String(wo.total)),
    customerEmail: wo.customerEmail ?? null,
    transactionId: wo.transactionId ?? null,
    courierCn: wo.courierCn ?? null,
    rejectionReason: wo.rejectionReason ?? null,
    createdAt: wo.createdAt.toISOString(),
    invoiceId: inv?.id ?? null,
    invoiceStatus: inv?.status ?? null,
    invoicePaid: inv ? parseFloat(String(inv.paid)) : null,
    invoiceTotal: inv ? parseFloat(String(inv.total)) : null,
    items: items.map(i => ({
      ...i, imei: null, taxRate: 0,
      qty: parseFloat(String(i.qty)), price: parseFloat(String(i.price)), amount: parseFloat(String(i.amount)),
    })),
  };
}

// Creates real invoice for a shop order (called on "shipped"). IMEI/inventory data
// is baked into invoice items at creation time if already available.
async function createOrUpdateWebOrderInvoice(
  wo: typeof webOrdersTable.$inferSelect,
  itemImeis?: { itemIndex: number; imei: string }[],
  inventoryItemIds?: { itemIndex: number; inventoryItemId: number }[],
): Promise<number | null> {
  try {
    const [existing] = await db.select({ id: invoicesTable.id })
      .from(invoicesTable).where(or(eq(invoicesTable.webOrderId, wo.id), eq(invoicesTable.invoiceNumber, wo.orderNumber)));

    if (existing) return existing.id; // already created

    const today = pakToday();
    const subtotal = parseFloat(String(wo.subtotal));
    const shipping = parseFloat(String(wo.shipping));
    const total = parseFloat(String(wo.total));
    const isPrepaid = ["wallet", "bank", "easypaisa", "jazzcash"].includes(wo.paymentMethod ?? "");

    // Find or create CRM customer by mobile
    let customerId: number;
    const rawMob = (wo.customerMobile ?? "").replace(/\D/g, "");
    const mobLocal = rawMob.startsWith("92") ? `0${rawMob.slice(2)}` : rawMob;
    const [existingCrm] = await db.select({ id: customersTable.id })
      .from(customersTable).where(or(eq(customersTable.mobile, mobLocal), eq(customersTable.mobile, rawMob), eq(customersTable.mobile, wo.customerMobile)));
    if (existingCrm) {
      customerId = existingCrm.id;
    } else {
      const [created] = await db.insert(customersTable).values({
        name: wo.customerName, mobile: mobLocal || wo.customerMobile,
        email: wo.customerEmail ?? undefined,
        address: wo.customerAddress ?? undefined,
        city: wo.customerCity ?? undefined,
      }).returning({ id: customersTable.id });
      customerId = created.id;
    }

    const [inv] = await db.insert(invoicesTable).values({
      invoiceNumber: wo.orderNumber,
      webOrderId: wo.id,
      status: isPrepaid ? "paid" : "draft",
      date: today,
      customerId,
      subtotal: String(subtotal),
      shipping: String(shipping),
      total: String(total),
      paid: isPrepaid ? String(total) : "0",
      walletAmountUsed: wo.paymentMethod === "wallet" ? String(total) : "0",
      notes: `Shop order — paid via ${wo.paymentMethod}${wo.transactionId ? ` (Txn: ${wo.transactionId})` : ""}`,
    }).returning();

    const orderItems = await db.select().from(webOrderItemsTable)
      .where(eq(webOrderItemsTable.webOrderId, wo.id));

    // Group by itemIndex
    const imeiGroups = new Map<number, string[]>();
    for (const x of itemImeis ?? []) {
      const list = imeiGroups.get(x.itemIndex) ?? [];
      list.push(x.imei);
      imeiGroups.set(x.itemIndex, list);
    }
    const invIdGroups = new Map<number, number[]>();
    for (const x of inventoryItemIds ?? []) {
      const list = invIdGroups.get(x.itemIndex) ?? [];
      list.push(x.inventoryItemId);
      invIdGroups.set(x.itemIndex, list);
    }

    for (let idx = 0; idx < orderItems.length; idx++) {
      const item = orderItems[idx];
      const assignedIds = invIdGroups.get(idx) ?? [];
      const manualImeis = imeiGroups.get(idx) ?? [];
      const itemPrice = parseFloat(String(item.price));

      if (assignedIds.length > 0 || manualImeis.length > 0) {
        // One invoice line per inventory unit so each shows its own IMEI/device ID
        for (const invId of assignedIds) {
          await db.insert(invoiceItemsTable).values({
            invoiceId: inv.id, description: item.description,
            qty: "1", price: item.price, amount: String(itemPrice), taxRate: "0",
            inventoryItemId: invId,
          });
        }
        // One line per manually-typed IMEI
        for (const imei of manualImeis) {
          await db.insert(invoiceItemsTable).values({
            invoiceId: inv.id, description: item.description,
            qty: "1", price: item.price, amount: String(itemPrice), taxRate: "0",
            imei,
          });
        }
        // If qty > assigned units, add a remainder line
        const totalQty = parseFloat(String(item.qty));
        const assigned = assignedIds.length + manualImeis.length;
        if (assigned < totalQty) {
          const remaining = totalQty - assigned;
          await db.insert(invoiceItemsTable).values({
            invoiceId: inv.id, description: item.description,
            qty: String(remaining), price: item.price,
            amount: String(itemPrice * remaining), taxRate: "0",
          });
        }
      } else {
        // No inventory assignment — regular line item
        await db.insert(invoiceItemsTable).values({
          invoiceId: inv.id, description: item.description,
          qty: item.qty, price: item.price, amount: item.amount, taxRate: "0",
        });
      }
    }

    if (isPrepaid) {
      await db.insert(paymentsTable).values({
        invoiceId: inv.id,
        date: today,
        method: wo.paymentMethod ?? "bank",
        amount: String(total),
        transactionId: wo.transactionId ?? undefined,
        memo: `Shop order ${wo.orderNumber}`,
      });
    }

    // ── Ledger entries ──────────────────────────────────────────────────────
    const now = new Date();
    // Debit: customer charged for the order
    await addLedgerEntry({
      customerId, type: "invoice",
      description: `Shop order ${wo.orderNumber} — ${wo.customerName}`,
      reference: wo.orderNumber, debit: total, credit: 0, date: now,
    });
    // Credit: payment received immediately for prepaid orders
    if (isPrepaid) {
      await addLedgerEntry({
        customerId, type: "payment",
        description: `${wo.paymentMethod} payment for ${wo.orderNumber}`,
        reference: wo.orderNumber, debit: 0, credit: total, date: now,
      });
    }
    // ────────────────────────────────────────────────────────────────────────
    return inv.id;
  } catch (err) {
    logger.error({ err }, "createOrUpdateWebOrderInvoice failed");
    return null;
  }
}

// Kept for backfill endpoint compatibility
async function createWebOrderInvoice(wo: typeof webOrdersTable.$inferSelect): Promise<number | null> {
  return createOrUpdateWebOrderInvoice(wo);
}

router.get("/web-orders/track", async (req, res): Promise<void> => {
  const orderNumber = String(req.query.orderNumber ?? "");
  if (!orderNumber) { res.status(400).json({ error: "orderNumber required" }); return; }
  const [wo] = await db.select().from(webOrdersTable).where(eq(webOrdersTable.orderNumber, orderNumber));
  if (!wo) { res.status(404).json({ error: "Order not found" }); return; }
  res.json(await buildWebOrder(wo));
});

router.get("/web-orders", async (req, res): Promise<void> => {
  const page = parseInt(String(req.query.page ?? "1"), 10);
  const limit = 50;
  const offset = (page - 1) * limit;
  const status = String(req.query.status ?? "");

  const [{ total }] = await db.select({ total: count() }).from(webOrdersTable);
  let orders = await db.select().from(webOrdersTable).orderBy(sql`${webOrdersTable.createdAt} desc`).limit(limit).offset(offset);
  if (status) orders = orders.filter(o => o.status === status);

  const [s1] = await db.select({ c: count() }).from(webOrdersTable).where(eq(webOrdersTable.status, "new"));
  const [s2] = await db.select({ c: count() }).from(webOrdersTable).where(eq(webOrdersTable.status, "confirmed"));
  const [s3] = await db.select({ c: count() }).from(webOrdersTable).where(eq(webOrdersTable.status, "shipped"));
  const [s4] = await db.select({ c: count() }).from(webOrdersTable).where(eq(webOrdersTable.status, "delivered"));

  res.json({
    orders: await Promise.all(orders.map(buildWebOrder)),
    total,
    page,
    summary: { new: s1.c, confirmed: s2.c, processing: 0, shipped: s3.c, delivered: s4.c, cancelled: 0 },
  });
});

router.get("/web-orders/returns", async (req, res): Promise<void> => {
  const status = String(req.query.status ?? "");
  const rows = status
    ? await db.select().from(webOrderReturnsTable).where(eq(webOrderReturnsTable.status, status)).orderBy(desc(webOrderReturnsTable.createdAt))
    : await db.select().from(webOrderReturnsTable).orderBy(desc(webOrderReturnsTable.createdAt));
  res.json(rows);
});

router.patch("/web-orders/returns/:id", async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  const { status, adminNotes, refundAmount } = req.body as { status?: string; adminNotes?: string; refundAmount?: number };

  const [existing] = await db.select().from(webOrderReturnsTable).where(eq(webOrderReturnsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (status) patch["status"] = status;
  if (adminNotes !== undefined) patch["adminNotes"] = adminNotes;
  const refAmt = parseFloat(String(refundAmount ?? 0));
  if (refAmt > 0) patch["refundAmount"] = String(refAmt);

  const [row] = await db.update(webOrderReturnsTable).set(patch).where(eq(webOrderReturnsTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }

  // Auto-credit wallet when completing with a refund amount.
  // Guard: check DB for an existing transaction so we never double-credit,
  // even if the admin re-saves a return that was previously completed but
  // the credit failed (e.g. no CRM customer existed at the time).
  const alreadyCredited = refAmt > 0 && status === "completed"
    ? await db.select({ id: walletTransactionsTable.id })
        .from(walletTransactionsTable)
        .where(eq(walletTransactionsTable.reference, existing.orderNumber))
        .then(rows => rows.length > 0)
    : false;
  const shouldRefund = refAmt > 0
    && status === "completed"
    && !alreadyCredited;

  let walletCredited = false;
  if (shouldRefund) {
    const conditions = [];
    if (existing.customerEmail) conditions.push(eq(customersTable.email, existing.customerEmail));
    if (existing.customerMobile) conditions.push(eq(customersTable.mobile, existing.customerMobile));
    if (conditions.length > 0) {
      let customer = await db.select({ id: customersTable.id, walletBalance: customersTable.walletBalance })
        .from(customersTable).where(or(...conditions)).then(rows => rows[0] ?? null);

      // Auto-create a CRM customer record if none exists — ensures wallet credit always lands
      if (!customer) {
        const [newCustomer] = await db.insert(customersTable).values({
          name: existing.customerName,
          mobile: existing.customerMobile,
          email: existing.customerEmail ?? undefined,
          type: "individual",
        }).returning({ id: customersTable.id, walletBalance: customersTable.walletBalance });
        customer = newCustomer ?? null;
      }

      if (customer) {
        const prev = parseFloat(String(customer.walletBalance ?? "0"));
        const newBalance = prev + refAmt;
        await db.update(customersTable).set({ walletBalance: String(newBalance) }).where(eq(customersTable.id, customer.id));
        await db.insert(walletTransactionsTable).values({
          customerId: customer.id,
          type: "credit",
          amount: String(refAmt),
          balanceAfter: String(newBalance),
          description: `Return refund for order ${existing.orderNumber}`,
          reference: existing.orderNumber,
        });
        walletCredited = true;
      }
    }
  }

  if (status && row.customerEmail) {
    const statusLabels: Record<string, string> = {
      approved: "✅ Return Approved",
      rejected: "❌ Return Rejected",
      completed: "✔ Return Completed",
    };
    const label = statusLabels[status];
    if (label) {
      sendPushToUser("shop", row.customerEmail, {
        title: label,
        body: walletCredited
          ? `Your return for order ${row.orderNumber} is ${status}. Rs ${refAmt.toLocaleString()} refunded to your wallet.`
          : `Your return request for order ${row.orderNumber} has been ${status}.`,
        url: "/shop/account",
        tag: `return-${row.orderNumber}`,
      }).catch(() => {});
    }
  }

  res.json({ ...row, refundAmount: row.refundAmount ? parseFloat(String(row.refundAmount)) : null, walletCredited });
});

// Return available in-stock inventory items.
// ?productId=X  → filter by product's brand (used on dialog open)
// ?q=text        → text search across all in-stock inventory by IMEI/deviceId/model
router.get("/web-orders/inventory-for-product", async (req, res): Promise<void> => {
  const productId = parseInt(String(req.query.productId ?? ""), 10);
  const q = String(req.query.q ?? "").trim();

  const conditions: ReturnType<typeof eq>[] = [eq(inventoryItemsTable.status, "in_stock") as ReturnType<typeof eq>];
  let limit = 200;

  if (q) {
    // Broad text search — ignore brand filter so admin can find any device
    conditions.push(or(
      ilike(inventoryItemsTable.imei, `%${q}%`),
      ilike(inventoryItemsTable.deviceId, `%${q}%`),
      ilike(inventoryItemsTable.iccid, `%${q}%`),
      ilike(deviceModelsTable.name, `%${q}%`),
    ) as ReturnType<typeof eq>);
    limit = 20;
  } else if (!isNaN(productId) && productId > 0) {
    const [product] = await db.select({ brandId: productsTable.brandId })
      .from(productsTable).where(eq(productsTable.id, productId));
    if (!product?.brandId) { res.json([]); return; }
    conditions.push(eq(inventoryItemsTable.brandId, product.brandId) as ReturnType<typeof eq>);
  } else {
    res.json([]); return;
  }

  const items = await db
    .select({
      id: inventoryItemsTable.id,
      imei: inventoryItemsTable.imei,
      deviceId: inventoryItemsTable.deviceId,
      iccid: inventoryItemsTable.iccid,
      modelName: deviceModelsTable.name,
      sellingPrice: inventoryItemsTable.sellingPrice,
    })
    .from(inventoryItemsTable)
    .innerJoin(deviceModelsTable, eq(inventoryItemsTable.modelId, deviceModelsTable.id))
    .where(and(...conditions))
    .limit(limit);

  res.json(items.map(i => ({
    id: i.id,
    imei: i.imei,
    deviceId: i.deviceId ?? null,
    iccid: i.iccid ?? null,
    modelName: i.modelName,
    sellingPrice: parseFloat(String(i.sellingPrice)),
  })));
});

router.get("/web-orders/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [wo] = await db.select().from(webOrdersTable).where(eq(webOrdersTable.id, id));
  if (!wo) { res.status(404).json({ error: "Not found" }); return; }
  res.json(await buildWebOrder(wo));
});

// Admin: backfill CRM invoices for all web orders that don't have one yet
router.post("/web-orders/backfill-invoices", async (req, res): Promise<void> => {
  const allOrders = await db.select().from(webOrdersTable);
  let created = 0;
  let skipped = 0;
  for (const wo of allOrders) {
    const [existing] = await db.select({ id: invoicesTable.id })
      .from(invoicesTable).where(eq(invoicesTable.invoiceNumber, wo.orderNumber));
    if (existing) { skipped++; continue; }
    await createWebOrderInvoice(wo);
    created++;
  }
  res.json({ created, skipped, total: allOrders.length });
});

router.patch("/web-orders/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const updates: Record<string, unknown> = {};
  const fields = ["status", "paymentStatus", "courierCn", "rejectionReason"];
  for (const f of fields) if (req.body[f] !== undefined) updates[f] = req.body[f];
  const [wo] = await db.update(webOrdersTable).set(updates).where(eq(webOrdersTable.id, id)).returning();
  if (!wo) { res.status(404).json({ error: "Not found" }); return; }

  // Alert admin on confirmation
  if (req.body.status === "confirmed") {
    sendAdminAlert({
      subject: `New Order Confirmed — #${wo.orderNumber}`,
      html: `<p>Order <strong>#${wo.orderNumber}</strong> confirmed for <strong>${wo.customerName}</strong> (${wo.paymentMethod?.toUpperCase()}) — Rs ${parseFloat(String(wo.total)).toLocaleString()}</p>`,
    }).catch(() => {});

    const confItems = await db.select().from(webOrderItemsTable).where(eq(webOrderItemsTable.webOrderId, wo.id));

    if (wo.customerEmail) {
      sendOrderConfirmation({
        customerName: wo.customerName,
        customerEmail: wo.customerEmail,
        orderNumber: wo.orderNumber,
        paymentMethod: wo.paymentMethod,
        total: parseFloat(String(wo.total)),
        items: confItems.map(i => ({ description: i.description, qty: parseInt(String(i.qty), 10), amount: parseFloat(String(i.amount)) })),
        shippingAddress: [wo.customerAddress, wo.customerCity].filter(Boolean).join(", "),
      }).catch(() => {});
    }

    if (wo.customerMobile) {
      const isCOD = wo.paymentMethod?.toLowerCase().includes("cod");
      const payNote = isCOD
        ? `Payment: Cash on Delivery — please have Rs ${parseFloat(String(wo.total)).toLocaleString("en-PK")} ready.`
        : `Payment: Received ✅`;
      const confItemLines = confItems.map(i => `  - ${i.description} x${i.qty} — Rs ${parseFloat(String(i.amount)).toLocaleString("en-PK")}`).join("\n");
      const confMsg = `Assalam-o-Alaikum *${wo.customerName}*! 🎉\n\nYour order from Geem.pk has been confirmed! ✅\n\nOrder #${wo.orderNumber}\n${payNote}\nShipping to: ${[wo.customerAddress, wo.customerCity].filter(Boolean).join(", ")}\n\nItems:\n${confItemLines}\n\nTotal: Rs ${parseFloat(String(wo.total)).toLocaleString("en-PK")}\n\nTrack at: https://geem.pk/track\nQuestions? WhatsApp: +92 307-8680005\n\nThank you for shopping with Geem ❤️`;
      sendWhatsApp(wo.customerMobile, confMsg).catch(() => {});
      sendSms(wo.customerMobile, confMsg).catch(() => {});
    }
  }

  // On shipping: mark inventory sold → find manually-created CRM invoice → notify customer
  // IMPORTANT: We NEVER auto-create invoices here. The admin creates the proper invoice
  // manually in erp.geem.pk/invoices with correct prices. We only look it up and link it.
  if (req.body.status === "shipped") {
    const inventoryAssignments: { itemIndex: number; inventoryItemIds: number[] }[] = Array.isArray(req.body.inventoryAssignments)
      ? (req.body.inventoryAssignments as { itemIndex: number; inventoryItemIds: number[] }[])
      : [];

    // Mark assigned inventory items as sold, collect brand+model for stock sync.
    // Only update items that are currently in_stock to prevent double-selling.
    // Track which IDs were successfully sold so only those are included in the invoice.
    const affectedPairs = new Map<string, { brandId: number; modelId: number }>();
    const soldInvIds = new Set<number>(); // IDs that were actually transitioned to "sold" this request
    for (const a of inventoryAssignments) {
      for (const invId of a.inventoryItemIds) {
        const [item] = await db.select({ brandId: inventoryItemsTable.brandId, modelId: inventoryItemsTable.modelId, status: inventoryItemsTable.status })
          .from(inventoryItemsTable).where(eq(inventoryItemsTable.id, invId));
        if (!item || item.status !== "in_stock") continue; // skip already-sold or missing items
        await db.update(inventoryItemsTable).set({ status: "sold" }).where(
          and(eq(inventoryItemsTable.id, invId), eq(inventoryItemsTable.status, "in_stock"))
        );
        affectedPairs.set(`${item.brandId}-${item.modelId}`, item);
        soldInvIds.add(invId);
      }
    }

    // Sync shop product stock for every affected brand+model
    for (const pair of affectedPairs.values()) {
      await syncProductStock(pair.brandId, pair.modelId);
      logger.info({ brandId: pair.brandId, modelId: pair.modelId }, "Synced product stock after order shipped");
    }

    // Fetch order items first (needed for notifications)
    const shipItems = await db.select().from(webOrderItemsTable).where(eq(webOrderItemsTable.webOrderId, wo.id));

    // Build flat inventory/IMEI lists — only include IDs that were successfully sold this request
    // to prevent already-sold units appearing in new invoices.
    const rawAssignments: { itemIndex: number; inventoryItemIds: number[] }[] = Array.isArray(req.body.inventoryAssignments)
      ? req.body.inventoryAssignments : [];
    const flatInvIds: { itemIndex: number; inventoryItemId: number }[] = [];
    for (const a of rawAssignments) {
      for (const id of a.inventoryItemIds) {
        if (soldInvIds.has(id)) flatInvIds.push({ itemIndex: a.itemIndex, inventoryItemId: id });
      }
    }

    const rawItemImeis: { itemIndex: number; imeis: string[] }[] = Array.isArray(req.body.itemImeis)
      ? req.body.itemImeis : [];
    const flatImeis: { itemIndex: number; imei: string }[] = [];
    for (const x of rawItemImeis) {
      for (const imei of x.imeis) flatImeis.push({ itemIndex: x.itemIndex, imei });
    }

    // Create invoice (with per-unit IMEI lines) — idempotent, skips if already exists
    const invoiceId = await createOrUpdateWebOrderInvoice(wo, flatImeis, flatInvIds);
    const existingInv = invoiceId ? { id: invoiceId } : null;
    if (invoiceId) logger.info({ invoiceId, orderNumber: wo.orderNumber }, "Invoice created/found for shipped order");

    const crmInvoice = existingInv;
    const invoiceUrl = crmInvoice?.id
      ? `https://geem.pk/api/invoices/${crmInvoice.id}/print`
      : null;
    const invoiceHtml = crmInvoice?.id
      ? await buildInvoicePrintHtml(crmInvoice.id).catch(() => null)
      : null;

    // Resolve courier tracking URL if courierId provided by frontend
    const courierId = req.body.courierId ? parseInt(String(req.body.courierId)) : null;
    let courierTrackingUrl: string | null = null;
    let courierName: string | null = null;
    if (courierId) {
      const [courierRow] = await db.select({ name: couriersTable.name, trackingUrl: couriersTable.trackingUrl })
        .from(couriersTable).where(eq(couriersTable.id, courierId));
      if (courierRow) {
        courierName = courierRow.name;
        if (courierRow.trackingUrl && wo.courierCn) {
          courierTrackingUrl = courierRow.trackingUrl.replace(/\{cn\}/gi, wo.courierCn);
        }
      }
    }

    // Build WhatsApp/SMS message
    const cnLine = wo.courierCn
      ? `\nTracking/CN: *${wo.courierCn}*${courierName ? ` (${courierName})` : ""}${courierTrackingUrl ? `\nTrack here: ${courierTrackingUrl}` : ""}`
      : "";
    const trackingLine = cnLine;
    const invoiceLine = invoiceUrl ? `\n\nView/Download Invoice:\n${invoiceUrl}` : "";
    const itemLines = shipItems.map(i => `  - ${i.description} x${i.qty} — Rs ${parseFloat(String(i.amount)).toLocaleString("en-PK")}`).join("\n");
    const msgBody = `Assalam-o-Alaikum *${wo.customerName}*! 🎉\n\nYour order from Geem.pk has been shipped! 🚚\n\nOrder #${wo.orderNumber}${trackingLine}\nShipping to: ${[wo.customerAddress, wo.customerCity].filter(Boolean).join(", ")}\n\nItems:\n${itemLines}\n\nTotal: Rs ${parseFloat(String(wo.total)).toLocaleString("en-PK")}${invoiceLine}\n\nTrack at: https://geem.pk/track\nQuestions? WhatsApp: +92 307-8680005\n\nThank you for shopping with Geem ❤️`;

    if (wo.customerEmail) {
      sendShippingNotification({
        customerName: wo.customerName,
        customerEmail: wo.customerEmail,
        orderNumber: wo.orderNumber,
        trackingNumber: wo.courierCn ?? undefined,
        trackingUrl: courierTrackingUrl ?? undefined,
        courierName: courierName ?? undefined,
        shippingAddress: [wo.customerAddress, wo.customerCity].filter(Boolean).join(", "),
        items: shipItems.map(i => ({
          description: i.description,
          qty: parseInt(String(i.qty), 10),
          amount: parseFloat(String(i.amount)),
        })),
        subtotal: parseFloat(String(wo.subtotal)),
        shipping: parseFloat(String(wo.shipping ?? 0)),
        total: parseFloat(String(wo.total)),
        invoiceUrl: invoiceUrl ?? undefined,
        invoiceHtml: invoiceHtml ?? undefined,
      }).catch(() => {});
    }

    if (wo.customerMobile) {
      sendWhatsApp(wo.customerMobile, msgBody).catch(() => {});
      sendSms(wo.customerMobile, msgBody).catch(() => {});
    }
  }

  // Send status-change email + WhatsApp + SMS for other statuses
  if (["processing", "delivered", "cancelled", "rejected"].includes(req.body.status)) {
    const [inv] = await db.select({ id: invoicesTable.id }).from(invoicesTable)
      .where(or(eq(invoicesTable.webOrderId, wo.id), eq(invoicesTable.invoiceNumber, wo.orderNumber)));
    const statusInvoiceUrl = inv?.id ? `https://geem.pk/api/invoices/${inv.id}/print` : undefined;

    if (wo.customerEmail) {
      sendOrderStatusUpdate({
        customerName: wo.customerName,
        customerEmail: wo.customerEmail,
        orderNumber: wo.orderNumber,
        status: req.body.status as "processing" | "delivered" | "cancelled" | "rejected",
        rejectionReason: wo.rejectionReason ?? null,
        invoiceUrl: req.body.status === "delivered" ? statusInvoiceUrl : undefined,
      }).catch(() => {});
    }

    if (wo.customerMobile) {
      const statusEmoji: Record<string, string> = { processing: "⚙️", delivered: "📦", cancelled: "❌", rejected: "🚫" };
      const emoji = statusEmoji[req.body.status] ?? "📋";
      const statusText = (req.body.status as string).charAt(0).toUpperCase() + (req.body.status as string).slice(1);
      const invoicePart = req.body.status === "delivered" && statusInvoiceUrl
        ? `\n\nView/Download Invoice:\n${statusInvoiceUrl}`
        : "";
      const rejPart = req.body.status === "rejected" && wo.rejectionReason
        ? `\nReason: ${wo.rejectionReason}`
        : "";
      const thankYou = ["delivered"].includes(req.body.status)
        ? `\n\nThank you for shopping with Geem ❤️`
        : "";
      const statusMsg = `Assalam-o-Alaikum *${wo.customerName}*! 🎉\n\nYour order from Geem.pk has been ${statusText.toLowerCase()}! ${emoji}\n\nOrder #${wo.orderNumber}${rejPart}\nShipping to: ${[wo.customerAddress, wo.customerCity].filter(Boolean).join(", ")}\n\nTotal: Rs ${parseFloat(String(wo.total)).toLocaleString("en-PK")}${invoicePart}\n\nTrack at: https://geem.pk/track\nQuestions? WhatsApp: +92 307-8680005${thankYou}`;
      sendWhatsApp(wo.customerMobile, statusMsg).catch(() => {});
      sendSms(wo.customerMobile, statusMsg).catch(() => {});
    }
  }

  if (req.body.status && wo.customerEmail) {
    const statusLabels: Record<string, string> = {
      confirmed: "✅ Order Confirmed",
      processing: "⚙️ Order Processing",
      shipped: "🚚 Order Shipped",
      delivered: "📦 Order Delivered",
      cancelled: "❌ Order Cancelled",
    };
    const statusLabel = statusLabels[req.body.status];
    if (statusLabel) {
      sendPushToUser("shop", wo.customerEmail, {
        title: statusLabel,
        body: `Your order ${wo.orderNumber} has been ${req.body.status}.`,
        url: "/shop/account",
        tag: `order-${wo.orderNumber}`,
      }).catch(() => {});
    }
  }

  res.json(await buildWebOrder(wo));
});

// COD cash collection: records payment on the invoice, marks it paid, updates order paymentStatus
router.post("/web-orders/:id/collect-cod", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { amount, method, memo } = req.body as { amount?: number; method?: string; memo?: string };

  const [wo] = await db.select().from(webOrdersTable).where(eq(webOrdersTable.id, id));
  if (!wo) { res.status(404).json({ error: "Order not found" }); return; }
  if (wo.paymentMethod !== "cod") { res.status(400).json({ error: "Order is not COD" }); return; }

  const [inv] = await db.select().from(invoicesTable).where(eq(invoicesTable.invoiceNumber, wo.orderNumber));
  if (!inv) { res.status(404).json({ error: "No invoice found for this order" }); return; }
  if (inv.status === "paid") { res.status(400).json({ error: "Invoice already marked as paid" }); return; }

  const collected = amount ?? parseFloat(String(inv.total));
  const today = pakToday();

  await db.insert(paymentsTable).values({
    invoiceId: inv.id,
    date: today,
    method: method ?? "cash",
    amount: String(collected),
    memo: memo ?? `COD collection — order ${wo.orderNumber}`,
  });

  await db.update(invoicesTable)
    .set({ status: "paid", paid: String(collected) })
    .where(eq(invoicesTable.id, inv.id));

  await db.update(webOrdersTable)
    .set({ paymentStatus: "paid" })
    .where(eq(webOrdersTable.id, id));

  // Ledger credit: COD payment received
  await addLedgerEntry({
    customerId: inv.customerId, type: "payment",
    description: `COD collection for shop order ${wo.orderNumber}`,
    reference: wo.orderNumber, debit: 0, credit: collected, date: new Date(),
  });

  res.json({ success: true, collected, invoiceId: inv.id, orderNumber: wo.orderNumber });
});

export default router;
