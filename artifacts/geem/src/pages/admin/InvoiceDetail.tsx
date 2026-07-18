import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { axiosInstance } from "@/lib/axios";
import { isIccid, imeiLabel } from "@/lib/utils";
import { toWaPhone } from "@/lib/format";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, DollarSign, Printer, MessageCircle, Share2, FileDown, Link2, Eye, Pencil, Mail, Phone, Send, ChevronDown, Trash2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface InvoiceItem {
  id: number; description: string; qty: number; price: number; amount: number;
  imei: string | null; taxRate: number; brandName: string | null; modelName: string | null;
  deviceId: string | null; ptaStatus: string | null;
}

interface Payment { id: number; date: string; method: string; amount: number; transactionId?: string | null; memo?: string | null; }

interface CompanySettings {
  companyName: string; logo?: string | null; address?: string | null;
  phone?: string | null; fax?: string | null; email?: string | null; website?: string | null;
}

interface Invoice {
  id: number; invoiceNumber: string; status: string; date: string; dueDate: string | null;
  customerName: string; customerPhone: string | null; customerCity: string | null;
  customerAddress: string | null; customerId: number; subtotal: number; discount: number;
  tax: number; shipping: number; total: number; paid: number; balanceDue: number;
  currency: string; currencySymbol: string;
  notes: string | null; items: InvoiceItem[]; payments: Payment[];
  orderPaymentMethod?: string | null;
}

const statusColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  paid: "default", partial: "secondary", draft: "outline", overdue: "destructive",
};

function fmtDate(d: string): string {
  try {
    return new Date(d + "T00:00:00").toLocaleDateString("en-PK", { timeZone: "Asia/Karachi", year: "numeric", month: "long", day: "numeric" });
  } catch { return d; }
}

function fmtRs(n: number, sym?: string): string {
  return (sym ?? "₨") + n.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function pdfSym(invoice: Invoice): string {
  return invoice.currency === "PKR" ? "₨" : invoice.currencySymbol;
}

const _LOGO_PATHS = `<path transform="translate(1635,135)" d="m0 0h32l23 4 18 6 16 8 14 10 10 9 8 8 3 4v2l5-3 9-9 13-10 13-8 16-8 16-6 23-5 14-2h36l25 4 17 5 20 9 15 10 14 12 11 13 10 15 8 17 7 23 3 17 1 11v252h-103l-1-232-3-16-5-12-6-10-7-8-10-7-12-5-10-2h-22l-14 3-12 5-11 7-8 7-9 13-6 13-3 11-1 7-1 24v201l-1 1h-102l-1-229-3-18-5-13-7-11-5-6-11-8-12-5-10-2h-22l-18 4-14 7-11 9-9 11-7 14-4 14-2 16-1 217h-103l-1-1v-380h103v36l8-7 11-9 16-10 17-8 16-5z" fill="#EC2029"/><path transform="translate(1195,134)" d="m0 0h35l24 3 25 6 17 6 19 9 17 11 14 11 14 14 11 14 9 14 8 15 9 23 5 19 3 18 1 11v45l-1 11-2 1h-290l7 21 8 15 8 10 12 12 13 8 13 6 15 4 13 2h26l22-4 15-5 19-10 14-11 10-10 7-9 5 2 15 9 28 17 24 15 6 4-7 11-11 13-9 10-11 10-16 12-17 10-19 9-24 8-26 5-27 3h-29l-25-3-20-4-27-9-16-8-14-8-11-8-10-8-19-19-10-13-12-20-10-22-6-19-4-19-3-27v-24l3-26 6-25 8-20 8-17 12-19 12-14 9-10 7-7 14-11 15-10 19-10 24-9 21-5zm2 85-20 4-16 7-11 7-12 11-10 13-9 17-3 10h186l-3-12-8-16-8-11-12-12-13-8-14-6-12-3-7-1z" fill="#EC2029"/><path transform="translate(769,134)" d="m0 0h36l23 3 22 5 18 6 16 7 17 10 17 13 18 18 13 17 11 19 10 24 6 21 3 17 2 25v18l-1 25-2 3h-291l7 20 9 17 9 11 8 8 15 10 11 5 17 5 13 2h26l23-4 19-7 16-9 11-9 4-2 2-4 5-5 7-9 4 1 28 17 26 16 19 12 1 2-9 13-11 13-12 12-11 9-14 10-14 8-16 8-27 9-25 5-28 3h-28l-25-3-20-4-17-5-21-9-17-9-19-14-12-11-8-8-11-14-7-10-9-16-7-15-6-18-5-20-3-22-1-25 2-24 4-22 6-20 8-19 9-17 11-16 11-13 8-9 8-7 15-12 18-11 16-8 21-8 21-5zm2 85-16 3-16 6-13 8-9 7-7 8-8 10-8 16-3 8v3h185l-2-10-7-16-8-11-9-10-12-9-17-8-14-4-8-1z" fill="#EC2029"/><path transform="translate(278,4)" d="m0 0h13l27 2 10 1-2 4-9 9-7 8-28 28-7 8-21 21-7 8-3 3-29 10-23 12-14 10-11 9-15 15-13 17-9 15-9 19-6 18-5 25-1 8v28l3 21 6 23 9 21 8 15 10 14 11 13 10 10 14 11 10 7 14 8 24 10 23 6 18 3h34l24-4 20-6 18-8 16-9 16-12 10-9 11-11 9-11 11-17 2-4-33-1-32-32v-2h-2l-7-8-12-12-5-4-7-8-16-16v-1h224v21l-3 23-6 27-8 24-12 26-11 19-12 17-8 10-12 14-14 14-8 7-18 14-19 12-23 12-19 8-26 8-20 4-15 2-13 1h-41l-18-2-24-5-20-6-20-8-23-11-19-12-11-8-14-11-13-12-13-13-9-11-10-13-10-15-12-22-10-23-8-26-5-23-2-15-1-13v-30l2-20 4-23 7-25 8-21 10-21 12-20 14-19 12-14 21-21 14-11 17-12 19-11 23-11 25-9 29-7 24-3z" fill="#EC2029"/><path transform="translate(402,33)" d="m0 0 6 1 24 14 11 8 13 10 13 12 3 2-2 4-12 13-43 43-2 3-4-1-11-10-15-11-14-8-14-7-16-6 2-4 15-15 7-8 23-23 7-8z" fill="#EC2029"/>`;

const LOGO_SVG_INV = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2048 550" width="210" height="57">${_LOGO_PATHS}</svg>`;

const LOGO_SVG_RCPT = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2048 550" width="180" height="48">${_LOGO_PATHS}</svg>`;

const WAVE_CSS = `
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Arial,Helvetica,sans-serif;color:#333;font-size:13px;line-height:1.4}
.page{max-width:820px;margin:0 auto;padding:40px 48px}
.no-print{background:#fef3c7;padding:10px 16px;border-radius:6px;margin-bottom:16px;font-size:12px;text-align:center}
@media print{.no-print{display:none!important}@page{size:A4;margin:15mm}}
.hdr{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px}
.logo-block{display:flex;align-items:flex-start;padding-top:4px}
.co-block{text-align:right}
.inv-title{font-size:32px;font-weight:900;letter-spacing:3px;color:#222;margin-bottom:10px}
.co-name{font-size:13px;font-weight:700;margin-bottom:3px}
.co-line{font-size:12px;color:#555;line-height:1.7}
.meta-row{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;gap:24px}
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
.i-pta{font-family:Arial,sans-serif;font-size:11px;color:#166534;margin-top:2px}
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
  .hdr{justify-content:flex-start}
  .co-block{text-align:left}
  .meta-row{flex-direction:column;gap:16px}
  .inv-meta-tbl{margin-left:0}
  .inv-meta-tbl .lbl{text-align:left}
  .inv-meta-tbl .val{text-align:left}
  .totals-wrap{justify-content:flex-start}
  .tot-tbl{width:100%}
  .items-tbl th,.items-tbl td{padding:7px 4px;font-size:12px}
}
`;

function buildInvoiceHtml(invoice: Invoice, company: CompanySettings): string {
  const addressLines = (company.address ?? "").split("\n").filter(Boolean);
  const itemRows = invoice.items.map(item => `
    <tr>
      <td>
        <div class="i-name">${item.description}</div>
        ${item.deviceId
          ? `<div class="i-sub">Device ID#<br/>${item.deviceId}</div>${item.imei ? `<div class="i-sub">${imeiLabel(item.imei)}: ${item.imei}</div>` : ""}`
          : item.imei ? `<div class="i-sub" style="font-weight:700;color:#333">${imeiLabel(item.imei)}: ${item.imei}</div>` : ""}
      </td>
      <td class="c">${item.qty}</td>
      <td class="r">${fmtRs(item.price, pdfSym(invoice))}</td>
      <td class="r">${fmtRs(item.amount, pdfSym(invoice))}</td>
    </tr>`).join("");

  const paymentRows = invoice.payments.map(p => `
    <tr class="pmnt-row">
      <td class="lbl">Payment on ${fmtDate(p.date)} using ${p.method}${p.transactionId ? ` (${p.transactionId})` : ""}:</td>
      <td class="val" style="color:#166534">${fmtRs(p.amount, pdfSym(invoice))}</td>
    </tr>`).join("");

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>INVOICE ${invoice.invoiceNumber}</title>
  <style>${WAVE_CSS}</style></head><body>
  <div class="no-print">
    <strong>💡 To save as PDF:</strong> Choose <strong>Save as PDF</strong> in the print dialog.
    <button onclick="window.print()" style="margin-left:12px;padding:5px 14px;background:#2563eb;color:#fff;border:none;border-radius:5px;cursor:pointer;font-size:12px">🖨 Print / Save PDF</button>
  </div>
  <div class="page">
    <div class="hdr">
      <div class="logo-block">${LOGO_SVG_INV}</div>
      <div class="co-block">
        <div class="inv-title">INVOICE</div>
        <div class="co-name">${company.companyName}</div>
        ${addressLines.map(l => `<div class="co-line">${l}</div>`).join("")}
        ${company.fax ? `<div class="co-line">Fax: ${company.fax}</div>` : ""}
        ${company.email ? `<div class="co-line">Email: ${company.email}</div>` : ""}
        ${company.phone ? `<div class="co-line">Mobile: ${company.phone}</div>` : ""}
        ${company.website ? `<div class="co-line">${company.website}</div>` : ""}
      </div>
    </div>

    <div class="meta-row">
      <div>
        <div class="bill-to-lbl">Bill To</div>
        <div class="bill-to-body">
          <strong>${invoice.customerName}</strong><br/>
          ${invoice.customerAddress ? `${invoice.customerAddress}<br/>` : ""}
          ${invoice.customerCity ? `${invoice.customerCity}<br/>` : ""}
          Pakistan<br/>
          ${invoice.customerPhone ?? ""}
        </div>
      </div>
      <div>
        <table class="inv-meta-tbl">
          <tr><td class="lbl">Invoice Number:</td><td class="val">${invoice.invoiceNumber}</td></tr>
          <tr><td class="lbl">Invoice Date:</td><td class="val">${fmtDate(invoice.date)}</td></tr>
          ${invoice.dueDate ? `<tr><td class="lbl">Payment Due:</td><td class="val">${fmtDate(invoice.dueDate)}</td></tr>` : ""}
          <tr><td class="lbl due-lbl">Amount Due (${invoice.currency}):</td><td class="val due-val">${fmtRs(invoice.balanceDue, pdfSym(invoice))}</td></tr>
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
        <tr><td class="lbl">Subtotal:</td><td class="val">${fmtRs(invoice.subtotal, pdfSym(invoice))}</td></tr>
        ${invoice.discount > 0 ? `<tr><td class="lbl">Discount:</td><td class="val">(${fmtRs(invoice.discount, pdfSym(invoice))})</td></tr>` : ""}
        ${invoice.shipping > 0 ? `<tr><td class="lbl">Shipping:</td><td class="val">${fmtRs(invoice.shipping, pdfSym(invoice))}</td></tr>` : ""}
        ${invoice.tax > 0 ? `<tr><td class="lbl">Tax:</td><td class="val">${fmtRs(invoice.tax, pdfSym(invoice))}</td></tr>` : ""}
        <tr class="total-row"><td class="lbl">Total:</td><td class="val">${fmtRs(invoice.total, pdfSym(invoice))}</td></tr>
        ${paymentRows}
        <tr class="due-row"><td class="lbl">Amount Due (${invoice.currency}):</td><td class="val">${fmtRs(invoice.balanceDue, pdfSym(invoice))}</td></tr>
      </table>
    </div>

    ${invoice.notes ? `<div class="notes-box"><strong>Notes:</strong> ${invoice.notes}</div>` : ""}
    <div class="pg-footer">${company.companyName} &nbsp;|&nbsp; ${company.email ?? ""} &nbsp;|&nbsp; ${company.phone ?? ""} &nbsp;|&nbsp; ${company.website ?? ""}</div>
  </div>
  </body></html>`;
}

function buildPaymentReceiptHtml(invoice: Invoice, company: CompanySettings, payment: Payment, slipBalance?: number): string {
  const addressLines = (company.address ?? "").split("\n").filter(Boolean);
  const balance = slipBalance ?? invoice.balanceDue;
  const memoText = payment.memo || payment.transactionId;

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Payment Receipt — ${invoice.invoiceNumber}</title>
  <style>${WAVE_CSS}
  .rcpt-page{max-width:560px;margin:0 auto;padding:48px 40px;text-align:center}
  .rcpt-title{font-size:22px;font-weight:700;margin-bottom:8px}
  .rcpt-sub{font-size:13px;color:#555;line-height:1.8}
  .rcpt-hr{border:none;border-top:1px solid #ddd;margin:20px 0}
  .rcpt-co{font-size:13px;color:#444;line-height:1.7}
  .rcpt-co-name{font-weight:700}
  .rcpt-memo{text-align:left;margin:16px 0;font-size:13px;color:#444;line-height:1.6;padding:12px 16px;background:#f9f9f9;border-radius:6px;border:1px solid #e5e5e5}
  .rcpt-amount{font-size:16px;font-weight:700;margin:16px 0}
  .rcpt-method{font-size:13px;font-weight:700;letter-spacing:0.8px;margin:10px 0;color:#333}
  .rcpt-footer{margin-top:20px;font-size:11px;color:#999;line-height:1.6}
  </style></head><body>
  <div class="no-print" style="max-width:560px;margin:0 auto">
    <strong>💡 To save as PDF:</strong> Choose <strong>Save as PDF</strong> in the print dialog.
    <button onclick="window.print()" style="margin-left:12px;padding:5px 14px;background:#2563eb;color:#fff;border:none;border-radius:5px;cursor:pointer;font-size:12px">🖨 Print / Save PDF</button>
  </div>
  <div class="rcpt-page">
    <div style="margin-bottom:14px;text-align:center">${LOGO_SVG_RCPT}</div>
    <div class="rcpt-title">Payment Receipt</div>
    <div class="rcpt-sub">
      Invoice #${invoice.invoiceNumber}<br/>
      for ${invoice.customerName}<br/>
      paid on ${fmtDate(payment.date)}
    </div>

    <hr class="rcpt-hr"/>

    <div class="rcpt-co">
      <div class="rcpt-co-name">${company.companyName}</div>
      ${addressLines.map(l => `<div>${l}</div>`).join("")}
      ${company.fax ? `<div>Fax: ${company.fax}</div>` : ""}
      ${company.email ? `<div>Email: ${company.email}</div>` : ""}
      ${company.phone ? `<div>Mobile: ${company.phone}</div>` : ""}
      ${company.website ? `<div>${company.website}</div>` : ""}
    </div>

    <hr class="rcpt-hr"/>

    ${memoText ? `<div class="rcpt-memo">${memoText}</div>` : ""}

    <div class="rcpt-amount">Payment Amount: ${fmtRs(payment.amount, pdfSym(invoice))} ${invoice.currency}</div>

    <hr class="rcpt-hr"/>

    <div class="rcpt-method">PAYMENT METHOD: ${payment.method.replace(/_/g, " ").toUpperCase()}</div>

    <hr class="rcpt-hr"/>

    ${balance > 0
      ? `<div style="font-size:13px;color:#dc2626;font-weight:600;margin:8px 0">Balance Due: ${fmtRs(balance, pdfSym(invoice))}</div>`
      : ""}

    <div class="rcpt-footer">
      Thanks for your business. If this invoice was sent in error,<br/>
      please contact ${company.email ?? "info@geem.pk"}
    </div>
  </div>
  </body></html>`;
}

function openPrintWindow(html: string) {
  const w = window.open("", "_blank", "width=900,height=700");
  if (w) { w.document.write(html); w.document.close(); w.focus(); setTimeout(() => w.print(), 400); }
}

function openViewWindow(html: string) {
  const w = window.open("", "_blank", "width=900,height=700");
  if (w) { w.document.write(html); w.document.close(); w.focus(); }
}

function openInvoiceTab(html: string) {
  const w = window.open("", "_blank");
  if (w) { w.document.write(html); w.document.close(); w.focus(); }
}

function handleWhatsAppWeb(invoice: Invoice) {
  const sym = invoice.currencySymbol;
  const items = invoice.items.map(i =>
    `• ${i.description}${i.imei ? ` (${imeiLabel(i.imei)}: ${i.imei})` : ""} — ${sym} ${i.amount.toLocaleString()}`
  ).join("\n");
  const invoiceUrl = `https://geem.pk/api/invoices/${invoice.id}/print`;
  const msg = `*Invoice ${invoice.invoiceNumber}*\nDate: ${invoice.date}\n\n*Items:*\n${items}\n\n*Total: ${sym} ${invoice.total.toLocaleString()}*\n${invoice.balanceDue > 0 ? `Balance Due: ${sym} ${invoice.balanceDue.toLocaleString()}` : "✅ Fully Paid"}\n\nView/Download Invoice:\n${invoiceUrl}\n\n_Geem.pk_`;
  const url = `https://wa.me/${toWaPhone(invoice.customerPhone)}?text=${encodeURIComponent(msg)}`;
  window.open(url, "_blank");
}

function buildPaymentWhatsAppMsg(invoice: Invoice, payment: Payment, slipBalance?: number): string {
  const sym = invoice.currencySymbol;
  const balance = slipBalance ?? invoice.balanceDue;
  const slipUrl = `https://geem.pk/api/invoices/${invoice.id}/payments/${payment.id}/slip`;
  return [
    `Assalam-o-Alaikum *${invoice.customerName}*!`,
    ``,
    `Payment received against your invoice ✅`,
    ``,
    `Invoice: ${invoice.invoiceNumber}`,
    `Date: ${payment.date}`,
    `Method: ${payment.method.replace(/_/g, " ")}`,
    payment.transactionId ? `Ref: ${payment.transactionId}` : null,
    ``,
    `*Amount Paid: ${sym} ${Number(payment.amount).toLocaleString()}*`,
    `Invoice Total: ${sym} ${Number(invoice.total).toLocaleString()}`,
    balance > 0
      ? `Balance Due: ${sym} ${balance.toLocaleString()}`
      : `Status: ✅ Fully Paid`,
    ``,
    `View / Download Payment Receipt:`,
    slipUrl,
    ``,
    `Questions? WhatsApp: +92 307-8680005`,
    ``,
    `Thank you for your business with Geem ❤️`,
  ].filter(l => l !== null).join("\n");
}

function handlePaymentWhatsApp(invoice: Invoice, payment: Payment) {
  const msg = buildPaymentWhatsAppMsg(invoice, payment);
  const url = `https://wa.me/${toWaPhone(invoice.customerPhone)}?text=${encodeURIComponent(msg)}`;
  window.open(url, "_blank");
}

export default function InvoiceDetail() {
  const params = useParams<{ id: string }>();
  const { toast } = useToast();
  const qc = useQueryClient();
  const id = params?.id;
  const [showPayment, setShowPayment] = useState(false);
  const [editPayment, setEditPayment] = useState<Payment | null>(null);
  const [deletePaymentId, setDeletePaymentId] = useState<number | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [showPaymentSlip, setShowPaymentSlip] = useState<Payment | null>(null);
  const [sendingChannel, setSendingChannel] = useState<string | null>(null);
  // Optimistic totals to show correct values in slip before re-fetch arrives
  const [slipTotals, setSlipTotals] = useState<{ paid: number; balanceDue: number } | null>(null);
  const [payForm, setPayForm] = useState({ date: new Date().toISOString().split("T")[0], method: "cash", amount: "", transactionId: "", memo: "" });

  // Reset payment form (pre-fill balance) when record dialog opens
  useEffect(() => {
    if (showPayment) {
      setPayForm({
        date: new Date().toISOString().split("T")[0],
        method: invoice?.orderPaymentMethod === "cod" ? "cod" : "cash",
        amount: invoice ? String(invoice.balanceDue) : "",
        transactionId: "",
        memo: "",
      });
    }
  }, [showPayment]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pre-fill form when edit dialog opens
  useEffect(() => {
    if (editPayment) {
      setPayForm({
        date: editPayment.date,
        method: editPayment.method,
        amount: String(editPayment.amount),
        transactionId: editPayment.transactionId ?? "",
        memo: editPayment.memo ?? "",
      });
    }
  }, [editPayment]);

  const { data: invoice, isLoading } = useQuery({
    queryKey: ["invoice", id],
    queryFn: () => axiosInstance.get<Invoice>(`/invoices/${id}`).then(r => r.data),
    enabled: !!id,
  });

  const { data: companyCfg } = useQuery({
    queryKey: ["company-settings"],
    queryFn: () => axiosInstance.get<CompanySettings>("/settings/company").then(r => r.data),
    staleTime: 5 * 60 * 1000,
  });

  const company: CompanySettings = companyCfg ?? {
    companyName: "Geem",
    address: "Office #1, Yellow Building, Behind TCS Office\nKutchery Rd, Ahmadpur East\nDistt Bahawalpur, Pakistan 63350",
    phone: "0307-8680005",
    fax: "",
    email: "info@geem.pk",
    website: "www.geem.pk",
  };

  const payMutation = useMutation({
    mutationFn: (payload: typeof payForm) => axiosInstance.post(`/invoices/${id}/payment`, { ...payload, amount: parseFloat(payload.amount) }).then(r => r.data),
    onSuccess: (_, vars) => {
      // Invalidate both the detail view AND the invoices list
      qc.invalidateQueries({ queryKey: ["invoice", id] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
      setShowPayment(false);
      const paidAmt = parseFloat(vars.amount);
      const currentPaid = invoice?.paid ?? 0;
      const currentBalance = invoice?.balanceDue ?? invoice?.total ?? 0;
      // Store optimistic totals so slip shows correct numbers before re-fetch
      setSlipTotals({
        paid: currentPaid + paidAmt,
        balanceDue: Math.max(0, currentBalance - paidAmt),
      });
      const newPayment: Payment = {
        id: Date.now(), date: vars.date, method: vars.method,
        amount: paidAmt, transactionId: vars.transactionId || null,
      };
      setShowPaymentSlip(newPayment);
      setPayForm({ date: new Date().toISOString().split("T")[0], method: "cash", amount: "", transactionId: "", memo: "" });
      toast({ title: "Payment recorded" });
    },
  });

  const statusMutation = useMutation({
    mutationFn: (status: string) => axiosInstance.patch(`/invoices/${id}`, { status }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invoice", id] }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => axiosInstance.delete(`/invoices/${id}`),
    onSuccess: () => { toast({ title: "Invoice deleted" }); window.location.href = "/invoices"; },
  });

  const deletePaymentMutation = useMutation({
    mutationFn: (paymentId: number) => axiosInstance.delete(`/invoices/${id}/payments/${paymentId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoice", id] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
      setDeletePaymentId(null);
      toast({ title: "Payment deleted" });
    },
  });

  const editPaymentMutation = useMutation({
    mutationFn: (payload: typeof payForm) =>
      axiosInstance.patch(`/invoices/${id}/payments/${editPayment!.id}`, { ...payload, amount: parseFloat(payload.amount) }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoice", id] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
      setEditPayment(null);
      toast({ title: "Payment updated" });
    },
  });

  if (isLoading) return <div className="p-8">Loading...</div>;
  if (!invoice) return <div className="p-8">Invoice not found</div>;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/invoices"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />Back</Button></Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{invoice.invoiceNumber}</h1>
          <p className="text-muted-foreground">{invoice.customerName}{invoice.customerCity ? ` — ${invoice.customerCity}` : ""}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={statusColors[invoice.status] ?? "outline"} className="text-sm px-3 py-1">{invoice.status}</Badge>
          <Button variant="outline" size="sm" onClick={() => openInvoiceTab(buildInvoiceHtml(invoice, company))}><Eye className="h-4 w-4 mr-1" />View Invoice</Button>
          <Link href={`/invoices/${invoice.id}/edit`}><Button variant="outline" size="sm"><Pencil className="h-4 w-4 mr-1" />Edit Invoice</Button></Link>
          <Button variant="outline" size="sm" onClick={() => openPrintWindow(buildInvoiceHtml(invoice, company))}><Printer className="h-4 w-4 mr-1" />Print</Button>
          <Button variant="outline" size="sm" onClick={() => openViewWindow(buildInvoiceHtml(invoice, company))}><FileDown className="h-4 w-4 mr-1" />PDF</Button>
          {/* Send Invoice dropdown — Email / WhatsApp (API) / SMS / WhatsApp Web */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={!!sendingChannel}>
                <Send className="h-4 w-4 mr-1" />
                {sendingChannel ? `Sending…` : "Send Invoice"}
                <ChevronDown className="h-3.5 w-3.5 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onClick={async () => {
                setSendingChannel("email");
                try {
                  const r = await axiosInstance.post(`/invoices/${invoice.id}/email`, { channel: "email" });
                  toast({ title: `Invoice emailed to ${r.data.sentTo}` });
                } catch (e: unknown) {
                  const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Failed to send email";
                  toast({ title: msg, variant: "destructive" });
                } finally { setSendingChannel(null); }
              }}>
                <Mail className="h-4 w-4 mr-2 text-blue-600" /> Send via Email
              </DropdownMenuItem>
              <DropdownMenuItem onClick={async () => {
                setSendingChannel("whatsapp");
                try {
                  const r = await axiosInstance.post(`/invoices/${invoice.id}/email`, { channel: "whatsapp" });
                  toast({ title: `Invoice sent via WhatsApp to ${r.data.sentTo}` });
                } catch (e: unknown) {
                  const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Failed to send WhatsApp";
                  toast({ title: msg, variant: "destructive" });
                } finally { setSendingChannel(null); }
              }}>
                <MessageCircle className="h-4 w-4 mr-2 text-green-600" /> Send via WhatsApp
              </DropdownMenuItem>
              <DropdownMenuItem onClick={async () => {
                setSendingChannel("sms");
                try {
                  const r = await axiosInstance.post(`/invoices/${invoice.id}/email`, { channel: "sms" });
                  toast({ title: `Invoice sent via SMS to ${r.data.sentTo}` });
                } catch (e: unknown) {
                  const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Failed to send SMS";
                  toast({ title: msg, variant: "destructive" });
                } finally { setSendingChannel(null); }
              }}>
                <Phone className="h-4 w-4 mr-2 text-violet-600" /> Send via SMS
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleWhatsAppWeb(invoice)}>
                <MessageCircle className="h-4 w-4 mr-2 text-emerald-500" /> WhatsApp App (Mobile)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => {
                const sym = invoice.currencySymbol;
                const items = invoice.items.map(i =>
                  `• ${i.description}${i.imei ? ` (${imeiLabel(i.imei)}: ${i.imei})` : ""} — ${sym} ${i.amount.toLocaleString()}`
                ).join("\n");
                const invoiceUrl = `https://geem.pk/api/invoices/${invoice.id}/print`;
                const msg = `*Invoice ${invoice.invoiceNumber}*\nDate: ${invoice.date}\n\n*Items:*\n${items}\n\n*Total: ${sym} ${invoice.total.toLocaleString()}*\n${invoice.balanceDue > 0 ? `Balance Due: ${sym} ${invoice.balanceDue.toLocaleString()}` : "✅ Fully Paid"}\n\nView/Download Invoice:\n${invoiceUrl}\n\n_Geem.pk_`;
                const intl = toWaPhone(invoice.customerPhone);
                // whatsapp:// opens the installed desktop app on Windows/Mac
                window.location.href = `whatsapp://send?phone=${intl}&text=${encodeURIComponent(msg)}`;
              }}>
                <MessageCircle className="h-4 w-4 mr-2 text-teal-600" /> WhatsApp Desktop App (PC)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => {
                const sym = invoice.currencySymbol;
                const items = invoice.items.map(i =>
                  `• ${i.description}${i.imei ? ` (${imeiLabel(i.imei)}: ${i.imei})` : ""} — ${sym} ${i.amount.toLocaleString()}`
                ).join("\n");
                const invoiceUrl = `https://geem.pk/api/invoices/${invoice.id}/print`;
                const msg = `*Invoice ${invoice.invoiceNumber}*\nDate: ${invoice.date}\n\n*Items:*\n${items}\n\n*Total: ${sym} ${invoice.total.toLocaleString()}*\n${invoice.balanceDue > 0 ? `Balance Due: ${sym} ${invoice.balanceDue.toLocaleString()}` : "✅ Fully Paid"}\n\nView/Download Invoice:\n${invoiceUrl}\n\n_Geem.pk_`;
                window.open(`https://web.whatsapp.com/send?phone=${toWaPhone(invoice.customerPhone)}&text=${encodeURIComponent(msg)}`, "_blank");
              }}>
                <MessageCircle className="h-4 w-4 mr-2 text-cyan-600" /> WhatsApp Web (Browser)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => {
                navigator.clipboard.writeText(`https://geem.pk/api/invoices/${invoice.id}/print`);
                toast({ title: "Invoice link copied to clipboard" });
              }}>
                <Link2 className="h-4 w-4 mr-2 text-slate-500" /> Copy Invoice Link
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {invoice.status === "draft" && <Button variant="outline" onClick={() => statusMutation.mutate("overdue")}>Mark Overdue</Button>}
          {invoice.balanceDue > 0 && invoice.status !== "cancelled" && (
            <Button onClick={() => setShowPayment(true)}><DollarSign className="h-4 w-4 mr-1" />Record Payment</Button>
          )}
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">Invoice Date</p>
          <p className="font-semibold">{invoice.date}</p>
          {invoice.dueDate && <p className="text-xs text-muted-foreground">Due: {invoice.dueDate}</p>}
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="text-2xl font-bold">{invoice.currencySymbol} {invoice.total.toLocaleString()}</p>
          <p className="text-xs text-green-600">Paid: {invoice.currencySymbol} {invoice.paid.toLocaleString()}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">Balance Due</p>
          <p className={`text-2xl font-bold ${invoice.balanceDue > 0 ? "text-destructive" : "text-green-600"}`}>
            {invoice.currencySymbol} {invoice.balanceDue.toLocaleString()}
          </p>
        </CardContent></Card>
      </div>

      {/* Customer Info */}
      <Card>
        <CardHeader><CardTitle className="text-base">Customer Details</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-1">
          <p><strong>Name:</strong> {invoice.customerName}</p>
          {invoice.customerPhone && <p><strong>Phone:</strong> {invoice.customerPhone}</p>}
          {invoice.customerCity && <p><strong>City:</strong> {invoice.customerCity}</p>}
          {invoice.customerAddress && <p><strong>Address:</strong> {invoice.customerAddress}</p>}
        </CardContent>
      </Card>

      {/* Items */}
      <Card>
        <CardHeader><CardTitle>Items</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Description</TableHead>
                <TableHead>Device ID / IMEI</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoice.items.map(item => (
                <TableRow key={item.id}>
                  <TableCell>
                    <p className="font-medium">{item.description}</p>
                    {(item.brandName || item.modelName) && (
                      <p className="text-xs text-muted-foreground">{item.brandName} {item.modelName}</p>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs space-y-0.5">
                    {item.deviceId
                      ? <>
                          <p className="font-semibold text-foreground">Device ID: {item.deviceId}</p>
                          {item.imei && <p className="text-muted-foreground">{imeiLabel(item.imei)}: {item.imei}</p>}
                        </>
                      : item.imei
                        ? <p className="font-semibold text-foreground">{imeiLabel(item.imei)}: {item.imei}</p>
                        : "—"}
                    {(item.ptaStatus === "approved" || item.ptaStatus === "paid") && (
                      <p className="font-sans text-[10px] font-medium text-green-600 not-italic">✓ PTA Approved</p>
                    )}
                  </TableCell>
                  <TableCell className="text-right">{item.qty}</TableCell>
                  <TableCell className="text-right">{invoice.currencySymbol} {item.price.toLocaleString()}</TableCell>
                  <TableCell className="text-right font-medium">{invoice.currencySymbol} {item.amount.toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="mt-4 space-y-1 text-sm text-right">
            <p>Subtotal: {invoice.currencySymbol} {invoice.subtotal.toLocaleString()}</p>
            {invoice.discount > 0 && <p className="text-green-600">Discount: -{invoice.currencySymbol} {invoice.discount.toLocaleString()}</p>}
            {invoice.tax > 0 && <p>Tax: {invoice.currencySymbol} {invoice.tax.toLocaleString()}</p>}
            {invoice.shipping > 0 && <p>Shipping: {invoice.currencySymbol} {invoice.shipping.toLocaleString()}</p>}
            <p className="text-lg font-bold border-t pt-1">Total: {invoice.currencySymbol} {invoice.total.toLocaleString()}</p>
            {invoice.paid > 0 && (
              <>
                <p className="text-green-600 font-medium">Amount Received: {invoice.currencySymbol} {invoice.paid.toLocaleString()}</p>
                {invoice.balanceDue > 0
                  ? <p className="text-destructive font-bold text-base">Balance Due: {invoice.currencySymbol} {invoice.balanceDue.toLocaleString()}</p>
                  : <p className="text-green-600 font-bold">✅ Fully Paid</p>
                }
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Payments */}
      {invoice.payments.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Payments</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Method</TableHead><TableHead>Reference</TableHead><TableHead className="text-right">Amount</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {invoice.payments.map(p => (
                  <TableRow key={p.id}>
                    <TableCell>{p.date}</TableCell>
                    <TableCell className="capitalize">{p.method}</TableCell>
                    <TableCell className="font-mono text-xs">{p.transactionId ?? "—"}</TableCell>
                    <TableCell className="text-right font-medium">{invoice.currencySymbol} {p.amount.toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" title="View slip" onClick={() => setShowPaymentSlip(p)}><Printer className="h-3 w-3" /></Button>
                        <Button size="sm" variant="ghost" title="Edit payment" onClick={() => setEditPayment(p)}><Pencil className="h-3 w-3" /></Button>
                        {deletePaymentId === p.id ? (
                          <span className="flex items-center gap-1">
                            <Button size="sm" variant="destructive" className="h-6 px-2 text-xs" disabled={deletePaymentMutation.isPending}
                              onClick={() => deletePaymentMutation.mutate(p.id)}>
                              {deletePaymentMutation.isPending ? "…" : "Yes"}
                            </Button>
                            <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={() => setDeletePaymentId(null)}>No</Button>
                          </span>
                        ) : (
                          <Button size="sm" variant="ghost" title="Delete payment" className="text-destructive hover:text-destructive"
                            onClick={() => setDeletePaymentId(p.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Notes */}
      {invoice.notes && (
        <Card><CardContent className="pt-4 text-sm"><strong>Notes:</strong> {invoice.notes}</CardContent></Card>
      )}

      {/* Danger Zone */}
      <Separator />
      <div className="flex justify-end">
        {!deleteConfirm ? (
          <Button variant="destructive" size="sm" onClick={() => setDeleteConfirm(true)}>Delete Invoice</Button>
        ) : (
          <div className="flex items-center gap-3 bg-destructive/10 px-4 py-2 rounded-lg">
            <p className="text-sm text-destructive font-medium">Are you sure? This cannot be undone.</p>
            <Button variant="destructive" size="sm" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? "Deleting..." : "Yes, Delete"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setDeleteConfirm(false)}>Cancel</Button>
          </div>
        )}
      </div>

      {/* Record Payment Dialog */}
      <Dialog open={showPayment} onOpenChange={setShowPayment}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Date</Label><Input type="date" value={payForm.date} onChange={e => setPayForm(f => ({ ...f, date: e.target.value }))} /></div>
            <div>
              <Label>Method</Label>
              <Select value={payForm.method} onValueChange={v => setPayForm(f => ({ ...f, method: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cod">COD (Cash on Delivery)</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="wallet">Wallet</SelectItem>
                  <SelectItem value="jazzcash">JazzCash</SelectItem>
                  <SelectItem value="easypaisa">Easypaisa</SelectItem>
                  <SelectItem value="bank">Bank Transfer</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Amount</Label>
              <Input type="number" value={payForm.amount} onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))} placeholder={`Balance: ${invoice.currencySymbol} ${invoice.balanceDue.toLocaleString()}`} />
            </div>
            <div><Label>Transaction ID / Reference</Label>
              <Input value={payForm.transactionId} onChange={e => setPayForm(f => ({ ...f, transactionId: e.target.value }))} placeholder="Optional" />
            </div>
            <div><Label>Memo / Notes</Label>
              <textarea
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
                rows={2}
                value={payForm.memo}
                onChange={e => setPayForm(f => ({ ...f, memo: e.target.value }))}
                placeholder="Optional — appears on payment receipt"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPayment(false)}>Cancel</Button>
            <Button onClick={() => payMutation.mutate(payForm)} disabled={payMutation.isPending || !payForm.amount}>
              {payMutation.isPending ? "Recording..." : "Record Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Payment Dialog */}
      <Dialog open={!!editPayment} onOpenChange={v => { if (!v) setEditPayment(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Payment</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Date</Label><Input type="date" value={payForm.date} onChange={e => setPayForm(f => ({ ...f, date: e.target.value }))} /></div>
            <div>
              <Label>Method</Label>
              <Select value={payForm.method} onValueChange={v => setPayForm(f => ({ ...f, method: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cod">COD (Cash on Delivery)</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="wallet">Wallet</SelectItem>
                  <SelectItem value="jazzcash">JazzCash</SelectItem>
                  <SelectItem value="easypaisa">Easypaisa</SelectItem>
                  <SelectItem value="bank">Bank Transfer</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Amount</Label>
              <Input type="number" value={payForm.amount} onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))} />
            </div>
            <div><Label>Transaction ID / Reference</Label>
              <Input value={payForm.transactionId} onChange={e => setPayForm(f => ({ ...f, transactionId: e.target.value }))} placeholder="Optional" />
            </div>
            <div><Label>Memo / Notes</Label>
              <textarea
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
                rows={2}
                value={payForm.memo}
                onChange={e => setPayForm(f => ({ ...f, memo: e.target.value }))}
                placeholder="Optional"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditPayment(null)}>Cancel</Button>
            <Button onClick={() => editPaymentMutation.mutate(payForm)} disabled={editPaymentMutation.isPending || !payForm.amount}>
              {editPaymentMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Slip Dialog */}
      <Dialog open={!!showPaymentSlip} onOpenChange={v => { if (!v) { setShowPaymentSlip(null); setSlipTotals(null); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Payment Receipt</DialogTitle></DialogHeader>
          {showPaymentSlip && (
            <div className="space-y-4">
              <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4 text-center">
                <div className="text-4xl mb-2">✅</div>
                <div className="text-2xl font-black text-green-800">{invoice.currencySymbol} {showPaymentSlip.amount.toLocaleString()}</div>
                <div className="text-green-600 text-sm">Payment Received</div>
              </div>
              <div className="text-sm space-y-2">
                <div className="flex justify-between"><span className="text-muted-foreground">Invoice</span><span className="font-medium">{invoice.invoiceNumber}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Date</span><span className="font-medium">{showPaymentSlip.date}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Method</span><span className="font-medium capitalize">{showPaymentSlip.method}</span></div>
                {showPaymentSlip.transactionId && <div className="flex justify-between"><span className="text-muted-foreground">Reference</span><span className="font-mono text-xs">{showPaymentSlip.transactionId}</span></div>}
                {/* Use slipTotals (optimistic) if available so values are correct before re-fetch */}
                <div className="flex justify-between border-t pt-2"><span className="text-muted-foreground">Total Paid</span><span className="font-bold text-green-700">{invoice.currencySymbol} {(slipTotals?.paid ?? invoice.paid).toLocaleString()}</span></div>
                {(slipTotals?.balanceDue ?? invoice.balanceDue) > 0
                  ? <div className="flex justify-between"><span className="text-muted-foreground">Balance Due</span><span className="font-bold text-destructive">{invoice.currencySymbol} {(slipTotals?.balanceDue ?? invoice.balanceDue).toLocaleString()}</span></div>
                  : <div className="flex justify-between"><span className="text-muted-foreground">Status</span><span className="font-bold text-green-600">✅ Fully Paid</span></div>
                }
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" className="flex-1" variant="outline" onClick={() => {
                  window.open(`/api/invoices/${invoice.id}/payments/${showPaymentSlip.id}/slip`, "_blank");
                }}>
                  <Printer className="h-3 w-3 mr-1" />Print Slip
                </Button>
                <Button size="sm" className="flex-1" variant="outline" onClick={() => {
                  const slipBalance = slipTotals?.balanceDue ?? invoice.balanceDue;
                  const msg = buildPaymentWhatsAppMsg(invoice, showPaymentSlip, slipBalance);
                  const url = `https://wa.me/${toWaPhone(invoice.customerPhone)}?text=${encodeURIComponent(msg)}`;
                  window.open(url, "_blank");
                }}>
                  <MessageCircle className="h-3 w-3 mr-1" />WhatsApp
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
