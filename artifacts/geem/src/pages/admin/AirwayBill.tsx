import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { axiosInstance } from "@/lib/axios";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft } from "lucide-react";

/* ── Minimal types ─────────────────────────────────────────────────────────── */
interface InvoiceItem { description: string; quantity: number; unitPrice: number; total: number; }
interface Invoice {
  id: number; invoiceNumber: string; date: string;
  customerName: string; customerPhone: string | null;
  customerAddress: string | null; customerCity: string | null;
  total: number; paid: number; balanceDue: number;
  courierCn: string | null; courierName: string | null;
  items: InvoiceItem[];
}
interface Company {
  companyName: string; address: string | null;
  phone: string | null; whatsappNumber: string | null; gLogo: string | null; logo: string | null;
}

/* ── Helpers ───────────────────────────────────────────────────────────────── */
function fmt(n: number) { return "Rs " + Math.round(n).toLocaleString("en-PK"); }
function today() { return new Date().toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" }); }

export default function AirwayBill() {
  const { id } = useParams<{ id: string }>();
  const [location, navigate] = useLocation();

  // Pull weight / originCity from query params (set when navigating here)
  const qp = new URLSearchParams(location.split("?")[1] ?? "");
  const weight = qp.get("weight") ?? "–";
  const originCity = qp.get("origin") ?? "AHMAD PUR EAST";

  const { data: invoice, isLoading: loadingInv } = useQuery<Invoice>({
    queryKey: ["invoice", id],
    queryFn: () => axiosInstance.get<Invoice>(`/invoices/${id}`).then(r => r.data),
    staleTime: 30_000,
  });

  const { data: company } = useQuery<Company>({
    queryKey: ["settings-company"],
    queryFn: () => axiosInstance.get<Company>("/settings/company").then(r => r.data),
    staleTime: 5 * 60_000,
  });

  // Auto-print once both are ready
  useEffect(() => {
    if (invoice && company) {
      const t = setTimeout(() => window.print(), 600);
      return () => clearTimeout(t);
    }
  }, [!!invoice, !!company]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loadingInv) {
    return (
      <div className="flex items-center justify-center min-h-screen text-slate-500 text-sm">
        Loading airway bill…
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="flex items-center justify-center min-h-screen text-red-500 text-sm">
        Invoice not found.
      </div>
    );
  }

  const cn = invoice.courierCn ?? "–";
  const cod = fmt(invoice.balanceDue);
  const senderName = company?.companyName ?? "Geem";
  const senderPhone = company?.whatsappNumber ?? company?.phone ?? "";
  const senderAddress = company?.address ?? originCity;
  const itemsSummary = invoice.items.map(i => `${i.description} ×${i.quantity}`).join(", ") || "See Invoice";

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white print:min-h-0">
      {/* ── Toolbar (hidden on print) ── */}
      <div className="print:hidden flex items-center gap-3 p-4 bg-white border-b shadow-sm">
        <Button variant="outline" size="sm" onClick={() => navigate(`/invoices/${id}`)}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Invoice
        </Button>
        <Button size="sm" onClick={() => window.print()}>
          <Printer className="h-4 w-4 mr-1" /> Print Airway Bill
        </Button>
        <span className="text-xs text-muted-foreground">The print dialog should open automatically.</span>
      </div>

      {/* ── Print area ── */}
      <div className="p-6 print:p-0 flex flex-col items-center gap-6">

        {/* ── Slip card ── */}
        <div
          className="bg-white shadow-lg print:shadow-none w-full max-w-2xl rounded-xl print:rounded-none overflow-hidden"
          style={{ fontFamily: "Arial, sans-serif" }}
        >
          {/* Header bar */}
          <div className="flex items-center justify-between bg-slate-900 text-white px-5 py-3">
            <div className="flex items-center gap-3">
              {(company?.gLogo || company?.logo) && (
                <img
                  src={company.gLogo ?? company.logo!}
                  alt="logo"
                  className="h-10 w-10 rounded-lg object-contain bg-white p-0.5"
                />
              )}
              <div>
                <p className="font-extrabold text-lg leading-tight tracking-wide">{senderName}</p>
                <p className="text-xs text-slate-300 leading-tight">CONSIGNMENT NOTE</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-400 uppercase tracking-widest">Courier</p>
              <p className="font-bold text-sm">{invoice.courierName ?? "Courier"}</p>
            </div>
          </div>

          {/* CN big display */}
          <div className="bg-slate-50 border-b-2 border-slate-900 px-5 py-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Consignment No.</p>
              <p className="text-4xl font-black tracking-widest text-slate-900 mt-0.5">{cn}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500">Date</p>
              <p className="font-semibold text-sm text-slate-700">{today()}</p>
              <p className="text-xs text-slate-500 mt-2">Invoice #</p>
              <p className="font-semibold text-sm text-slate-700">{invoice.invoiceNumber}</p>
            </div>
          </div>

          {/* FROM / TO */}
          <div className="grid grid-cols-2 divide-x divide-slate-200 border-b border-slate-200">
            {/* FROM */}
            <div className="px-5 py-4">
              <p className="text-xs font-extrabold uppercase tracking-widest text-slate-400 mb-2">FROM — Sender</p>
              <p className="font-bold text-sm text-slate-900">{senderName}</p>
              <p className="text-sm text-slate-700 mt-0.5">{originCity}</p>
              {senderAddress && senderAddress !== originCity && (
                <p className="text-sm text-slate-600">{senderAddress}</p>
              )}
              {senderPhone && (
                <p className="text-sm text-slate-700 mt-0.5 font-mono">{senderPhone}</p>
              )}
            </div>
            {/* TO */}
            <div className="px-5 py-4 bg-yellow-50">
              <p className="text-xs font-extrabold uppercase tracking-widest text-slate-400 mb-2">TO — Recipient</p>
              <p className="font-black text-base text-slate-900">{invoice.customerName}</p>
              {invoice.customerAddress && (
                <p className="text-sm text-slate-700 mt-0.5">{invoice.customerAddress}</p>
              )}
              {invoice.customerCity && (
                <p className="text-sm font-semibold text-slate-700">{invoice.customerCity}</p>
              )}
              {invoice.customerPhone && (
                <p className="text-sm text-slate-900 font-mono font-bold mt-1">{invoice.customerPhone}</p>
              )}
            </div>
          </div>

          {/* Metrics row */}
          <div className="grid grid-cols-4 divide-x divide-slate-200 border-b border-slate-200 text-center">
            {[
              { label: "COD Amount", value: cod, highlight: true },
              { label: "Weight", value: `${weight} kg`, highlight: false },
              { label: "Pieces", value: "1", highlight: false },
              { label: "Service", value: "Standard", highlight: false },
            ].map(({ label, value, highlight }) => (
              <div key={label} className={`px-3 py-3 ${highlight ? "bg-green-50" : ""}`}>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{label}</p>
                <p className={`font-extrabold text-lg mt-0.5 ${highlight ? "text-green-700" : "text-slate-800"}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* Items summary */}
          <div className="px-5 py-3 border-b border-slate-200">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Contents</p>
            <p className="text-sm text-slate-700 mt-0.5 line-clamp-2">{itemsSummary}</p>
          </div>

          {/* Footer */}
          <div className="px-5 py-3 flex items-center justify-between bg-slate-50">
            <p className="text-xs text-slate-400">
              Generated by {senderName} ERP · {today()}
            </p>
            <p className="text-xs text-slate-500 font-mono font-bold">{cn}</p>
          </div>
        </div>

        {/* ── Cut line hint (print only) ── */}
        <div className="hidden print:block w-full max-w-2xl border-t-2 border-dashed border-slate-400 my-2 text-center">
          <span className="text-xs text-slate-400 bg-white px-2">✂ CUT HERE</span>
        </div>

      </div>

      {/* ── Print styles ── */}
      <style>{`
        @media print {
          @page { margin: 10mm; size: A5 landscape; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </div>
  );
}
