import nodemailer from "nodemailer";
import { db, integrationSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

interface EmailConfig {
  host: string; port: number; secure: boolean;
  user: string; password: string;
  fromName: string; fromEmail: string;
  adminEmail?: string;
}

async function getEmailConfig(): Promise<EmailConfig | null> {
  const [row] = await db.select().from(integrationSettingsTable).where(eq(integrationSettingsTable.type, "email"));
  if (!row || !row.enabled) return null;
  return JSON.parse(row.config) as EmailConfig;
}

function createTransport(cfg: EmailConfig) {
  const opts: Record<string, unknown> = {
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    tls: { rejectUnauthorized: false },
  };
  if (cfg.user) {
    opts.auth = { user: cfg.user, pass: cfg.password };
  }
  return nodemailer.createTransport(opts as nodemailer.TransportOptions);
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  attachments?: { filename: string; content: string; contentType: string }[];
}): Promise<boolean> {
  try {
    const cfg = await getEmailConfig();
    if (!cfg) { logger.warn("Email not configured — skipping send"); return false; }
    const transport = createTransport(cfg);
    await transport.sendMail({
      from: `"${cfg.fromName}" <${cfg.fromEmail}>`,
      to: opts.to,
      replyTo: opts.replyTo ?? cfg.fromEmail,
      subject: opts.subject,
      html: opts.html,
      text: opts.text ?? opts.html.replace(/<[^>]+>/g, ""),
      attachments: opts.attachments?.map(a => ({
        filename: a.filename,
        content: Buffer.from(a.content, "utf-8"),
        contentType: a.contentType,
      })),
    });
    logger.info({ to: opts.to, subject: opts.subject }, "Email sent");
    return true;
  } catch (err) {
    logger.error({ err }, "Email send failed");
    return false;
  }
}

export async function sendAdminAlert(opts: {
  subject: string;
  html: string;
}): Promise<boolean> {
  try {
    const cfg = await getEmailConfig();
    if (!cfg) return false;
    const adminEmail = cfg.adminEmail ?? "zahidgul@geem.pk";
    return sendEmail({ to: adminEmail, ...opts });
  } catch {
    return false;
  }
}

export async function sendOrderConfirmation(order: {
  customerName: string;
  customerEmail: string;
  orderNumber: string;
  paymentMethod: string;
  total: number;
  items: { description: string; qty: number; amount: number }[];
  shippingAddress?: string;
  invoiceUrl?: string;
}): Promise<boolean> {
  if (!order.customerEmail) return false;
  const itemRows = order.items.map(i =>
    `<tr><td style="padding:6px 12px;border-bottom:1px solid #f0f0f0">${i.description}</td><td style="padding:6px 12px;border-bottom:1px solid #f0f0f0;text-align:center">${i.qty}</td><td style="padding:6px 12px;border-bottom:1px solid #f0f0f0;text-align:right">Rs ${i.amount.toLocaleString()}</td></tr>`
  ).join("");

  const isCOD = order.paymentMethod?.toLowerCase().includes("cod");
  const payNote = isCOD
    ? `<p style="background:#fff8e1;border-left:4px solid #f59e0b;padding:10px 14px;margin:16px 0;border-radius:4px">💵 <strong>Cash on Delivery</strong> — please have Rs ${order.total.toLocaleString()} ready when your order arrives.</p>`
    : `<p style="background:#e8f5e9;border-left:4px solid #22c55e;padding:10px 14px;margin:16px 0;border-radius:4px">✅ <strong>Payment Received</strong> — your order is confirmed and will be processed shortly.</p>`;

  const invoiceBtn = order.invoiceUrl
    ? `<div style="text-align:center;margin:24px 0">
        <a href="${order.invoiceUrl}" style="background:#e63946;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;display:inline-block">📄 View Invoice</a>
        <p style="font-size:12px;color:#aaa;margin-top:8px">Or copy: ${order.invoiceUrl}</p>
      </div>`
    : "";

  const html = `
<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#333">
<div style="background:#e63946;padding:20px 24px">
  <h1 style="color:#fff;margin:0;font-size:22px">Geem — Order Confirmed ✅</h1>
</div>
<div style="padding:24px">
  <p style="font-size:16px">Assalam-o-Alaikum <strong>${order.customerName}</strong>! 🎉</p>
  <p>Your order from <strong>Geem.pk</strong> has been confirmed! Here's your summary:</p>
  <p style="font-size:18px;font-weight:bold">Order #${order.orderNumber}</p>
  ${payNote}
  <table style="width:100%;border-collapse:collapse;margin:16px 0">
    <thead><tr style="background:#f5f5f5">
      <th style="padding:8px 12px;text-align:left">Item</th>
      <th style="padding:8px 12px;text-align:center">Qty</th>
      <th style="padding:8px 12px;text-align:right">Amount</th>
    </tr></thead>
    <tbody>${itemRows}</tbody>
    <tfoot><tr style="font-weight:bold">
      <td colspan="2" style="padding:10px 12px;text-align:right">Total</td>
      <td style="padding:10px 12px;text-align:right">Rs ${order.total.toLocaleString()}</td>
    </tr></tfoot>
  </table>
  ${order.shippingAddress ? `<p><strong>Shipping to:</strong> ${order.shippingAddress}</p>` : ""}
  ${invoiceBtn}
  <p>Track at: <a href="https://geem.pk/track" style="color:#e63946">geem.pk/track</a> — use order <strong>#${order.orderNumber}</strong></p>
  <p style="color:#666;font-size:13px;margin-top:24px">Questions? WhatsApp us at <a href="https://wa.me/923078680005">+92 307-8680005</a> or email <a href="mailto:support@geem.pk">support@geem.pk</a></p>
  <p style="font-size:15px;margin-top:16px">Thank you for shopping with Geem ❤️</p>
</div>
<div style="background:#f5f5f5;padding:16px 24px;text-align:center;font-size:12px;color:#888">
  Geem Global Services Pvt Limited · Ahmadpur East, Bahawalpur · <a href="mailto:support@geem.pk">support@geem.pk</a>
</div>
</body></html>`;

  return sendEmail({
    to: order.customerEmail,
    subject: `Order Confirmed — #${order.orderNumber} | Geem`,
    html,
  });
}

export async function sendInvoiceEmail(invoice: {
  customerName: string;
  customerEmail: string;
  invoiceNumber: string;
  date: string;
  status: string;
  items: { description: string; qty: number; amount: number }[];
  subtotal: number;
  discount: number;
  tax: number;
  shipping: number;
  total: number;
  paid: number;
  balanceDue: number;
  notes?: string | null;
  invoiceUrl?: string;
}): Promise<boolean> {
  if (!invoice.customerEmail) return false;
  const fmt = (n: number) => `Rs ${n.toLocaleString("en-PK")}`;
  const itemRows = invoice.items.map(i =>
    `<tr><td style="padding:6px 12px;border-bottom:1px solid #f0f0f0">${i.description}</td><td style="padding:6px 12px;border-bottom:1px solid #f0f0f0;text-align:center">${i.qty}</td><td style="padding:6px 12px;border-bottom:1px solid #f0f0f0;text-align:right">${fmt(i.amount)}</td></tr>`
  ).join("");

  const statusColor = invoice.balanceDue > 0 ? "#ef4444" : "#22c55e";
  const statusLabel = invoice.balanceDue > 0 ? `Balance Due: ${fmt(invoice.balanceDue)}` : "Fully Paid ✅";

  const viewBtn = invoice.invoiceUrl
    ? `<div style="text-align:center;margin:24px 0">
        <a href="${invoice.invoiceUrl}" style="background:#b91c1c;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;display:inline-block">📄 View & Print Invoice</a>
        <p style="font-size:12px;color:#aaa;margin-top:8px">Or copy: ${invoice.invoiceUrl}</p>
      </div>`
    : "";

  const html = `
<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#333">
<div style="background:#b91c1c;padding:20px 24px">
  <h1 style="color:#fff;margin:0;font-size:22px">Geem — Invoice ${invoice.invoiceNumber}</h1>
</div>
<div style="padding:24px">
  <p>Dear <strong>${invoice.customerName}</strong>,</p>
  <p>Please find your invoice details below.</p>
  ${viewBtn}
  <div style="display:flex;justify-content:space-between;margin:16px 0;font-size:14px">
    <span><strong>Invoice #:</strong> ${invoice.invoiceNumber}</span>
    <span><strong>Date:</strong> ${invoice.date}</span>
  </div>
  <table style="width:100%;border-collapse:collapse;margin:16px 0">
    <thead><tr style="background:#f5f5f5">
      <th style="padding:8px 12px;text-align:left">Description</th>
      <th style="padding:8px 12px;text-align:center">Qty</th>
      <th style="padding:8px 12px;text-align:right">Amount</th>
    </tr></thead>
    <tbody>${itemRows}</tbody>
  </table>
  <table style="width:100%;font-size:14px;margin:8px 0">
    ${invoice.discount > 0 ? `<tr><td style="padding:4px 12px;color:#666">Discount</td><td style="padding:4px 12px;text-align:right;color:#666">−${fmt(invoice.discount)}</td></tr>` : ""}
    ${invoice.tax > 0 ? `<tr><td style="padding:4px 12px;color:#666">Tax</td><td style="padding:4px 12px;text-align:right;color:#666">${fmt(invoice.tax)}</td></tr>` : ""}
    ${invoice.shipping > 0 ? `<tr><td style="padding:4px 12px;color:#666">Shipping</td><td style="padding:4px 12px;text-align:right;color:#666">${fmt(invoice.shipping)}</td></tr>` : ""}
    <tr style="font-weight:bold;font-size:16px;border-top:2px solid #eee">
      <td style="padding:8px 12px">Total</td><td style="padding:8px 12px;text-align:right">${fmt(invoice.total)}</td>
    </tr>
    ${invoice.paid > 0 ? `<tr><td style="padding:4px 12px;color:#22c55e">Paid</td><td style="padding:4px 12px;text-align:right;color:#22c55e">${fmt(invoice.paid)}</td></tr>` : ""}
  </table>
  <div style="background:${statusColor}15;border-left:4px solid ${statusColor};padding:10px 14px;border-radius:4px;margin:16px 0">
    <strong style="color:${statusColor}">${statusLabel}</strong>
  </div>
  ${invoice.notes ? `<p style="font-size:13px;color:#666"><strong>Notes:</strong> ${invoice.notes}</p>` : ""}
  <p style="color:#666;font-size:13px;margin-top:24px">Questions? Reply to this email or WhatsApp us at <a href="https://wa.me/923078680005">+92 307-8680005</a></p>
</div>
<div style="background:#f5f5f5;padding:16px 24px;text-align:center;font-size:12px;color:#888">
  Geem Global Services Pvt Limited · Ahmadpur East, Bahawalpur · <a href="mailto:support@geem.pk">support@geem.pk</a>
</div>
</body></html>`;

  return sendEmail({
    to: invoice.customerEmail,
    subject: `Invoice ${invoice.invoiceNumber} — Geem`,
    html,
    replyTo: "info@geem.pk",
  });
}

export async function sendLowStockAlert(items: {
  brand: string;
  model: string;
  inStockCount: number;
}[]): Promise<boolean> {
  const rows = items.map(i =>
    `<tr><td style="padding:6px 12px;border-bottom:1px solid #f5f5f5">${i.brand}</td><td style="padding:6px 12px;border-bottom:1px solid #f5f5f5">${i.model}</td><td style="padding:6px 12px;border-bottom:1px solid #f5f5f5;text-align:center;color:${i.inStockCount === 0 ? "#ef4444" : "#f59e0b"};font-weight:bold">${i.inStockCount}</td></tr>`
  ).join("");

  const html = `
<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#333">
<div style="background:#f59e0b;padding:20px 24px">
  <h1 style="color:#fff;margin:0;font-size:20px">⚠️ Geem — Low Stock Alert</h1>
</div>
<div style="padding:24px">
  <p>The following products are running low or out of stock as of <strong>${new Date().toLocaleDateString("en-PK", { timeZone: "Asia/Karachi", dateStyle: "long" })}</strong>:</p>
  <table style="width:100%;border-collapse:collapse;margin:16px 0">
    <thead><tr style="background:#f5f5f5">
      <th style="padding:8px 12px;text-align:left">Brand</th>
      <th style="padding:8px 12px;text-align:left">Model</th>
      <th style="padding:8px 12px;text-align:center">In Stock</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <p style="font-size:13px;color:#666">Login to <a href="https://crm.geem.pk">crm.geem.pk</a> to restock inventory or update product listings.</p>
</div>
<div style="background:#f5f5f5;padding:16px 24px;text-align:center;font-size:12px;color:#888">
  Geem Global Services Pvt Limited · <a href="mailto:info@geem.pk">info@geem.pk</a>
</div>
</body></html>`;

  return sendAdminAlert({ subject: `Low Stock Alert — ${items.length} item(s) | Geem`, html });
}

export async function sendCustomerAlert(opts: {
  customerName: string;
  customerEmail: string;
  subject: string;
  message: string;
}): Promise<boolean> {
  if (!opts.customerEmail) return false;
  const html = `
<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#333">
<div style="background:#e63946;padding:20px 24px">
  <h1 style="color:#fff;margin:0;font-size:20px">Geem</h1>
</div>
<div style="padding:24px">
  <p>Dear <strong>${opts.customerName}</strong>,</p>
  <div style="white-space:pre-wrap;line-height:1.7">${opts.message.replace(/\n/g, "<br>")}</div>
  <p style="color:#666;font-size:13px;margin-top:24px">Questions? WhatsApp us at <a href="https://wa.me/923078680005">+92 307-8680005</a></p>
</div>
<div style="background:#f5f5f5;padding:16px 24px;text-align:center;font-size:12px;color:#888">
  Geem Global Services Pvt Limited · Ahmadpur East, Bahawalpur · <a href="mailto:support@geem.pk">support@geem.pk</a>
</div>
</body></html>`;
  return sendEmail({ to: opts.customerEmail, subject: opts.subject, html, replyTo: "info@geem.pk" });
}

export async function sendOrderStatusUpdate(order: {
  customerName: string;
  customerEmail: string;
  orderNumber: string;
  status: "processing" | "delivered" | "cancelled" | "rejected";
  rejectionReason?: string | null;
  courierCn?: string | null;
  invoiceUrl?: string;
}): Promise<boolean> {
  if (!order.customerEmail) return false;

  const configs: Record<string, { color: string; icon: string; heading: string; verb: string; thankYou: boolean }> = {
    processing: {
      color: "#f59e0b", icon: "⚙️",
      heading: "Order Being Processed",
      verb: "being processed! We'll notify you as soon as it ships.",
      thankYou: false,
    },
    delivered: {
      color: "#22c55e", icon: "📦",
      heading: "Order Delivered!",
      verb: "delivered! We hope you love your purchase.",
      thankYou: true,
    },
    cancelled: {
      color: "#ef4444", icon: "❌",
      heading: "Order Cancelled",
      verb: `cancelled.${order.rejectionReason ? ` Reason: ${order.rejectionReason}` : ""} If you have questions, please contact us.`,
      thankYou: false,
    },
    rejected: {
      color: "#ef4444", icon: "🚫",
      heading: "Order Could Not Be Fulfilled",
      verb: `not fulfilled.${order.rejectionReason ? ` Reason: ${order.rejectionReason}` : ""} Please contact us for assistance.`,
      thankYou: false,
    },
  };

  const cfg = configs[order.status];
  if (!cfg) return false;

  const invoiceBtn = order.invoiceUrl
    ? `<div style="text-align:center;margin:24px 0">
        <a href="${order.invoiceUrl}" style="background:#e63946;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;display:inline-block">📄 View Invoice</a>
        <p style="font-size:12px;color:#aaa;margin-top:8px">Or copy: ${order.invoiceUrl}</p>
      </div>`
    : "";

  const html = `
<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#333">
<div style="background:#e63946;padding:20px 24px">
  <h1 style="color:#fff;margin:0;font-size:22px">Geem — ${cfg.icon} ${cfg.heading}</h1>
</div>
<div style="padding:24px">
  <p style="font-size:16px">Assalam-o-Alaikum <strong>${order.customerName}</strong>! 🎉</p>
  <div style="background:${cfg.color}15;border-left:4px solid ${cfg.color};padding:12px 16px;border-radius:4px;margin:16px 0">
    <p style="margin:0">Your order from <strong>Geem.pk</strong> — <strong>#${order.orderNumber}</strong> has been ${cfg.verb}</p>
  </div>
  ${invoiceBtn}
  <p>Track at: <a href="https://geem.pk/track" style="color:#e63946">geem.pk/track</a> — use order <strong>#${order.orderNumber}</strong></p>
  <p style="color:#666;font-size:13px;margin-top:24px">Questions? WhatsApp us at <a href="https://wa.me/923078680005">+92 307-8680005</a> or email <a href="mailto:support@geem.pk">support@geem.pk</a></p>
  ${cfg.thankYou ? `<p style="font-size:15px;margin-top:16px">Thank you for shopping with Geem ❤️</p>` : ""}
</div>
<div style="background:#f5f5f5;padding:16px 24px;text-align:center;font-size:12px;color:#888">
  Geem Global Services Pvt Limited · Ahmadpur East, Bahawalpur · <a href="mailto:support@geem.pk">support@geem.pk</a>
</div>
</body></html>`;

  const subjectMap: Record<string, string> = {
    processing: `Order #${order.orderNumber} — Being Processed | Geem`,
    delivered: `Order #${order.orderNumber} — Delivered ✅ | Geem`,
    cancelled: `Order #${order.orderNumber} — Cancelled | Geem`,
    rejected: `Order #${order.orderNumber} — Could Not Be Fulfilled | Geem`,
  };

  return sendEmail({
    to: order.customerEmail,
    subject: subjectMap[order.status],
    html,
  });
}

export async function sendShippingNotification(order: {
  customerName: string;
  customerEmail: string;
  orderNumber: string;
  courierName?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  shippingAddress?: string;
  items?: { description: string; qty: number; amount: number }[];
  subtotal?: number;
  shipping?: number;
  total?: number;
  invoiceUrl?: string;
  invoiceHtml?: string;
}): Promise<boolean> {
  if (!order.customerEmail) return false;

  const cnDisplay = order.trackingNumber
    ? (order.trackingUrl
        ? `<a href="${order.trackingUrl}" style="color:#e63946;font-weight:700;text-decoration:none">${order.trackingNumber} ↗</a>`
        : `<strong>${order.trackingNumber}</strong>`)
    : "";
  const trackingLine = order.trackingNumber
    ? `<tr><td style="padding:6px 0;color:#888;font-size:13px">Courier / CN</td><td style="padding:6px 0">${cnDisplay}${order.courierName ? `<span style="color:#888;font-size:12px"> — ${order.courierName}</span>` : ""}${order.trackingUrl ? `<br/><a href="${order.trackingUrl}" style="font-size:12px;color:#2563eb">🔗 Click to track your parcel</a>` : ""}</td></tr>`
    : "";

  const itemRows = (order.items ?? []).map(i =>
    `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0">${i.description}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:center">${i.qty}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:600">Rs ${i.amount.toLocaleString()}</td>
    </tr>`
  ).join("");

  const itemsTable = order.items?.length
    ? `<table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">
        <thead><tr style="background:#f9f9f9">
          <th style="padding:8px 12px;text-align:left;font-size:11px;color:#888;border-bottom:2px solid #eee">Item</th>
          <th style="padding:8px 12px;text-align:center;font-size:11px;color:#888;border-bottom:2px solid #eee">Qty</th>
          <th style="padding:8px 12px;text-align:right;font-size:11px;color:#888;border-bottom:2px solid #eee">Amount</th>
        </tr></thead>
        <tbody>${itemRows}</tbody>
      </table>
      <table style="width:200px;margin-left:auto;font-size:14px">
        ${order.subtotal != null ? `<tr><td style="padding:4px 12px;color:#888">Subtotal</td><td style="padding:4px 12px;text-align:right">Rs ${order.subtotal.toLocaleString()}</td></tr>` : ""}
        ${order.shipping != null ? `<tr><td style="padding:4px 12px;color:#888">Shipping</td><td style="padding:4px 12px;text-align:right">Rs ${order.shipping.toLocaleString()}</td></tr>` : ""}
        ${order.total != null ? `<tr style="font-weight:800;font-size:16px;color:#cc0000;border-top:2px solid #eee"><td style="padding:8px 12px">Total</td><td style="padding:8px 12px;text-align:right">Rs ${order.total.toLocaleString()}</td></tr>` : ""}
      </table>`
    : "";

  const invoiceBtn = order.invoiceUrl
    ? `<div style="text-align:center;margin:24px 0">
        <a href="${order.invoiceUrl}" style="background:#e63946;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;display:inline-block">📄 View Invoice</a>
        <p style="font-size:12px;color:#aaa;margin-top:8px">Or copy: ${order.invoiceUrl}</p>
      </div>`
    : "";

  const html = `
<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#333">
<div style="background:#e63946;padding:20px 24px">
  <h1 style="color:#fff;margin:0;font-size:22px">Geem — Your Order is Shipped! 🚚</h1>
</div>
<div style="padding:24px">
  <p style="font-size:16px">Assalam-o-Alaikum <strong>${order.customerName}</strong>! 🎉</p>
  <p>Your order from <strong>Geem.pk</strong> has been shipped! 🚚</p>

  <table style="width:100%;font-size:14px;margin:16px 0">
    <tr><td style="padding:6px 0;color:#888;font-size:13px">Order</td><td style="padding:6px 0;font-weight:600">#${order.orderNumber}</td></tr>
    ${trackingLine}
    ${order.shippingAddress ? `<tr><td style="padding:6px 0;color:#888;font-size:13px">Shipping to</td><td style="padding:6px 0">${order.shippingAddress}</td></tr>` : ""}
  </table>

  <hr style="border:none;border-top:1px solid #f0f0f0;margin:20px 0">
  <h3 style="font-size:14px;color:#333;margin-bottom:4px">Items</h3>
  ${itemsTable}

  ${invoiceBtn}

  <p>Track at: <a href="https://geem.pk/track" style="color:#e63946">geem.pk/track</a> — use order <strong>#${order.orderNumber}</strong></p>
  <p style="color:#666;font-size:13px;margin-top:24px">Questions? WhatsApp us at <a href="https://wa.me/923078680005" style="color:#e63946">+92 307-8680005</a> or email <a href="mailto:support@geem.pk" style="color:#e63946">support@geem.pk</a></p>
  <p style="font-size:15px;margin-top:16px">Thank you for shopping with Geem ❤️</p>
</div>
<div style="background:#f5f5f5;padding:16px 24px;text-align:center;font-size:12px;color:#888">
  Geem Global Services Pvt Limited · Ahmadpur East, Bahawalpur · <a href="mailto:support@geem.pk">support@geem.pk</a>
</div>
</body></html>`;

  return sendEmail({
    to: order.customerEmail,
    subject: `Shipped — Order #${order.orderNumber} | Geem`,
    html,
    attachments: order.invoiceHtml
      ? [{ filename: `Invoice-${order.orderNumber}.html`, content: order.invoiceHtml, contentType: "text/html" }]
      : undefined,
  });
}

export async function sendPasswordReset(opts: {
  name: string;
  email: string;
  resetUrl: string;
  expiryMinutes: number;
}): Promise<boolean> {
  if (!opts.email) return false;
  const html = `
<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#333">
<div style="background:#e63946;padding:20px 24px">
  <h1 style="color:#fff;margin:0;font-size:22px">Geem — Reset Your Password</h1>
</div>
<div style="padding:24px">
  <p>Hi <strong>${opts.name}</strong>,</p>
  <p>We received a request to reset your password. Click the button below to set a new one:</p>
  <div style="text-align:center;margin:24px 0">
    <a href="${opts.resetUrl}" style="background:#e63946;color:#fff;padding:14px 32px;border-radius:6px;text-decoration:none;font-weight:600;font-size:16px;display:inline-block">Reset Password</a>
  </div>
  <p style="font-size:13px;color:#888">Or copy and paste this link into your browser:</p>
  <p style="font-size:12px;color:#aaa;word-break:break-all;background:#f9f9f9;padding:8px 12px;border-radius:4px">${opts.resetUrl}</p>
  <p style="color:#666;font-size:13px;margin-top:24px">This link will expire in <strong>${opts.expiryMinutes} minutes</strong>. If you didn't request this, please ignore this email — your password will stay safe.</p>
  <p style="color:#666;font-size:13px;margin-top:24px">Need help? WhatsApp us at <a href="https://wa.me/923078680005">+92 307-8680005</a></p>
</div>
<div style="background:#f5f5f5;padding:16px 24px;text-align:center;font-size:12px;color:#888">
  Geem Global Services Pvt Limited · Ahmadpur East, Bahawalpur · <a href="mailto:support@geem.pk">support@geem.pk</a>
</div>
</body></html>`;

  return sendEmail({
    to: opts.email,
    subject: "Reset your password — Geem",
    html,
  });
}
