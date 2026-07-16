import { Router, type IRouter } from "express";
import { eq, and, count, sum, sql, desc, inArray } from "drizzle-orm";
import {
  db, invoicesTable, invoiceItemsTable, paymentsTable, posDraftsTable,
  customersTable, inventoryItemsTable, invoiceSettingsTable, companySettingsTable,
  brandsTable, deviceModelsTable, ledgerEntriesTable, walletTransactionsTable,
  webOrdersTable,
} from "@workspace/db";
import { sendInvoiceEmail } from "../lib/mailer";
import { sendSms, sendWhatsApp } from "../lib/sms";
import { toWaPhone } from "../lib/format";

const router: IRouter = Router();

// Shared inline logo paths (all 5 paths) — used in HTML email/print templates
const _GEEM_LOGO_PATHS = `<path transform="translate(1635,135)" d="m0 0h32l23 4 18 6 16 8 14 10 10 9 8 8 3 4v2l5-3 9-9 13-10 13-8 16-8 16-6 23-5 14-2h36l25 4 17 5 20 9 15 10 14 12 11 13 10 15 8 17 7 23 3 17 1 11v252h-103l-1-232-3-16-5-12-6-10-7-8-10-7-12-5-10-2h-22l-14 3-12 5-11 7-8 7-9 13-6 13-3 11-1 7-1 24v201l-1 1h-102l-1-229-3-18-5-13-7-11-5-6-11-8-12-5-10-2h-22l-18 4-14 7-11 9-9 11-7 14-4 14-2 16-1 217h-103l-1-1v-380h103v36l8-7 11-9 16-10 17-8 16-5z" fill="#EC2029"/><path transform="translate(1195,134)" d="m0 0h35l24 3 25 6 17 6 19 9 17 11 14 11 14 14 11 14 9 14 8 15 9 23 5 19 3 18 1 11v45l-1 11-2 1h-290l7 21 8 15 8 10 12 12 13 8 13 6 15 4 13 2h26l22-4 15-5 19-10 14-11 10-10 7-9 5 2 15 9 28 17 24 15 6 4-7 11-11 13-9 10-11 10-16 12-17 10-19 9-24 8-26 5-27 3h-29l-25-3-20-4-27-9-16-8-14-8-11-8-10-8-19-19-10-13-12-20-10-22-6-19-4-19-3-27v-24l3-26 6-25 8-20 8-17 12-19 12-14 9-10 7-7 14-11 15-10 19-10 24-9 21-5zm2 85-20 4-16 7-11 7-12 11-10 13-9 17-3 10h186l-3-12-8-16-8-11-12-12-13-8-14-6-12-3-7-1z" fill="#EC2029"/><path transform="translate(769,134)" d="m0 0h36l23 3 22 5 18 6 16 7 17 10 17 13 18 18 13 17 11 19 10 24 6 21 3 17 2 25v18l-1 25-2 3h-291l7 20 9 17 9 11 8 8 15 10 11 5 17 5 13 2h26l23-4 19-7 16-9 11-9 4-2 2-4 5-5 7-9 4 1 28 17 26 16 19 12 1 2-9 13-11 13-12 12-11 9-14 10-14 8-16 8-27 9-25 5-28 3h-28l-25-3-20-4-17-5-21-9-17-9-19-14-12-11-8-8-11-14-7-10-9-16-7-15-6-18-5-20-3-22-1-25 2-24 4-22 6-20 8-19 9-17 11-16 11-13 8-9 8-7 15-12 18-11 16-8 21-8 21-5zm2 85-16 3-16 6-13 8-9 7-7 8-8 10-8 16-3 8v3h185l-2-10-7-16-8-11-9-10-12-9-17-8-14-4-8-1z" fill="#EC2029"/><path transform="translate(278,4)" d="m0 0h13l27 2 10 1-2 4-9 9-7 8-28 28-7 8-21 21-7 8-3 3-29 10-23 12-14 10-11 9-15 15-13 17-9 15-9 19-6 18-5 25-1 8v28l3 21 6 23 9 21 8 15 10 14 11 13 10 10 14 11 10 7 14 8 24 10 23 6 18 3h34l24-4 20-6 18-8 16-9 16-12 10-9 11-11 9-11 11-17 2-4-33-1-32-32v-2h-2l-7-8-12-12-5-4-7-8-16-16v-1h224v21l-3 23-6 27-8 24-12 26-11 19-12 17-8 10-12 14-14 14-8 7-18 14-19 12-23 12-19 8-26 8-20 4-15 2-13 1h-41l-18-2-24-5-20-6-20-8-23-11-19-12-11-8-14-11-13-12-13-13-9-11-10-13-10-15-12-22-10-23-8-26-5-23-2-15-1-13v-30l2-20 4-23 7-25 8-21 10-21 12-20 14-19 12-14 21-21 14-11 17-12 19-11 23-11 25-9 29-7 24-3z" fill="#EC2029"/><path transform="translate(402,33)" d="m0 0 6 1 24 14 11 8 13 10 13 12 3 2-2 4-12 13-43 43-2 3-4-1-11-10-15-11-14-8-14-7-16-6 2-4 15-15 7-8 23-23 7-8z" fill="#EC2029"/>`;
const _GEEM_LOGO_SVG_BANNER = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2048 550" width="210" height="57">${_GEEM_LOGO_PATHS}</svg>`;
const _GEEM_LOGO_SVG_SLIP = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2048 550" width="180" height="48">${_GEEM_LOGO_PATHS}</svg>`;


// ─── helpers ─────────────────────────────────────────────────────────────────

async function getNextInvoiceNumber(prefix?: string): Promise<string> {
  const [settings] = await db.select().from(invoiceSettingsTable);
  const p = prefix ?? settings?.invoicePrefix ?? "INV";
  const num = settings?.nextInvoiceNumber ?? 1001;
  if (settings) {
    await db.update(invoiceSettingsTable).set({ nextInvoiceNumber: num + 1 }).where(eq(invoiceSettingsTable.id, settings.id));
  }
  return `${p}-${String(num).padStart(4, "0")}`;
}

async function buildInvoice(inv: typeof invoicesTable.$inferSelect) {
  const rawItems = await db.select().from(invoiceItemsTable).where(eq(invoiceItemsTable.invoiceId, inv.id));
  const payments = await db.select().from(paymentsTable).where(eq(paymentsTable.invoiceId, inv.id));
  const [customer] = await db.select({
    name: customersTable.name, phone: customersTable.mobile, email: customersTable.email,
    city: customersTable.city, address: customersTable.address,
  }).from(customersTable).where(eq(customersTable.id, inv.customerId));

  // For web-order invoices, use the shipping address from the order (not the CRM profile)
  let shippingOverride: { name?: string; phone?: string; address?: string; city?: string } = {};
  let orderPaymentMethod: string | null = null;
  if (inv.webOrderId) {
    const [wo] = await db.select({
      customerName: webOrdersTable.customerName,
      customerMobile: webOrdersTable.customerMobile,
      customerAddress: webOrdersTable.customerAddress,
      customerCity: webOrdersTable.customerCity,
      paymentMethod: webOrdersTable.paymentMethod,
    }).from(webOrdersTable).where(eq(webOrdersTable.id, inv.webOrderId));
    if (wo) {
      shippingOverride = {
        name: wo.customerName || undefined,
        phone: wo.customerMobile || undefined,
        address: wo.customerAddress || undefined,
        city: wo.customerCity || undefined,
      };
      orderPaymentMethod = wo.paymentMethod ?? null;
    }
  }
  const total = parseFloat(String(inv.total));
  const paid = parseFloat(String(inv.paid));

  const items = await Promise.all(rawItems.map(async (i) => {
    let brandName: string | null = null;
    let modelName: string | null = null;
    let deviceId: string | null = null;
    let ptaStatus: string | null = null;

    let imei: string | null = i.imei ?? null;
    let iccid: string | null = null;

    if (i.inventoryItemId) {
      const [inv_item] = await db.select({
        imei: inventoryItemsTable.imei,
        deviceId: inventoryItemsTable.deviceId,
        iccid: inventoryItemsTable.iccid,
        ptaStatus: inventoryItemsTable.ptaStatus,
        brandId: inventoryItemsTable.brandId,
        modelId: inventoryItemsTable.modelId,
      }).from(inventoryItemsTable).where(eq(inventoryItemsTable.id, i.inventoryItemId));

      if (inv_item) {
        // Prefer IMEI from the inventory record (source of truth); fall back to what was saved on the line item
        imei = inv_item.imei ?? imei;
        deviceId = inv_item.deviceId ?? null;
        iccid = inv_item.iccid ?? null;
        ptaStatus = inv_item.ptaStatus;
        // If iccid is not set but imei looks like an ICCID (starts with "89", length > 15), treat it as one
        if (!iccid && imei && imei.startsWith("89") && imei.length > 15) {
          iccid = imei;
          imei = null;
        }
        const [brand] = await db.select({ name: brandsTable.name }).from(brandsTable).where(eq(brandsTable.id, inv_item.brandId));
        const [model] = await db.select({ name: deviceModelsTable.name }).from(deviceModelsTable).where(eq(deviceModelsTable.id, inv_item.modelId));
        brandName = brand?.name ?? null;
        modelName = model?.name ?? null;
      }
    }

    return {
      ...i,
      imei,
      iccid,
      inventoryItemId: i.inventoryItemId ?? null,
      qty: parseFloat(String(i.qty)),
      price: parseFloat(String(i.price)),
      taxRate: parseFloat(String(i.taxRate)),
      amount: parseFloat(String(i.amount)),
      brandName, modelName, deviceId, ptaStatus,
    };
  }));

  return {
    ...inv,
    customerName: shippingOverride.name ?? customer?.name ?? "",
    customerEmail: customer?.email ?? null,
    customerPhone: shippingOverride.phone ?? customer?.phone ?? null,
    customerCity: shippingOverride.city ?? customer?.city ?? null,
    customerAddress: shippingOverride.address ?? customer?.address ?? null,
    subtotal: parseFloat(String(inv.subtotal)),
    discount: parseFloat(String(inv.discount)),
    tax: parseFloat(String(inv.tax)),
    shipping: parseFloat(String(inv.shipping)),
    total, paid,
    balanceDue: total - paid,
    notes: inv.notes ?? null,
    dueDate: inv.dueDate ?? null,
    date: String(inv.date),
    createdAt: inv.createdAt.toISOString(),
    orderPaymentMethod,
    items,
    payments: payments.map(p => ({
      ...p,
      amount: parseFloat(String(p.amount)),
      transactionId: p.transactionId ?? null,
      memo: p.memo ?? null,
      date: String(p.date),
      createdAt: p.createdAt.toISOString(),
    })),
  };
}

/**
 * Recalculate running balances for ALL ledger entries of a customer (ordered by
 * date asc, id asc). Updates every entry's balance column and syncs
 * customer.ledgerBalance to the final running total.
 */
async function recalculateCustomerLedger(customerId: number): Promise<void> {
  const entries = await db.select()
    .from(ledgerEntriesTable)
    .where(eq(ledgerEntriesTable.customerId, customerId))
    .orderBy(ledgerEntriesTable.date, ledgerEntriesTable.id);

  let running = 0;
  for (const e of entries) {
    running += parseFloat(String(e.debit)) - parseFloat(String(e.credit));
    await db.update(ledgerEntriesTable)
      .set({ balance: String(running) })
      .where(eq(ledgerEntriesTable.id, e.id));
  }

  await db.update(customersTable)
    .set({ ledgerBalance: String(running) })
    .where(eq(customersTable.id, customerId));
}

/**
 * Insert a ledger entry then re-run running-balance recalculation for that
 * customer so every entry's balance is always correct.
 */
async function addLedgerEntry(opts: {
  customerId: number;
  type: string;
  description: string;
  reference: string;
  debit: number;
  credit: number;
  date: Date;
}): Promise<void> {
  if (!opts.customerId) return;
  await db.insert(ledgerEntriesTable).values({
    customerId: opts.customerId,
    type: opts.type,
    description: opts.description,
    reference: opts.reference,
    debit: String(opts.debit),
    credit: String(opts.credit),
    balance: "0",
    date: opts.date,
  });
  await recalculateCustomerLedger(opts.customerId);
}

// ─── routes ──────────────────────────────────────────────────────────────────

router.get("/invoices", async (req, res): Promise<void> => {
  const page = parseInt(String(req.query.page ?? "1"), 10);
  const limit = parseInt(String(req.query.limit ?? "50"), 10);
  const offset = (page - 1) * limit;
  const status = String(req.query.status ?? "");

  const conditions = [];
  if (status) conditions.push(eq(invoicesTable.status, status));
  if (req.query.customerId) conditions.push(eq(invoicesTable.customerId, parseInt(String(req.query.customerId), 10)));
  const where = conditions.length ? and(...conditions) : undefined;

  const [{ total }] = await db.select({ total: count() }).from(invoicesTable).where(where);
  const invoices = await db.select().from(invoicesTable).where(where).limit(limit).offset(offset).orderBy(sql`${invoicesTable.createdAt} desc`);

  const [overdueSum]   = await db.select({ v: sum(invoicesTable.total) }).from(invoicesTable).where(eq(invoicesTable.status, "overdue"));
  const [overdueCount] = await db.select({ c: count() }).from(invoicesTable).where(eq(invoicesTable.status, "overdue"));
  const [draftSum]     = await db.select({ v: sum(invoicesTable.total) }).from(invoicesTable).where(eq(invoicesTable.status, "draft"));
  const [paidSum]      = await db.select({ v: sum(invoicesTable.total) }).from(invoicesTable).where(eq(invoicesTable.status, "paid"));

  const built = await Promise.all(invoices.map(buildInvoice));
  res.json({
    invoices: built, total, page, limit,
    summary: {
      overdue: parseFloat(String(overdueSum.v ?? "0")),
      overdueCount: overdueCount.c,
      draft: parseFloat(String(draftSum.v ?? "0")),
      unpaid: 0,
      paid: parseFloat(String(paidSum.v ?? "0")),
    },
  });
});

router.post("/invoices", async (req, res): Promise<void> => {
  const { customerId, date, dueDate, items, discount, tax, shipping, notes, status, invoiceNumber, currency, currencySymbol, walletAmountUsed, paymentMethod } = req.body;
  if (!customerId || !date || !items?.length) {
    res.status(400).json({ error: "customerId, date, items required" });
    return;
  }
  const invNumber = invoiceNumber || (await getNextInvoiceNumber());

  // Pre-check: ensure every linked inventory item is still in_stock before creating the invoice.
  // Uses parameterised inArray() — never sql.raw — to prevent SQL injection from request body values.
  const inventoryItemIds = (items as { inventoryItemId?: number }[])
    .map(i => i.inventoryItemId)
    .filter((id): id is number => id !== undefined && Number.isInteger(id) && id > 0);
  if (inventoryItemIds.length > 0) {
    const stockedItems = await db
      .select({ id: inventoryItemsTable.id })
      .from(inventoryItemsTable)
      .where(and(
        inArray(inventoryItemsTable.id, inventoryItemIds),
        eq(inventoryItemsTable.status, "in_stock"),
      ));
    if (stockedItems.length !== inventoryItemIds.length) {
      const stockedIds = new Set(stockedItems.map(r => r.id));
      const alreadySold = inventoryItemIds.filter(id => !stockedIds.has(id));
      res.status(409).json({ error: "One or more inventory items are no longer available", alreadySold });
      return;
    }
  }

  const subtotal = items.reduce((s: number, i: { qty: number; price: number }) => s + i.qty * i.price, 0);
  const totalDiscount = parseFloat(String(discount ?? 0));
  const totalTax = parseFloat(String(tax ?? 0));
  const totalShipping = parseFloat(String(shipping ?? 0));
  const total = subtotal - totalDiscount + totalTax + totalShipping;

  // Wallet: clamp to available balance and total
  let walletUsed = parseFloat(String(walletAmountUsed ?? 0));
  if (walletUsed > 0 && customerId) {
    const [cust] = await db.select({ walletBalance: customersTable.walletBalance })
      .from(customersTable).where(eq(customersTable.id, customerId));
    const available = parseFloat(String(cust?.walletBalance ?? "0"));
    walletUsed = Math.min(walletUsed, available, total);
  }
  walletUsed = Math.max(0, walletUsed);

  // If a paymentMethod is given and wallet doesn't cover everything, the remainder was paid at POS
  const cashPortion = paymentMethod && walletUsed < total ? Math.max(0, total - walletUsed) : 0;
  const paidAmount = walletUsed + cashPortion;
  const derivedStatus = status ?? (paidAmount >= total && total > 0 ? "paid" : "draft");

  const [inv] = await db.insert(invoicesTable).values({
    invoiceNumber: invNumber,
    customerId, date, dueDate,
    status: derivedStatus,
    subtotal: String(subtotal),
    discount: String(totalDiscount),
    tax: String(totalTax),
    shipping: String(totalShipping),
    total: String(total),
    paid: String(paidAmount),
    walletAmountUsed: String(walletUsed),
    currency: currency ?? "PKR",
    currencySymbol: currencySymbol ?? "Rs",
    notes,
  }).returning();

  for (const item of items) {
    const qty = parseFloat(String(item.qty ?? 1));
    const price = parseFloat(String(item.price));
    const taxRate = parseFloat(String(item.taxRate ?? 0));
    const amount = qty * price;
    await db.insert(invoiceItemsTable).values({
      invoiceId: inv.id,
      description: item.description,
      imei: item.imei,
      inventoryItemId: item.inventoryItemId,
      qty: String(qty), price: String(price), taxRate: String(taxRate), amount: String(amount),
    });
    if (item.inventoryItemId) {
      await db.update(inventoryItemsTable).set({ status: "sold" }).where(eq(inventoryItemsTable.id, item.inventoryItemId));
    }
  }

  // Deduct wallet balance and record transaction
  if (walletUsed > 0) {
    const [cust] = await db.select({ walletBalance: customersTable.walletBalance })
      .from(customersTable).where(eq(customersTable.id, customerId));
    const prev = parseFloat(String(cust?.walletBalance ?? "0"));
    const newWallet = Math.max(0, prev - walletUsed);
    await db.update(customersTable)
      .set({ walletBalance: String(newWallet) })
      .where(eq(customersTable.id, customerId));
    await db.insert(walletTransactionsTable).values({
      customerId,
      type: "debit",
      amount: String(walletUsed),
      balanceAfter: String(newWallet),
      description: `Used on Invoice ${invNumber}`,
      reference: invNumber,
    });
  }

  // Payment records in paymentsTable
  if (walletUsed > 0) {
    await db.insert(paymentsTable).values({
      invoiceId: inv.id,
      date: String(date),
      method: "wallet",
      amount: String(walletUsed),
      memo: "Wallet deduction",
    });
  }
  if (cashPortion > 0 && paymentMethod) {
    await db.insert(paymentsTable).values({
      invoiceId: inv.id,
      date: String(date),
      method: String(paymentMethod),
      amount: String(cashPortion),
    });
  }

  // Ledger: debit for invoice, credit for payments if any
  if (customerId && total > 0) {
    const [cust] = await db.select({ name: customersTable.name }).from(customersTable).where(eq(customersTable.id, customerId));
    await addLedgerEntry({
      customerId,
      type: "invoice",
      description: `Invoice ${invNumber}${cust ? ` — ${cust.name}` : ""}`,
      reference: invNumber,
      debit: total,
      credit: 0,
      date: new Date(String(date)),
    });
    if (walletUsed > 0) {
      await addLedgerEntry({
        customerId,
        type: "payment",
        description: `Wallet payment — Invoice ${invNumber}`,
        reference: invNumber,
        debit: 0,
        credit: walletUsed,
        date: new Date(String(date)),
      });
    }
    if (cashPortion > 0 && paymentMethod) {
      await addLedgerEntry({
        customerId,
        type: "payment",
        description: `${String(paymentMethod)} payment — Invoice ${invNumber}`,
        reference: invNumber,
        debit: 0,
        credit: cashPortion,
        date: new Date(String(date)),
      });
    }
  }

  // Auto-notify customer with invoice link (fire-and-forget)
  if (customerId) {
    db.select({ email: customersTable.email, name: customersTable.name })
      .from(customersTable).where(eq(customersTable.id, customerId))
      .then(async ([cust]) => {
        if (!cust?.email) return;
        const builtItems = items.map((i: { description: string; qty: number; price: number; taxRate?: number }) => ({
          description: i.description,
          qty: parseFloat(String(i.qty ?? 1)),
          amount: parseFloat(String(i.qty ?? 1)) * parseFloat(String(i.price)),
        }));
        await sendInvoiceEmail({
          customerName: cust.name,
          customerEmail: cust.email,
          invoiceNumber: invNumber,
          date: String(date),
          status: derivedStatus,
          items: builtItems,
          subtotal,
          discount: totalDiscount,
          tax: totalTax,
          shipping: totalShipping,
          total,
          paid: paidAmount,
          balanceDue: Math.max(0, total - paidAmount),
          notes,
          invoiceUrl: `https://geem.pk/api/invoices/${inv.id}/print`,
        });
      }).catch(() => {});
  }

  res.status(201).json(await buildInvoice(inv));
});

// ── Invoice HTML generator (shared by print route + email attachment) ─────────
export async function buildInvoicePrintHtml(invoiceId: number): Promise<string | null> {
  const [rawInv] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, invoiceId));
  if (!rawInv) return null;
  const inv = await buildInvoice(rawInv);
  const [co] = await db.select().from(companySettingsTable);

  const sym = (inv as { currency?: string }).currency === "PKR" ? "₨" : "Rs";
  function fmtRs(n: number) { return sym + n.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function fmtDate(d: string) {
    try { return new Date(d + "T00:00:00").toLocaleDateString("en-PK", { timeZone: "Asia/Karachi", year: "numeric", month: "long", day: "numeric" }); }
    catch { return d; }
  }

  const companyName = co?.companyName ?? "Geem";
  const addressLines = (co?.address ?? "").split("\n").filter(Boolean);

  const itemRows = inv.items.map((i: { description: string; deviceId?: string | null; imei?: string | null; iccid?: string | null; ptaStatus?: string | null; qty: number; price: number; amount: number }) => {
    // SIM / YCTEL items use ICCID as their primary identifier — never label it as IMEI
    const isSim = !!i.iccid;
    const imeiLine = !isSim && i.imei ? `<div class="i-sub"><strong>IMEI:</strong> ${i.imei}</div>` : "";
    const iccidLine = i.iccid ? `<div class="i-sub"><strong>ICCID:</strong> ${i.iccid}</div>` : "";
    const deviceIdLine = i.deviceId ? `<div class="i-sub"><strong>Device ID:</strong> ${i.deviceId}</div>` : "";
    return `
    <tr>
      <td>
        <div class="i-name">${i.description}</div>
        ${imeiLine}${iccidLine}${deviceIdLine}
      </td>
      <td class="c">${i.qty}</td>
      <td class="r">${fmtRs(i.price)}</td>
      <td class="r">${fmtRs(i.amount)}</td>
    </tr>`;
  }).join("");

  const paymentRows = inv.payments.map((p: { date: string; method: string; transactionId?: string | null; amount: number }) => `
    <tr class="pmnt-row">
      <td class="lbl">Payment on ${fmtDate(p.date)} using ${p.method}${p.transactionId ? ` (${p.transactionId})` : ""}:</td>
      <td class="val" style="color:#166534">${fmtRs(p.amount)}</td>
    </tr>`).join("");

  const balanceDue = inv.total - inv.payments.reduce((s: number, p: { amount: number }) => s + p.amount, 0);

  const _LP = _GEEM_LOGO_PATHS;
  const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2048 550" width="210" height="57">${_LP}</svg>`;

  const WAVE_CSS = `
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Arial,Helvetica,sans-serif;color:#333;font-size:13px;line-height:1.4}
.page{max-width:820px;margin:0 auto;padding:40px 48px}
.no-print{background:#fef3c7;padding:10px 16px;border-radius:6px;margin-bottom:16px;font-size:12px;text-align:center}
@media print{.no-print{display:none!important}@page{size:A4;margin:15mm}}
.hdr{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;flex-wrap:wrap;gap:16px}
.logo-block{display:flex;align-items:flex-start;padding-top:4px;flex-shrink:0}
.co-block{text-align:right}
.inv-title{font-size:32px;font-weight:900;letter-spacing:3px;color:#222;margin-bottom:10px}
.co-name{font-size:13px;font-weight:700;margin-bottom:3px}
.co-line{font-size:12px;color:#555;line-height:1.7}
.meta-row{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;gap:24px;flex-wrap:wrap}
.bill-to-lbl{font-size:10px;font-weight:700;color:#999;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:6px}
.bill-to-body{font-size:13px;line-height:1.7}
.inv-meta-tbl{border-collapse:collapse;margin-left:auto}
.inv-meta-tbl td{font-size:13px;padding:2px 0}
.inv-meta-tbl .lbl{color:#555;text-align:right;padding-right:14px;white-space:nowrap}
.inv-meta-tbl .val{font-weight:600;text-align:right;white-space:nowrap}
.inv-meta-tbl .due-lbl{font-weight:700}
.inv-meta-tbl .due-val{font-weight:700;font-size:14px}
.items-tbl{width:100%;border-collapse:collapse;margin-bottom:8px}
.items-tbl th{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#555;border-bottom:2px solid #bbb;padding:8px 6px;text-align:left}
.items-tbl th.r{text-align:right}.items-tbl th.c{text-align:center}
.items-tbl td{vertical-align:top;padding:10px 6px;border-bottom:1px solid #e8e8e8;font-size:13px}
.items-tbl td.r{text-align:right}.items-tbl td.c{text-align:center}
.i-name{font-weight:600;margin-bottom:2px}
.i-sub{font-size:11px;color:#666;line-height:1.6;margin-top:3px;font-family:monospace}
.totals-wrap{display:flex;justify-content:flex-end;margin-top:12px}
.tot-tbl{border-collapse:collapse;width:320px}
.tot-tbl td{padding:3px 0;font-size:13px}
.tot-tbl .lbl{text-align:right;padding-right:16px;color:#555}
.tot-tbl .val{text-align:right;font-weight:600}
.tot-tbl tr.total-row td{border-top:1px solid #bbb;padding-top:8px;font-weight:700;font-size:14px}
.tot-tbl tr.pmnt-row td{color:#555;font-size:12px}
.tot-tbl tr.due-row td{border-top:2px solid #bbb;padding-top:8px;font-weight:700;font-size:14px}
.notes-box{margin-top:20px;font-size:12px;color:#666;padding:10px 14px;background:#fffbeb;border-radius:6px;border-left:3px solid #fcd34d}
.pg-footer{margin-top:36px;text-align:center;color:#aaa;font-size:11px;border-top:1px solid #e5e5e5;padding-top:12px}
@media(max-width:600px){
  .page{padding:20px 16px}
  .hdr{flex-direction:column;gap:10px}
  .co-block{text-align:left}
  .inv-title{font-size:24px;letter-spacing:2px}
  .meta-row{flex-direction:column;gap:16px}
  .inv-meta-tbl{margin-left:0}
  .inv-meta-tbl .lbl{text-align:left;padding-right:10px}
  .inv-meta-tbl .val{text-align:left}
  .totals-wrap{justify-content:flex-start}
  .tot-tbl{width:100%}
  .items-tbl th,.items-tbl td{padding:8px 4px;font-size:12px}
}
`;

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>INVOICE ${inv.invoiceNumber}</title>
<style>${WAVE_CSS}</style></head><body>
<div class="no-print">
  <strong>💡 To save as PDF:</strong> Choose <strong>Save as PDF</strong> in the print dialog.
  <button onclick="window.print()" style="margin-left:12px;padding:5px 14px;background:#2563eb;color:#fff;border:none;border-radius:5px;cursor:pointer;font-size:12px">🖨 Print / Save PDF</button>
</div>
<div class="page">
  <div class="hdr">
    <div class="logo-block">${LOGO_SVG}</div>
    <div class="co-block">
      <div class="inv-title">INVOICE</div>
      <div class="co-name">${companyName}</div>
      ${addressLines.map((l: string) => `<div class="co-line">${l}</div>`).join("")}
      ${co?.fax ? `<div class="co-line">Fax: ${co.fax}</div>` : ""}
      ${co?.email ? `<div class="co-line">Email: ${co.email}</div>` : ""}
      ${co?.phone ? `<div class="co-line">Mobile: ${co.phone}</div>` : ""}
      ${co?.website ? `<div class="co-line">${co.website}</div>` : ""}
    </div>
  </div>

  <div class="meta-row">
    <div>
      <div class="bill-to-lbl">Bill To</div>
      <div class="bill-to-body">
        <strong>${inv.customerName}</strong><br/>
        ${inv.customerPhone ? `${inv.customerPhone}<br/>` : ""}
        ${inv.customerEmail ? `${inv.customerEmail}<br/>` : ""}
        ${inv.customerAddress ? `${inv.customerAddress},<br/>` : ""}
        ${inv.customerCity ? `${inv.customerCity}, Pakistan` : "Pakistan"}
      </div>
    </div>
    <div>
      <table class="inv-meta-tbl">
        <tr><td class="lbl">Invoice Number:</td><td class="val">${inv.invoiceNumber}</td></tr>
        <tr><td class="lbl">Invoice Date:</td><td class="val">${fmtDate(inv.date)}</td></tr>
        ${inv.dueDate ? `<tr><td class="lbl">Payment Due:</td><td class="val">${fmtDate(inv.dueDate)}</td></tr>` : ""}
        <tr><td class="lbl due-lbl">Amount Due (${(inv as { currency?: string }).currency ?? "PKR"}):</td><td class="val due-val">${fmtRs(balanceDue)}</td></tr>
      </table>
    </div>
  </div>

  <table class="items-tbl">
    <thead><tr>
      <th>Items</th>
      <th class="c" style="width:72px">Quantity</th>
      <th class="r" style="width:110px">Price</th>
      <th class="r" style="width:110px">Amount</th>
    </tr></thead>
    <tbody>${itemRows}</tbody>
  </table>

  <div class="totals-wrap">
    <table class="tot-tbl">
      <tr><td class="lbl">Subtotal:</td><td class="val">${fmtRs(inv.subtotal)}</td></tr>
      ${inv.discount > 0 ? `<tr><td class="lbl">Discount:</td><td class="val">(${fmtRs(inv.discount)})</td></tr>` : ""}
      ${inv.shipping > 0 ? `<tr><td class="lbl">Shipping:</td><td class="val">${fmtRs(inv.shipping)}</td></tr>` : ""}
      ${inv.tax > 0 ? `<tr><td class="lbl">Tax:</td><td class="val">${fmtRs(inv.tax)}</td></tr>` : ""}
      <tr class="total-row"><td class="lbl">Total:</td><td class="val">${fmtRs(inv.total)}</td></tr>
      ${paymentRows}
      <tr class="due-row"><td class="lbl">Amount Due (${(inv as { currency?: string }).currency ?? "PKR"}):</td><td class="val">${fmtRs(balanceDue)}</td></tr>
    </table>
  </div>

  ${inv.notes ? `<div class="notes-box"><strong>Notes:</strong> ${inv.notes}</div>` : ""}
  <div class="pg-footer">${companyName} &nbsp;|&nbsp; ${co?.email ?? ""} &nbsp;|&nbsp; ${co?.phone ?? ""} &nbsp;|&nbsp; ${co?.website ?? ""}</div>
</div>
</body></html>`;
}

// ── Delete a single payment ──────────────────────────────────────────────────
router.delete("/invoices/:id/payments/:paymentId", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const paymentId = parseInt(Array.isArray(req.params.paymentId) ? req.params.paymentId[0] : req.params.paymentId, 10);

  const [payment] = await db.select().from(paymentsTable).where(eq(paymentsTable.id, paymentId));
  if (!payment || payment.invoiceId !== id) { res.status(404).json({ error: "Payment not found" }); return; }

  const [inv] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, id));
  if (!inv) { res.status(404).json({ error: "Invoice not found" }); return; }

  await db.delete(paymentsTable).where(eq(paymentsTable.id, paymentId));

  const remaining = await db.select().from(paymentsTable).where(eq(paymentsTable.invoiceId, id));
  const newPaid = remaining.reduce((s, p) => s + parseFloat(String(p.amount)), 0);
  const total = parseFloat(String(inv.total));
  const newStatus = newPaid >= total ? "paid" : newPaid > 0 ? "partial" : "unpaid";
  await db.update(invoicesTable).set({ paid: String(newPaid), status: newStatus }).where(eq(invoicesTable.id, id));

  if (inv.customerId) {
    await db.delete(ledgerEntriesTable).where(
      and(eq(ledgerEntriesTable.reference, inv.invoiceNumber), eq(ledgerEntriesTable.type, "payment"))
    );
    for (const p of remaining) {
      await db.insert(ledgerEntriesTable).values({
        customerId: inv.customerId,
        type: "payment",
        description: `Payment received — ${inv.invoiceNumber} (${p.method})${p.memo ? ` — ${p.memo}` : ""}`,
        reference: inv.invoiceNumber,
        debit: "0",
        credit: String(p.amount),
        balance: "0",
        date: new Date(String(p.date) + "T00:00:00"),
      });
    }
    await recalculateCustomerLedger(inv.customerId);
  }

  const [updated] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, id));
  res.json(await buildInvoice(updated));
});

// ── Edit a single payment ────────────────────────────────────────────────────
router.patch("/invoices/:id/payments/:paymentId", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const paymentId = parseInt(Array.isArray(req.params.paymentId) ? req.params.paymentId[0] : req.params.paymentId, 10);

  const [payment] = await db.select().from(paymentsTable).where(eq(paymentsTable.id, paymentId));
  if (!payment || payment.invoiceId !== id) { res.status(404).json({ error: "Payment not found" }); return; }

  const { date, method, amount, transactionId, memo } = req.body;
  const updates: Record<string, unknown> = {};
  if (date !== undefined) updates.date = date;
  if (method !== undefined) updates.method = method;
  if (amount !== undefined) updates.amount = String(amount);
  if (transactionId !== undefined) updates.transactionId = transactionId;
  if (memo !== undefined) updates.memo = memo;
  await db.update(paymentsTable).set(updates).where(eq(paymentsTable.id, paymentId));

  const [inv] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, id));
  if (!inv) { res.status(404).json({ error: "Invoice not found" }); return; }

  const allPayments = await db.select().from(paymentsTable).where(eq(paymentsTable.invoiceId, id));
  const newPaid = allPayments.reduce((s, p) => s + parseFloat(String(p.amount)), 0);
  const total = parseFloat(String(inv.total));
  const newStatus = newPaid >= total ? "paid" : newPaid > 0 ? "partial" : "unpaid";
  await db.update(invoicesTable).set({ paid: String(newPaid), status: newStatus }).where(eq(invoicesTable.id, id));

  if (inv.customerId) {
    await db.delete(ledgerEntriesTable).where(
      and(eq(ledgerEntriesTable.reference, inv.invoiceNumber), eq(ledgerEntriesTable.type, "payment"))
    );
    for (const p of allPayments) {
      await db.insert(ledgerEntriesTable).values({
        customerId: inv.customerId,
        type: "payment",
        description: `Payment received — ${inv.invoiceNumber} (${p.method})${p.memo ? ` — ${p.memo}` : ""}`,
        reference: inv.invoiceNumber,
        debit: "0",
        credit: String(p.amount),
        balance: "0",
        date: new Date(String(p.date) + "T00:00:00"),
      });
    }
    await recalculateCustomerLedger(inv.customerId);
  }

  const [updated] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, id));
  res.json(await buildInvoice(updated));
});

// ── Printable / PDF invoice ─────────────────────────────────────────────────
router.get("/invoices/:id/print", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const html = await buildInvoicePrintHtml(id);
  if (!html) { res.status(404).send("<h2>Invoice not found</h2>"); return; }
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(html);
});

// ── Printable / shareable payment receipt slip ───────────────────────────────
router.get("/invoices/:id/payments/:paymentId/slip", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const paymentId = parseInt(Array.isArray(req.params.paymentId) ? req.params.paymentId[0] : req.params.paymentId, 10);

  const [rawInv] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, id));
  if (!rawInv) { res.status(404).send("<h2>Invoice not found</h2>"); return; }
  const inv = await buildInvoice(rawInv);

  const [payment] = await db.select().from(paymentsTable).where(eq(paymentsTable.id, paymentId));
  if (!payment) { res.status(404).send("<h2>Payment not found</h2>"); return; }

  const [co] = await db.select().from(companySettingsTable);
  const companyName = co?.companyName ?? "Geem";
  const addressLines = (co?.address ?? "").split("\n").filter(Boolean);

  const sym = rawInv.currency === "PKR" ? "₨" : (rawInv.currencySymbol ?? "Rs");
  function fmtRsL(n: number) { return sym + Number(n).toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function fmtDateL(d: string) {
    try { return new Date(d + "T00:00:00").toLocaleDateString("en-PK", { timeZone: "Asia/Karachi", year: "numeric", month: "long", day: "numeric" }); }
    catch { return d; }
  }

  const paid = inv.payments.reduce((s, p) => s + parseFloat(String(p.amount)), 0);
  const balance = parseFloat(String(rawInv.total)) - paid;
  const memoText = payment.memo || payment.transactionId;

  const _SLIPLP = _GEEM_LOGO_PATHS;
  const SLIP_LOGO = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2048 550" style="width:100%;max-width:130px;height:auto;display:block;margin:0 auto 2px">${_SLIPLP}</svg>`;

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Receipt \u2014 ${inv.invoiceNumber}</title>
<meta name="viewport" content="width=57mm,initial-scale=1">
<style>
*{margin:0;padding:0;box-sizing:border-box}
@media print{
  .no-print{display:none!important}
  @page{size:57mm auto;margin:3mm 2mm}
  html,body{width:57mm}
}
body{background:#e8e8e8;font-family:'Courier New',Courier,monospace;font-size:9px;line-height:1.5;color:#000}
.no-print{background:#1e40af;color:#fff;padding:8px 12px;font-family:Arial,sans-serif;font-size:12px;text-align:center;display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap}
.no-print button{padding:5px 14px;background:#fff;color:#1e40af;border:none;border-radius:5px;cursor:pointer;font-size:12px;font-weight:700}
.outer{padding:20px;display:flex;justify-content:center;align-items:flex-start}
.slip{width:57mm;background:#fff;padding:4mm 3mm 5mm;font-family:'Courier New',Courier,monospace;font-size:9px;line-height:1.5;color:#000;box-shadow:0 4px 20px rgba(0,0,0,0.25)}
.c{text-align:center}
.b{font-weight:700}
.co-name{font-size:10.5px;font-weight:700;text-align:center;margin-top:3px}
.co-info{font-size:7.5px;text-align:center;line-height:1.55;margin-top:1px}
hr{border:none;border-top:1px dashed #000;margin:4px 0}
.title{font-size:11px;font-weight:700;text-align:center;letter-spacing:1.5px;margin:3px 0}
.row{display:flex;justify-content:space-between;align-items:baseline;font-size:8.5px;margin:1.5px 0;gap:4px}
.row span:first-child{white-space:nowrap;flex-shrink:0;color:#444}
.row span:last-child{text-align:right;word-break:break-all}
.amt-label{font-size:8px;text-align:center;letter-spacing:1px;margin:4px 0 1px;text-transform:uppercase}
.amt-val{font-size:18px;font-weight:700;text-align:center;letter-spacing:-0.5px;line-height:1.2}
.amt-cur{font-size:10px;font-weight:700;text-align:center;margin-bottom:3px}
.method{border:1px solid #000;padding:2px 4px;text-align:center;font-size:9px;font-weight:700;letter-spacing:1.5px;margin:3px 0}
.memo{font-size:8px;text-align:center;font-style:italic;margin:2px 0;word-break:break-word;color:#333}
.status-ok{font-size:9px;font-weight:700;text-align:center;letter-spacing:1px;margin:2px 0}
.status-bal{font-size:9px;font-weight:700;text-align:center;letter-spacing:0.5px;margin:2px 0}
.footer{font-size:7.5px;text-align:center;line-height:1.6;margin-top:2px;color:#444}
.item-desc{font-size:8.5px;font-weight:700;word-break:break-word;margin-bottom:1px}
.item-line{display:flex;justify-content:space-between;font-size:8px;color:#333}
.item-id{font-size:7.5px;color:#555;font-style:italic;word-break:break-all}
.item-sep{border:none;border-top:1px dotted #bbb;margin:3px 0}
</style></head><body>
<div class="no-print">
  <span>57 mm thermal receipt</span>
  <button onclick="window.print()">&#128424; Print</button>
  <span style="font-size:11px;opacity:0.85">Set paper size to <strong>57 mm</strong> in print dialog</span>
</div>
<div class="outer">
<div class="slip">
  <div class="c">${SLIP_LOGO}</div>
  <div class="co-name">${companyName}</div>
  <div class="co-info">${addressLines.join("<br/>")
    }${co?.phone ? `<br/>${co.phone}` : ""
    }${co?.email ? `<br/>${co.email}` : ""
    }${co?.website ? `<br/>${co.website}` : ""
    }${co?.taxNumber ? `<br/><span style="font-weight:700">NTN: ${co.taxNumber}</span>` : ""}</div>
  <hr/>
  <div class="title">PAYMENT RECEIPT</div>
  <hr/>
  <div class="row"><span>Invoice</span><span class="b">#${inv.invoiceNumber}</span></div>
  <div class="row"><span>Date</span><span>${fmtDateL(String(payment.date))}</span></div>
  <div class="row"><span>Customer</span><span class="b">${inv.customerName}</span></div>
  ${inv.customerEmail ? `<div class="row"><span>Email</span><span>${inv.customerEmail}</span></div>` : ""}
  ${payment.transactionId ? `<div class="row"><span>Ref #</span><span>${payment.transactionId}</span></div>` : ""}
  ${payment.memo ? `<div class="memo">"${payment.memo}"</div>` : ""}
  <hr/>
  ${inv.items.map((item: { description: string; qty: number; price: number; amount: number; imei?: string | null; iccid?: string | null }, idx: number) => `${idx > 0 ? '<div class="item-sep"></div>' : ""}
  <div class="item-desc">${item.description}</div>
  <div class="item-line"><span>${item.qty} x ${fmtRsL(item.price)}</span><span class="b">${fmtRsL(item.amount)}</span></div>
  ${item.imei ? `<div class="item-id">IMEI: ${item.imei}</div>` : ""}
  ${item.iccid ? `<div class="item-id">ICCID: ${item.iccid}</div>` : ""}`).join("")}
  <hr/>
  ${inv.discount > 0 ? `<div class="row"><span>Subtotal</span><span>${fmtRsL(inv.subtotal)}</span></div><div class="row"><span>Discount</span><span>-${fmtRsL(inv.discount)}</span></div>` : ""}
  ${inv.tax > 0 ? `<div class="row" style="font-weight:700"><span>Tax / GST${co?.taxNumber ? ` (NTN ${co.taxNumber})` : ""}</span><span>${fmtRsL(inv.tax)}</span></div>` : ""}
  ${inv.shipping > 0 ? `<div class="row"><span>Shipping</span><span>${fmtRsL(inv.shipping)}</span></div>` : ""}
  <div class="row b" style="border-top:1px solid #000;padding-top:2px;margin-top:1px"><span>TOTAL</span><span>${fmtRsL(inv.total)}</span></div>
  <hr/>
  <div class="amt-label">Amount Paid</div>
  <div class="amt-val">${fmtRsL(parseFloat(String(payment.amount)))}</div>
  <div class="amt-cur">${rawInv.currency}</div>
  <div class="method">${String(payment.method).replace(/_/g," ").toUpperCase()}</div>
  <hr/>
  <div class="row"><span>Invoice Total</span><span>${fmtRsL(parseFloat(String(rawInv.total)))}</span></div>
  <div class="row"><span>Total Paid</span><span>${fmtRsL(paid)}</span></div>
  <div class="row b"><span>Balance Due</span><span>${fmtRsL(Math.max(0, balance))}</span></div>
  <hr/>
  ${balance <= 0
    ? `<div class="status-ok">*** FULLY PAID ***</div>`
    : `<div class="status-bal">BALANCE DUE: ${fmtRsL(balance)} ${rawInv.currency}</div>`}
  <hr/>
  <div class="footer">Thank you for your business!<br/>${co?.phone ?? "+92 307-8680005"}<br/>${co?.email ?? "info@geem.pk"}</div>
</div>
</div>
</body></html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(html);
});

  const _LP2 = _GEEM_LOGO_PATHS;
  const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2048 550" width="210" height="57">${_LP2}</svg>`;

router.get("/invoices/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [inv] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, id));
  if (!inv) { res.status(404).json({ error: "Not found" }); return; }
  res.json(await buildInvoice(inv));
});

router.patch("/invoices/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [existing] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }

  const updates: Record<string, unknown> = {};
  const fields = ["status", "dueDate", "notes", "discount"];
  for (const f of fields) if (req.body[f] !== undefined) updates[f] = req.body[f];
  if (updates.discount) updates.discount = String(updates.discount);

  const [inv] = await db.update(invoicesTable).set(updates).where(eq(invoicesTable.id, id)).returning();
  if (!inv) { res.status(404).json({ error: "Not found" }); return; }
  res.json(await buildInvoice(inv));
});

router.put("/invoices/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { customerId, date, dueDate, items, discount, tax, shipping, notes, status, currency, currencySymbol } = req.body;
  if (!customerId || !date || !items?.length) {
    res.status(400).json({ error: "customerId, date, items required" });
    return;
  }
  const [existing] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }

  const subtotal = items.reduce((s: number, i: { qty: number; price: number }) => s + i.qty * i.price, 0);
  const totalDiscount = parseFloat(String(discount ?? 0));
  const totalTax = parseFloat(String(tax ?? 0));
  const totalShipping = parseFloat(String(shipping ?? 0));
  const newTotal = subtotal - totalDiscount + totalTax + totalShipping;
  const oldTotal = parseFloat(String(existing.total));

  const [inv] = await db.update(invoicesTable).set({
    customerId, date, dueDate: dueDate || null,
    status: status ?? existing.status,
    subtotal: String(subtotal),
    discount: String(totalDiscount),
    tax: String(totalTax),
    shipping: String(totalShipping),
    total: String(newTotal),
    currency: currency ?? existing.currency,
    currencySymbol: currencySymbol ?? existing.currencySymbol,
    notes: notes ?? null,
  }).where(eq(invoicesTable.id, id)).returning();

  await db.delete(invoiceItemsTable).where(eq(invoiceItemsTable.invoiceId, id));
  for (const item of items) {
    const qty = parseFloat(String(item.qty ?? 1));
    const price = parseFloat(String(item.price));
    const taxRate = parseFloat(String(item.taxRate ?? 0));
    const amount = qty * price;
    await db.insert(invoiceItemsTable).values({
      invoiceId: inv.id,
      description: item.description, imei: item.imei, inventoryItemId: item.inventoryItemId,
      qty: String(qty), price: String(price), taxRate: String(taxRate), amount: String(amount),
    });
  }

  // If total changed, update the ledger entry for this invoice
  if (customerId && Math.abs(newTotal - oldTotal) > 0.001) {
    const [existingLedger] = await db.select()
      .from(ledgerEntriesTable)
      .where(eq(ledgerEntriesTable.reference, existing.invoiceNumber))
      .orderBy(desc(ledgerEntriesTable.id))
      .limit(1);
    if (existingLedger) {
      await db.update(ledgerEntriesTable)
        .set({ debit: String(newTotal) })
        .where(eq(ledgerEntriesTable.id, existingLedger.id));
      await recalculateCustomerLedger(customerId);
    }
  }

  res.json(await buildInvoice(inv));
});

router.delete("/invoices/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [inv] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, id));

  // Remove ledger entries linked to this invoice, then recalculate
  if (inv?.customerId && inv.invoiceNumber) {
    await db.delete(ledgerEntriesTable)
      .where(eq(ledgerEntriesTable.reference, inv.invoiceNumber));
    await recalculateCustomerLedger(inv.customerId);
  }

  await db.delete(invoiceItemsTable).where(eq(invoiceItemsTable.invoiceId, id));
  await db.delete(paymentsTable).where(eq(paymentsTable.invoiceId, id));
  await db.delete(invoicesTable).where(eq(invoicesTable.id, id));
  res.sendStatus(204);
});

router.post("/invoices/:id/payment", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { date, method, amount, transactionId, memo } = req.body;
  if (!date || !method || !amount) {
    res.status(400).json({ error: "date, method, amount required" });
    return;
  }
  const [payment] = await db.insert(paymentsTable).values({
    invoiceId: id, date, method, amount: String(amount), transactionId, memo,
  }).returning();

  const [inv] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, id));
  if (inv) {
    const newPaid = parseFloat(String(inv.paid)) + parseFloat(String(amount));
    const total = parseFloat(String(inv.total));
    const newStatus = newPaid >= total ? "paid" : "partial";
    await db.update(invoicesTable).set({ paid: String(newPaid), status: newStatus }).where(eq(invoicesTable.id, id));

    // Ledger: create credit entry for this payment
    if (inv.customerId) {
      const paidAmt = parseFloat(String(amount));
      await addLedgerEntry({
        customerId: inv.customerId,
        type: "payment",
        description: `Payment received — ${inv.invoiceNumber} (${method})${memo ? ` — ${memo}` : ""}`,
        reference: inv.invoiceNumber,
        debit: 0,
        credit: paidAmt,
        date: new Date(String(date)),
      });
    }
  }

  res.status(201).json({
    ...payment,
    amount: parseFloat(String(payment.amount)),
    transactionId: payment.transactionId ?? null,
    memo: payment.memo ?? null,
    date: String(payment.date),
    createdAt: payment.createdAt.toISOString(),
  });
});

/**
 * POST /invoices/:id/email
 * Send the invoice to the customer's email address.
 */
router.post("/invoices/:id/email", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const channel = (req.body.channel as string) || "email";
  const inv = await buildInvoice(await db.select().from(invoicesTable).where(eq(invoicesTable.id, id)).then(r => r[0]));
  if (!inv) { res.status(404).json({ error: "Not found" }); return; }
  const [cust] = await db.select({ email: customersTable.email, mobile: customersTable.mobile })
    .from(customersTable).where(eq(customersTable.id, inv.customerId));
  const invoiceUrl = `https://geem.pk/api/invoices/${id}/print`;
  const sym = inv.currencySymbol ?? "Rs";
  const itemLines = inv.items.map(i => `  • ${i.description}${i.imei ? ` (IMEI: ${i.imei})` : ""} — ${sym} ${i.amount.toLocaleString()}`).join("\n");
  const msgText = `*Invoice ${inv.invoiceNumber}* — ${inv.customerName}\nDate: ${inv.date}\n\n*Items:*\n${itemLines}\n\n*Total: ${sym} ${inv.total.toLocaleString()}*\n${inv.balanceDue > 0 ? `Balance Due: ${sym} ${inv.balanceDue.toLocaleString()}` : "✅ Fully Paid"}\n\nView/Download Invoice:\n${invoiceUrl}\n\n_Geem Global Services — geem.pk_`;

  if (channel === "whatsapp") {
    const intl = toWaPhone(cust?.mobile);
    if (!intl) { res.status(400).json({ error: "Customer has no mobile number" }); return; }
    const sent = await sendWhatsApp(intl, msgText);
    if (sent) { res.json({ ok: true, sentTo: intl, channel: "whatsapp" }); }
    else { res.status(500).json({ error: "WhatsApp send failed — check integration settings" }); }
    return;
  }

  if (channel === "sms") {
    const intl = toWaPhone(cust?.mobile);
    if (!intl) { res.status(400).json({ error: "Customer has no mobile number" }); return; }
    const plain = msgText.replace(/\*/g, "").replace(/_/g, "");
    const sent = await sendSms(intl, plain);
    if (sent) { res.json({ ok: true, sentTo: intl, channel: "sms" }); }
    else { res.status(500).json({ error: "SMS send failed — check integration settings" }); }
    return;
  }

  // Default: email
  if (!cust?.email) { res.status(400).json({ error: "Customer has no email address" }); return; }
  const sent = await sendInvoiceEmail({
    customerName: inv.customerName,
    customerEmail: cust.email,
    invoiceNumber: inv.invoiceNumber,
    date: inv.date,
    status: inv.status,
    items: inv.items.map(i => ({ description: i.description, qty: i.qty, amount: i.amount })),
    subtotal: inv.subtotal,
    discount: inv.discount,
    tax: inv.tax,
    shipping: inv.shipping,
    total: inv.total,
    paid: inv.paid,
    balanceDue: inv.balanceDue,
    notes: inv.notes,
    invoiceUrl,
  });
  if (sent) { res.json({ ok: true, sentTo: cust.email, channel: "email" }); }
  else { res.status(500).json({ error: "Email send failed — check email integration settings" }); }
});

/**
 * POST /invoices/sync-ledger
 * Backfill ledger entries for ALL existing invoices that don't yet have them.
 * Safe to call multiple times — skips invoices/payments already in the ledger.
 * Also rebuilds running balances for every affected customer.
 */
router.post("/invoices/sync-ledger", async (req, res): Promise<void> => {
  const allInvoices = await db.select().from(invoicesTable).orderBy(invoicesTable.date, invoicesTable.id);
  const allPayments = await db.select().from(paymentsTable).orderBy(paymentsTable.date, paymentsTable.id);

  // Existing ledger entries (all) — use reference + type to deduplicate
  const existingEntries = await db.select({
    reference: ledgerEntriesTable.reference,
    type: ledgerEntriesTable.type,
  }).from(ledgerEntriesTable);
  const existing = new Set(existingEntries.map(e => `${e.type}::${e.reference}`));

  const affectedCustomers = new Set<number>();

  for (const inv of allInvoices) {
    if (!inv.customerId) continue;
    const total = parseFloat(String(inv.total));
    if (total <= 0) continue;

    const key = `invoice::${inv.invoiceNumber}`;
    if (!existing.has(key)) {
      const [cust] = await db.select({ name: customersTable.name }).from(customersTable).where(eq(customersTable.id, inv.customerId));
      await db.insert(ledgerEntriesTable).values({
        customerId: inv.customerId,
        type: "invoice",
        description: `Invoice ${inv.invoiceNumber}${cust ? ` — ${cust.name}` : ""}`,
        reference: inv.invoiceNumber,
        debit: String(total),
        credit: "0",
        balance: "0",
        date: new Date(String(inv.date)),
      });
      affectedCustomers.add(inv.customerId);
    }
  }

  for (const pmt of allPayments) {
    const [inv] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, pmt.invoiceId));
    if (!inv?.customerId) continue;
    const pmtAmt = parseFloat(String(pmt.amount));
    if (pmtAmt <= 0) continue;

    // Use payment id to make key unique per payment
    const key = `payment::${inv.invoiceNumber}-PMT${pmt.id}`;
    if (!existing.has(key)) {
      await db.insert(ledgerEntriesTable).values({
        customerId: inv.customerId,
        type: "payment",
        description: `Payment received — ${inv.invoiceNumber} (${pmt.method})`,
        reference: inv.invoiceNumber,
        debit: "0",
        credit: String(pmtAmt),
        balance: "0",
        date: new Date(String(pmt.date)),
      });
      affectedCustomers.add(inv.customerId);
    }
  }

  // Recalculate running balances for all affected customers
  for (const custId of affectedCustomers) {
    await recalculateCustomerLedger(custId);
  }

  res.json({
    message: "Ledger sync complete",
    customersUpdated: affectedCustomers.size,
    invoicesProcessed: allInvoices.length,
  });
});

// POS Drafts
router.get("/pos/drafts", async (req, res): Promise<void> => {
  const drafts = await db.select().from(posDraftsTable).orderBy(sql`${posDraftsTable.createdAt} desc`);
  res.json(drafts.map(d => ({
    ...d,
    total: parseFloat(String(d.total)),
    customerId: d.customerId ?? null,
    itemsCount: 0,
    createdAt: d.createdAt.toISOString(),
  })));
});

router.post("/pos/drafts", async (req, res): Promise<void> => {
  const { customerId, customerName, total, cartData } = req.body;
  const [draft] = await db.insert(posDraftsTable).values({
    customerId, customerName: customerName ?? "Walk-in",
    total: String(total ?? 0), cartData: cartData ?? "{}",
  }).returning();
  res.status(201).json({
    ...draft, total: parseFloat(String(draft.total)),
    customerId: draft.customerId ?? null, itemsCount: 0, createdAt: draft.createdAt.toISOString(),
  });
});

router.delete("/pos/drafts/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  await db.delete(posDraftsTable).where(eq(posDraftsTable.id, id));
  res.sendStatus(204);
});

export default router;
