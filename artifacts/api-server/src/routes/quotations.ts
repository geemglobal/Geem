import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, quotationsTable, quotationItemsTable, customersTable, invoicesTable, invoiceItemsTable, invoiceSettingsTable, paymentsTable, companySettingsTable } from "@workspace/db";
import { sendSms, sendWhatsApp } from "../lib/sms";
import { toWaPhone } from "../lib/format";

// ── Quotation logo (same Geem SVG paths as invoices) ─────────────────────────
const _GEEM_Q_LOGO = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2048 550" width="210" height="57"><path transform="translate(1635,135)" d="m0 0h32l23 4 18 6 16 8 14 10 10 9 8 8 3 4v2l5-3 9-9 13-10 13-8 16-8 16-6 23-5 14-2h36l25 4 17 5 20 9 15 10 14 12 11 13 10 15 8 17 7 23 3 17 1 11v252h-103l-1-232-3-16-5-12-6-10-7-8-10-7-12-5-10-2h-22l-14 3-12 5-11 7-8 7-9 13-6 13-3 11-1 7-1 24v201l-1 1h-102l-1-229-3-18-5-13-7-11-5-6-11-8-12-5-10-2h-22l-18 4-14 7-11 9-9 11-7 14-4 14-2 16-1 217h-103l-1-1v-380h103v36l8-7 11-9 16-10 17-8 16-5z" fill="#EC2029"/><path transform="translate(1195,134)" d="m0 0h35l24 3 25 6 17 6 19 9 17 11 14 11 14 14 11 14 9 14 8 15 9 23 5 19 3 18 1 11v45l-1 11-2 1h-290l7 21 8 15 8 10 12 12 13 8 13 6 15 4 13 2h26l22-4 15-5 19-10 14-11 10-10 7-9 5 2 15 9 28 17 24 15 6 4-7 11-11 13-9 10-11 10-16 12-17 10-19 9-24 8-26 5-27 3h-29l-25-3-20-4-27-9-16-8-14-8-11-8-10-8-19-19-10-13-12-20-10-22-6-19-4-19-3-27v-24l3-26 6-25 8-20 8-17 12-19 12-14 9-10 7-7 14-11 15-10 19-10 24-9 21-5zm2 85-20 4-16 7-11 7-12 11-10 13-9 17-3 10h186l-3-12-8-16-8-11-12-12-13-8-14-6-12-3-7-1z" fill="#EC2029"/><path transform="translate(769,134)" d="m0 0h36l23 3 22 5 18 6 16 7 17 10 17 13 18 18 13 17 11 19 10 24 6 21 3 17 2 25v18l-1 25-2 3h-291l7 20 9 17 9 11 8 8 15 10 11 5 17 5 13 2h26l23-4 19-7 16-9 11-9 4-2 2-4 5-5 7-9 4 1 28 17 26 16 19 12 1 2-9 13-11 13-12 12-11 9-14 10-14 8-16 8-27 9-25 5-28 3h-28l-25-3-20-4-17-5-21-9-17-9-19-14-12-11-8-8-11-14-7-10-9-16-7-15-6-18-5-20-3-22-1-25 2-24 4-22 6-20 8-19 9-17 11-16 11-13 8-9 8-7 15-12 18-11 16-8 21-8 21-5zm2 85-16 3-16 6-13 8-9 7-7 8-8 10-8 16-3 8v3h185l-2-10-7-16-8-11-9-10-12-9-17-8-14-4-8-1z" fill="#EC2029"/><path transform="translate(278,4)" d="m0 0h13l27 2 10 1-2 4-9 9-7 8-28 28-7 8-21 21-7 8-3 3-29 10-23 12-14 10-11 9-15 15-13 17-9 15-9 19-6 18-5 25-1 8v28l3 21 6 23 9 21 8 15 10 14 11 13 10 10 14 11 10 7 14 8 24 10 23 6 18 3h34l24-4 20-6 18-8 16-9 16-12 10-9 11-11 9-11 11-17 2-4-33-1-32-32v-2h-2l-7-8-12-12-5-4-7-8-16-16v-1h224v21l-3 23-6 27-8 24-12 26-11 19-12 17-8 10-12 14-14 14-8 7-18 14-19 12-23 12-19 8-26 8-20 4-15 2-13 1h-41l-18-2-24-5-20-6-20-8-23-11-19-12-11-8-14-11-13-12-13-13-9-11-10-13-10-15-12-22-10-23-8-26-5-23-2-15-1-13v-30l2-20 4-23 7-25 8-21 10-21 12-20 14-19 12-14 21-21 14-11 17-12 19-11 23-11 25-9 29-7 24-3z" fill="#EC2029"/><path transform="translate(402,33)" d="m0 0 6 1 24 14 11 8 13 10 13 12 3 2-2 4-12 13-43 43-2 3-4-1-11-10-15-11-14-8-14-7-16-6 2-4 15-15 7-8 23-23 7-8z" fill="#EC2029"/></svg>`;

function getPublicBase(): string {
  return (process.env.PUBLIC_URL ?? "https://geem.pk").replace(/\/$/, "");
}

// ── Printable quotation HTML (served publicly, no auth required) ──────────────
async function buildQuotationPrintHtml(quotationId: number): Promise<string | null> {
  const [rawQ] = await db.select().from(quotationsTable).where(eq(quotationsTable.id, quotationId));
  if (!rawQ) return null;
  const q = await buildQuotation(rawQ);
  const [co] = await db.select().from(companySettingsTable);

  const sym = q.currency === "PKR" ? "₨" : (q.currencySymbol ?? "Rs");
  function fmtAmt(n: number) { return sym + Number(n).toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function fmtDate(d: string) {
    try { return new Date(d + "T00:00:00").toLocaleDateString("en-PK", { timeZone: "Asia/Karachi", year: "numeric", month: "long", day: "numeric" }); }
    catch { return d; }
  }

  const companyName = co?.companyName ?? "Geem";
  const addressLines = (co?.address ?? "").split("\n").filter(Boolean);

  const itemRows = q.items.map(i => `
    <tr>
      <td>
        <div class="i-name">${i.description}</div>
        ${i.deviceId ? `<div class="i-sub">Device ID: ${i.deviceId}</div>` : ""}
        ${i.imei ? `<div class="i-sub">IMEI: ${i.imei}</div>` : ""}
      </td>
      <td class="c">${i.qty}</td>
      <td class="r">${fmtAmt(i.price)}</td>
      <td class="r">${fmtAmt(i.amount)}</td>
    </tr>`).join("");

  const CSS = `*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#333;font-size:13px;line-height:1.4}.page{max-width:820px;margin:0 auto;padding:40px 48px}.no-print{background:#fef3c7;padding:10px 16px;border-radius:6px;margin-bottom:16px;font-size:12px;text-align:center}@media print{.no-print{display:none!important}@page{size:A4;margin:15mm}}.hdr{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;flex-wrap:wrap;gap:16px}.logo-block{display:flex;align-items:flex-start;padding-top:4px;flex-shrink:0}.co-block{text-align:right}.doc-title{font-size:32px;font-weight:900;letter-spacing:3px;color:#222;margin-bottom:10px}.co-name{font-size:13px;font-weight:700;margin-bottom:3px}.co-line{font-size:12px;color:#555;line-height:1.7}.meta-row{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;gap:24px;flex-wrap:wrap}.bill-to-lbl{font-size:10px;font-weight:700;color:#999;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:6px}.bill-to-body{font-size:13px;line-height:1.7}.meta-tbl{border-collapse:collapse;margin-left:auto}.meta-tbl td{font-size:13px;padding:2px 0}.meta-tbl .lbl{color:#555;text-align:right;padding-right:14px;white-space:nowrap}.meta-tbl .val{font-weight:600;text-align:right;white-space:nowrap}.meta-tbl .tot-lbl{font-weight:700}.meta-tbl .tot-val{font-weight:700;font-size:14px}.items-tbl{width:100%;border-collapse:collapse;margin-bottom:8px}.items-tbl th{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#555;border-bottom:2px solid #bbb;padding:8px 6px;text-align:left}.items-tbl th.r{text-align:right}.items-tbl th.c{text-align:center}.items-tbl td{vertical-align:top;padding:10px 6px;border-bottom:1px solid #e8e8e8;font-size:13px}.items-tbl td.r{text-align:right}.items-tbl td.c{text-align:center}.i-name{font-weight:600;margin-bottom:2px}.i-sub{font-size:11px;color:#666;line-height:1.6;margin-top:3px;font-family:monospace}.totals-wrap{display:flex;justify-content:flex-end;margin-top:12px}.tot-tbl{border-collapse:collapse;width:320px}.tot-tbl td{padding:3px 0;font-size:13px}.tot-tbl .lbl{text-align:right;padding-right:16px;color:#555}.tot-tbl .val{text-align:right;font-weight:600}.tot-tbl tr.total-row td{border-top:2px solid #bbb;padding-top:8px;font-weight:700;font-size:14px}.notes-box{margin-top:20px;font-size:12px;color:#666;padding:10px 14px;background:#fffbeb;border-radius:6px;border-left:3px solid #fcd34d}.validity-box{margin-top:20px;font-size:12px;color:#555;padding:10px 14px;background:#f0f9ff;border-radius:6px;border-left:3px solid #0ea5e9}.pg-footer{margin-top:36px;text-align:center;color:#aaa;font-size:11px;border-top:1px solid #e5e5e5;padding-top:12px}@media(max-width:600px){.page{padding:20px 16px}.hdr{flex-direction:column;gap:10px}.co-block{text-align:left}.meta-row{flex-direction:column;gap:16px}.meta-tbl{margin-left:0}.meta-tbl .lbl{text-align:left}.meta-tbl .val{text-align:left}.totals-wrap{justify-content:flex-start}.tot-tbl{width:100%}.items-tbl th,.items-tbl td{padding:7px 4px;font-size:12px}}`;

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>QUOTATION ${q.quotationNumber}</title>
<style>${CSS}</style></head><body>
<div class="no-print">
  <strong>💡 To save as PDF:</strong> Choose <strong>Save as PDF</strong> in the print dialog.
  <button onclick="window.print()" style="margin-left:12px;padding:5px 14px;background:#2563eb;color:#fff;border:none;border-radius:5px;cursor:pointer;font-size:12px">🖨 Print / Save PDF</button>
</div>
<div class="page">
  <div class="hdr">
    <div class="logo-block">${_GEEM_Q_LOGO}</div>
    <div class="co-block">
      <div class="doc-title">QUOTATION</div>
      <div class="co-name">${companyName}</div>
      ${addressLines.map(l => `<div class="co-line">${l}</div>`).join("")}
      ${co?.fax ? `<div class="co-line">Fax: ${co.fax}</div>` : ""}
      ${co?.email ? `<div class="co-line">Email: ${co.email}</div>` : ""}
      ${co?.phone ? `<div class="co-line">Mobile: ${co.phone}</div>` : ""}
      ${co?.website ? `<div class="co-line">${co.website}</div>` : ""}
      ${co?.taxNumber ? `<div class="co-line" style="font-weight:700">NTN: ${co.taxNumber}</div>` : ""}
    </div>
  </div>
  <div class="meta-row">
    <div>
      <div class="bill-to-lbl">Prepared For</div>
      <div class="bill-to-body">
        <strong>${q.customerName}</strong><br/>
        ${q.customerAddress ? `${q.customerAddress}<br/>` : ""}
        ${q.customerCity ? `${q.customerCity}<br/>` : ""}
        ${q.customerPhone ?? ""}
      </div>
    </div>
    <div>
      <table class="meta-tbl">
        <tr><td class="lbl">Quotation Number:</td><td class="val">${q.quotationNumber}</td></tr>
        <tr><td class="lbl">Quotation Date:</td><td class="val">${fmtDate(q.date)}</td></tr>
        ${q.expiryDate ? `<tr><td class="lbl">Valid Until:</td><td class="val">${fmtDate(q.expiryDate)}</td></tr>` : ""}
        <tr><td class="lbl tot-lbl">Total Amount (${q.currency}):</td><td class="val tot-val">${fmtAmt(q.total)}</td></tr>
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
      <tr><td class="lbl">Subtotal:</td><td class="val">${fmtAmt(q.subtotal)}</td></tr>
      ${q.discount > 0 ? `<tr><td class="lbl">Discount:</td><td class="val">(${fmtAmt(q.discount)})</td></tr>` : ""}
      ${q.tax > 0 ? `<tr><td class="lbl">Tax:</td><td class="val">${fmtAmt(q.tax)}</td></tr>` : ""}
      <tr class="total-row"><td class="lbl">Total (${q.currency}):</td><td class="val">${fmtAmt(q.total)}</td></tr>
    </table>
  </div>
  ${q.notes ? `<div class="notes-box"><strong>Notes:</strong> ${q.notes}</div>` : ""}
  ${q.expiryDate ? `<div class="validity-box">This quotation is valid until <strong>${fmtDate(q.expiryDate)}</strong>. Please confirm acceptance before the expiry date.</div>` : ""}
  <div class="pg-footer">${companyName} &nbsp;|&nbsp; ${co?.email ?? ""} &nbsp;|&nbsp; ${co?.phone ?? ""} &nbsp;|&nbsp; ${co?.website ?? ""}</div>
</div>
</body></html>`;
}

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

// ── Public print route (no auth required — shared with customers) ─────────────
router.get("/quotations/:id/print", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  try {
    const html = await buildQuotationPrintHtml(id);
    if (!html) { res.status(404).send("<h2>Quotation not found</h2>"); return; }
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (err) {
    res.status(500).send("<h2>Error loading quotation. Please try again.</h2>");
  }
});

/**
 * POST /quotations/:id/send
 * Send the quotation link to the customer via WhatsApp or SMS.
 * channel: "whatsapp" | "sms"  (default: "whatsapp")
 */
router.post("/quotations/:id/send", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const channel = (req.body.channel as string) || "whatsapp";
  const [rawQ] = await db.select().from(quotationsTable).where(eq(quotationsTable.id, id));
  if (!rawQ) { res.status(404).json({ error: "Not found" }); return; }
  const q = await buildQuotation(rawQ);

  const quotationUrl = `${getPublicBase()}/api/quotations/${id}/print`;
  const sym = q.currencySymbol ?? "Rs";
  const itemLines = q.items.map(i =>
    `  • ${i.description}${i.imei ? ` (IMEI: ${i.imei})` : ""} — ${sym} ${Number(i.amount).toLocaleString()}`
  ).join("\n");
  const msgText = `*Quotation ${q.quotationNumber}* — ${q.customerName}\nDate: ${q.date}${q.expiryDate ? `\nValid Until: ${q.expiryDate}` : ""}\n\n*Items:*\n${itemLines}\n\n*Total: ${sym} ${Number(q.total).toLocaleString()}*\n\nView/Download Quotation:\n${quotationUrl}\n\n_Geem Global Services — geem.pk_`;

  const intl = toWaPhone(q.customerPhone);
  if (!intl) { res.status(400).json({ error: "Customer has no mobile number" }); return; }

  if (channel === "whatsapp") {
    const sent = await sendWhatsApp(intl, msgText);
    if (sent) { res.json({ ok: true, sentTo: intl, channel: "whatsapp" }); }
    else { res.status(500).json({ error: "WhatsApp send failed — check integration settings" }); }
    return;
  }

  if (channel === "sms") {
    const plain = msgText.replace(/\*/g, "").replace(/_/g, "");
    const sent = await sendSms(intl, plain);
    if (sent) { res.json({ ok: true, sentTo: intl, channel: "sms" }); }
    else { res.status(500).json({ error: "SMS send failed — check integration settings" }); }
    return;
  }

  res.status(400).json({ error: "Unsupported channel. Use 'whatsapp' or 'sms'." });
});

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
