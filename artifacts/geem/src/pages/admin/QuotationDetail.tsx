import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { axiosInstance } from "@/lib/axios";
import { isIccid, imeiLabel } from "@/lib/utils";
import { toWaPhone } from "@/lib/format";
import { useParams, Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Printer, MessageCircle, Share2, FileDown, Link2, Eye, Pencil, FileText } from "lucide-react";

interface QuotationItem {
  id: number; description: string; qty: number; price: number; amount: number;
  imei: string | null; taxRate: number; deviceId: string | null; ptaStatus: string | null;
}

interface CompanySettings {
  companyName: string; logo?: string | null; address?: string | null;
  phone?: string | null; fax?: string | null; email?: string | null; website?: string | null;
}

interface Quotation {
  id: number; quotationNumber: string; status: string; date: string; expiryDate: string | null;
  customerName: string; customerPhone: string | null; customerCity: string | null;
  customerAddress: string | null; customerId: number;
  subtotal: number; discount: number; tax: number; total: number;
  currency: string; currencySymbol: string; notes: string | null;
  items: QuotationItem[];
}

const statusColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  accepted: "default", draft: "outline", rejected: "destructive", expired: "secondary",
};

function fmtDate(d: string): string {
  try { return new Date(d + "T00:00:00").toLocaleDateString("en-PK", { timeZone: "Asia/Karachi", year: "numeric", month: "long", day: "numeric" }); }
  catch { return d; }
}

function fmtAmt(n: number, sym?: string): string {
  return (sym ?? "₨") + n.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function pdfSym(q: Quotation): string {
  return q.currency === "PKR" ? "₨" : q.currencySymbol;
}

const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2048 550" width="210" height="57"><path transform="translate(1635,135)" d="m0 0h32l23 4 18 6 16 8 14 10 10 9 8 8 3 4v2l5-3 9-9 13-10 13-8 16-8 16-6 23-5 14-2h36l25 4 17 5 20 9 15 10 14 12 11 13 10 15 8 17 7 23 3 17 1 11v252h-103l-1-232-3-16-5-12-6-10-7-8-10-7-12-5-10-2h-22l-14 3-12 5-11 7-8 7-9 13-6 13-3 11-1 7-1 24v201l-1 1h-102l-1-229-3-18-5-13-7-11-5-6-11-8-12-5-10-2h-22l-18 4-14 7-11 9-9 11-7 14-4 14-2 16-1 217h-103l-1-1v-380h103v36l8-7 11-9 16-10 17-8 16-5z" fill="#EC2029"/><path transform="translate(1195,134)" d="m0 0h35l24 3 25 6 17 6 19 9 17 11 14 11 14 14 11 14 9 14 8 15 9 23 5 19 3 18 1 11v45l-1 11-2 1h-290l7 21 8 15 8 10 12 12 13 8 13 6 15 4 13 2h26l22-4 15-5 19-10 14-11 10-10 7-9 5 2 15 9 28 17 24 15 6 4-7 11-11 13-9 10-11 10-16 12-17 10-19 9-24 8-26 5-27 3h-29l-25-3-20-4-27-9-16-8-14-8-11-8-10-8-19-19-10-13-12-20-10-22-6-19-4-19-3-27v-24l3-26 6-25 8-20 8-17 12-19 12-14 9-10 7-7 14-11 15-10 19-10 24-9 21-5zm2 85-20 4-16 7-11 7-12 11-10 13-9 17-3 10h186l-3-12-8-16-8-11-12-12-13-8-14-6-12-3-7-1z" fill="#EC2029"/><path transform="translate(769,134)" d="m0 0h36l23 3 22 5 18 6 16 7 17 10 17 13 18 18 13 17 11 19 10 24 6 21 3 17 2 25v18l-1 25-2 3h-291l7 20 9 17 9 11 8 8 15 10 11 5 17 5 13 2h26l23-4 19-7 16-9 11-9 4-2 2-4 5-5 7-9 4 1 28 17 26 16 19 12 1 2-9 13-11 13-12 12-11 9-14 10-14 8-16 8-27 9-25 5-28 3h-28l-25-3-20-4-17-5-21-9-17-9-19-14-12-11-8-8-11-14-7-10-9-16-7-15-6-18-5-20-3-22-1-25 2-24 4-22 6-20 8-19 9-17 11-16 11-13 8-9 8-7 15-12 18-11 16-8 21-8 21-5zm2 85-16 3-16 6-13 8-9 7-7 8-8 10-8 16-3 8v3h185l-2-10-7-16-8-11-9-10-12-9-17-8-14-4-8-1z" fill="#EC2029"/><path transform="translate(278,4)" d="m0 0h13l27 2 10 1-2 4-9 9-7 8-28 28-7 8-21 21-7 8-3 3-29 10-23 12-14 10-11 9-15 15-13 17-9 15-9 19-6 18-5 25-1 8v28l3 21 6 23 9 21 8 15 10 14 11 13 10 10 14 11 10 7 14 8 24 10 23 6 18 3h34l24-4 20-6 18-8 16-9 16-12 10-9 11-11 9-11 11-17 2-4-33-1-32-32v-2h-2l-7-8-12-12-5-4-7-8-16-16v-1h224v21l-3 23-6 27-8 24-12 26-11 19-12 17-8 10-12 14-14 14-8 7-18 14-19 12-23 12-19 8-26 8-20 4-15 2-13 1h-41l-18-2-24-5-20-6-20-8-23-11-19-12-11-8-14-11-13-12-13-13-9-11-10-13-10-15-12-22-10-23-8-26-5-23-2-15-1-13v-30l2-20 4-23 7-25 8-21 10-21 12-20 14-19 12-14 21-21 14-11 17-12 19-11 23-11 25-9 29-7 24-3z" fill="#EC2029"/><path transform="translate(402,33)" d="m0 0 6 1 24 14 11 8 13 10 13 12 3 2-2 4-12 13-43 43-2 3-4-1-11-10-15-11-14-8-14-7-16-6 2-4 15-15 7-8 23-23 7-8z" fill="#EC2029"/></svg>`;

const PDF_CSS = `
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Arial,Helvetica,sans-serif;color:#333;font-size:13px;line-height:1.4}
.page{max-width:820px;margin:0 auto;padding:40px 48px}
.no-print{background:#fef3c7;padding:10px 16px;border-radius:6px;margin-bottom:16px;font-size:12px;text-align:center}
@media print{.no-print{display:none!important}@page{size:A4;margin:15mm}}
.hdr{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px}
.logo-block{display:flex;align-items:flex-start;padding-top:4px}
.co-block{text-align:right}
.doc-title{font-size:32px;font-weight:900;letter-spacing:3px;color:#222;margin-bottom:10px}
.co-name{font-size:13px;font-weight:700;margin-bottom:3px}
.co-line{font-size:12px;color:#555;line-height:1.7}
.meta-row{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;gap:24px}
.bill-to-lbl{font-size:10px;font-weight:700;color:#999;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:6px}
.bill-to-body{font-size:13px;line-height:1.7}
.meta-tbl{border-collapse:collapse;margin-left:auto}
.meta-tbl td{font-size:13px;padding:2px 0}
.meta-tbl .lbl{color:#555;text-align:right;padding-right:14px;white-space:nowrap}
.meta-tbl .val{font-weight:600;text-align:right;white-space:nowrap}
.meta-tbl .tot-lbl{font-weight:700}
.meta-tbl .tot-val{font-weight:700;font-size:14px}
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
.tot-tbl tr.total-row td{border-top:2px solid #bbb;padding-top:8px;font-weight:700;font-size:14px}
.notes-box{margin-top:20px;font-size:12px;color:#666;padding:10px 14px;background:#fffbeb;border-radius:6px;border-left:3px solid #fcd34d}
.validity-box{margin-top:20px;font-size:12px;color:#555;padding:10px 14px;background:#f0f9ff;border-radius:6px;border-left:3px solid #0ea5e9}
.pg-footer{margin-top:36px;text-align:center;color:#aaa;font-size:11px;border-top:1px solid #e5e5e5;padding-top:12px}
@media(max-width:600px){
  .page{padding:20px 16px}
  .hdr{justify-content:flex-start}
  .co-block{text-align:left}
  .meta-row{flex-direction:column;gap:16px}
  .meta-tbl{margin-left:0}
  .meta-tbl .lbl{text-align:left}
  .meta-tbl .val{text-align:left}
  .totals-wrap{justify-content:flex-start}
  .tot-tbl{width:100%}
  .items-tbl th,.items-tbl td{padding:7px 4px;font-size:12px}
}
`;

function buildQuotationHtml(q: Quotation, company: CompanySettings): string {
  const addressLines = (company.address ?? "").split("\n").filter(Boolean);
  const sym = pdfSym(q);
  const itemRows = q.items.map(item => `
    <tr>
      <td>
        <div class="i-name">${item.description}</div>
        ${item.deviceId
          ? `<div class="i-sub">Device ID#<br/>${item.deviceId}</div>${item.imei ? `<div class="i-sub">${imeiLabel(item.imei)}: ${item.imei}</div>` : ""}`
          : item.imei ? `<div class="i-sub" style="font-weight:700;color:#333">${imeiLabel(item.imei)}: ${item.imei}</div>` : ""}
      </td>
      <td class="c">${item.qty}</td>
      <td class="r">${fmtAmt(item.price, sym)}</td>
      <td class="r">${fmtAmt(item.amount, sym)}</td>
    </tr>`).join("");

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>QUOTATION ${q.quotationNumber}</title>
  <style>${PDF_CSS}</style></head><body>
  <div class="no-print">
    <strong>💡 To save as PDF:</strong> Choose <strong>Save as PDF</strong> in the print dialog.
    <button onclick="window.print()" style="margin-left:12px;padding:5px 14px;background:#2563eb;color:#fff;border:none;border-radius:5px;cursor:pointer;font-size:12px">🖨 Print / Save PDF</button>
  </div>
  <div class="page">
    <div class="hdr">
      <div class="logo-block">${LOGO_SVG}</div>
      <div class="co-block">
        <div class="doc-title">QUOTATION</div>
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
          <tr><td class="lbl tot-lbl">Total Amount (${q.currency}):</td><td class="val tot-val">${fmtAmt(q.total, sym)}</td></tr>
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
        <tr><td class="lbl">Subtotal:</td><td class="val">${fmtAmt(q.subtotal, sym)}</td></tr>
        ${q.discount > 0 ? `<tr><td class="lbl">Discount:</td><td class="val">(${fmtAmt(q.discount, sym)})</td></tr>` : ""}
        ${q.tax > 0 ? `<tr><td class="lbl">Tax:</td><td class="val">${fmtAmt(q.tax, sym)}</td></tr>` : ""}
        <tr class="total-row"><td class="lbl">Total (${q.currency}):</td><td class="val">${fmtAmt(q.total, sym)}</td></tr>
      </table>
    </div>

    ${q.notes ? `<div class="notes-box"><strong>Notes:</strong> ${q.notes}</div>` : ""}
    ${q.expiryDate ? `<div class="validity-box">This quotation is valid until <strong>${fmtDate(q.expiryDate)}</strong>. Please confirm acceptance before the expiry date.</div>` : ""}
    <div class="pg-footer">${company.companyName} &nbsp;|&nbsp; ${company.email ?? ""} &nbsp;|&nbsp; ${company.phone ?? ""} &nbsp;|&nbsp; ${company.website ?? ""}</div>
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

function handleWhatsApp(q: Quotation) {
  const sym = q.currencySymbol;
  const items = q.items.map(i => `• ${i.description}${i.imei ? ` (${imeiLabel(i.imei)}: ${i.imei})` : ""} — ${sym} ${i.amount.toLocaleString()}`).join("\n");
  const msg = `*Quotation ${q.quotationNumber}*\nDate: ${q.date}${q.expiryDate ? `\nValid Until: ${q.expiryDate}` : ""}\n\n*Items:*\n${items}\n\n*Total: ${sym} ${q.total.toLocaleString()}*\n\n_Geem.pk_`;
  const url = `https://wa.me/${toWaPhone(q.customerPhone)}?text=${encodeURIComponent(msg)}`;
  window.open(url, "_blank");
}

export default function QuotationDetail() {
  const params = useParams<{ id: string }>();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, navigate] = useLocation();
  const id = params?.id;
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const { data: quotation, isLoading } = useQuery({
    queryKey: ["quotation", id],
    queryFn: () => axiosInstance.get<Quotation>(`/quotations/${id}`).then(r => r.data),
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

  const statusMutation = useMutation({
    mutationFn: (status: string) => axiosInstance.patch(`/quotations/${id}`, { status }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["quotation", id] }); qc.invalidateQueries({ queryKey: ["quotations"] }); toast({ title: "Status updated" }); },
  });

  const convertMutation = useMutation({
    mutationFn: () => axiosInstance.post(`/quotations/${id}/convert-invoice`).then(r => r.data),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["quotation", id] });
      qc.invalidateQueries({ queryKey: ["quotations"] });
      toast({ title: `Invoice ${data.invoiceNumber} created` });
      navigate(`/invoices/${data.id}`);
    },
    onError: () => toast({ title: "Failed to convert", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => axiosInstance.delete(`/quotations/${id}`),
    onSuccess: () => { toast({ title: "Quotation deleted" }); navigate("/quotations"); },
  });

  if (isLoading) return <div className="p-8">Loading...</div>;
  if (!quotation) return <div className="p-8">Quotation not found</div>;

  const sym = quotation.currencySymbol;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/quotations"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />Back</Button></Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{quotation.quotationNumber}</h1>
          <p className="text-muted-foreground">{quotation.customerName}{quotation.customerCity ? ` — ${quotation.customerCity}` : ""}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={statusColors[quotation.status] ?? "outline"} className="text-sm px-3 py-1">{quotation.status}</Badge>
          <Button variant="outline" size="sm" onClick={() => openViewWindow(buildQuotationHtml(quotation, company))}><Eye className="h-4 w-4 mr-1" />View Quotation</Button>
          <Link href={`/quotations/${quotation.id}/edit`}><Button variant="outline" size="sm"><Pencil className="h-4 w-4 mr-1" />Edit</Button></Link>
          <Button variant="outline" size="sm" onClick={() => openPrintWindow(buildQuotationHtml(quotation, company))}><Printer className="h-4 w-4 mr-1" />Print</Button>
          <Button variant="outline" size="sm" onClick={() => openViewWindow(buildQuotationHtml(quotation, company))}><FileDown className="h-4 w-4 mr-1" />PDF</Button>
          <Button variant="outline" size="sm" onClick={() => handleWhatsApp(quotation)}><MessageCircle className="h-4 w-4 mr-1" />WhatsApp</Button>
          <Button variant="outline" size="sm" onClick={() => {
            const sym2 = quotation.currencySymbol;
            const items = quotation.items.map(i => `• ${i.description}${i.imei ? ` (${imeiLabel(i.imei)}: ${i.imei})` : ""} — ${sym2} ${i.amount.toLocaleString()}`).join("\n");
            const text = `*Quotation ${quotation.quotationNumber}*\nCustomer: ${quotation.customerName}\nDate: ${quotation.date}\n\n${items}\n\n*Total: ${sym2} ${quotation.total.toLocaleString()}*`;
            navigator.clipboard.writeText(text);
            toast({ title: "Quotation message copied to clipboard" });
          }}><Link2 className="h-4 w-4 mr-1" />Copy Msg</Button>
          <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(window.location.href); toast({ title: "Link copied" }); }}>
            <Share2 className="h-4 w-4 mr-1" />Copy Link
          </Button>
        </div>
      </div>

      {/* Status Actions */}
      {quotation.status === "draft" && (
        <div className="flex gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="flex-1 text-sm text-amber-800 font-medium self-center">This quotation is pending customer approval.</p>
          <Button variant="outline" size="sm" className="border-green-300 text-green-700 hover:bg-green-50"
            onClick={() => statusMutation.mutate("accepted")} disabled={statusMutation.isPending}>
            ✓ Mark Accepted
          </Button>
          <Button variant="outline" size="sm" className="border-red-300 text-red-700 hover:bg-red-50"
            onClick={() => statusMutation.mutate("rejected")} disabled={statusMutation.isPending}>
            ✗ Mark Rejected
          </Button>
        </div>
      )}

      {quotation.status === "accepted" && (
        <div className="flex gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="flex-1 text-sm text-green-800 font-medium self-center">✅ Customer has approved this quotation. Ready to convert to invoice.</p>
          <Button className="bg-green-700 hover:bg-green-800"
            onClick={() => convertMutation.mutate()} disabled={convertMutation.isPending}>
            <FileText className="h-4 w-4 mr-2" />
            {convertMutation.isPending ? "Converting…" : "Convert to Invoice"}
          </Button>
        </div>
      )}

      {quotation.status === "rejected" && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
          This quotation was rejected by the customer.
        </div>
      )}

      {quotation.status === "expired" && (
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600">
          This quotation has expired.
        </div>
      )}

      {/* KPI Row */}
      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">Quotation Date</p>
          <p className="font-semibold">{quotation.date}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="text-2xl font-bold">{sym} {quotation.total.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">{quotation.currency}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">Valid Until</p>
          <p className="font-semibold">{quotation.expiryDate ?? "—"}</p>
        </CardContent></Card>
      </div>

      {/* Customer Info */}
      <Card>
        <CardHeader><CardTitle className="text-base">Customer Details</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-1">
          <p><strong>Name:</strong> {quotation.customerName}</p>
          {quotation.customerPhone && <p><strong>Phone:</strong> {quotation.customerPhone}</p>}
          {quotation.customerCity && <p><strong>City:</strong> {quotation.customerCity}</p>}
          {quotation.customerAddress && <p><strong>Address:</strong> {quotation.customerAddress}</p>}
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
              {quotation.items.map(item => (
                <TableRow key={item.id}>
                  <TableCell><p className="font-medium">{item.description}</p></TableCell>
                  <TableCell className="font-mono text-xs space-y-0.5">
                    {item.deviceId
                      ? <><p className="font-semibold text-foreground">Device ID: {item.deviceId}</p>{item.imei && <p className="text-muted-foreground">{imeiLabel(item.imei)}: {item.imei}</p>}</>
                      : item.imei ? <p className="font-semibold text-foreground">{imeiLabel(item.imei)}: {item.imei}</p> : "—"}
                    {item.ptaStatus === "approved" && <p className="font-sans text-[10px] font-medium text-green-600 not-italic">✓ PTA Approved</p>}
                  </TableCell>
                  <TableCell className="text-right">{item.qty}</TableCell>
                  <TableCell className="text-right">{sym} {item.price.toLocaleString()}</TableCell>
                  <TableCell className="text-right font-medium">{sym} {item.amount.toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="mt-4 space-y-1 text-sm text-right">
            <p>Subtotal: {sym} {quotation.subtotal.toLocaleString()}</p>
            {quotation.discount > 0 && <p className="text-green-600">Discount: -{sym} {quotation.discount.toLocaleString()}</p>}
            {quotation.tax > 0 && <p>Tax: {sym} {quotation.tax.toLocaleString()}</p>}
            <p className="text-lg font-bold border-t pt-1">Total: {sym} {quotation.total.toLocaleString()}</p>
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      {quotation.notes && (
        <Card><CardContent className="pt-4 text-sm"><strong>Notes:</strong> {quotation.notes}</CardContent></Card>
      )}

      {/* Danger Zone */}
      <Separator />
      <div className="flex justify-end">
        {!deleteConfirm ? (
          <Button variant="destructive" size="sm" onClick={() => setDeleteConfirm(true)}>Delete Quotation</Button>
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
    </div>
  );
}
