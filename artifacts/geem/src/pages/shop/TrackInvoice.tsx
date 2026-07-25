import { useQuery } from "@tanstack/react-query";
import { axiosInstance } from "@/lib/axios";
import { ShopLayout } from "./ShopLayout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Package, Truck, CheckCircle, Clock, ExternalLink } from "lucide-react";

interface TrackInvoiceData {
  invoiceNumber: string;
  date: string;
  status: string;
  customerName: string;
  total: number;
  paid: number;
  balanceDue: number;
  currency: string;
  currencySymbol: string;
  courierName: string | null;
  courierCn: string | null;
  courierTrackingUrl: string | null;
  items: Array<{ description: string; qty: number }>;
}

const STATUS_STEPS = [
  { key: "pending",   label: "Pending",   icon: Clock },
  { key: "shipped",   label: "Shipped",   icon: Truck },
  { key: "delivered", label: "Delivered", icon: CheckCircle },
];

/** Map invoice status → position in the progress bar. */
function resolveStep(status: string): number {
  if (status === "delivered") return 2;
  if (status === "shipped")   return 1;
  return 0; // draft / unpaid / partial / paid-but-not-yet-shipped
}

function fmtDate(d: string): string {
  try {
    return new Date(d + "T00:00:00").toLocaleDateString("en-PK", {
      timeZone: "Asia/Karachi",
      day: "2-digit", month: "short", year: "numeric",
    });
  } catch { return d; }
}

export default function TrackInvoice() {
  // Read ?inv=INV-XXXX from the URL
  const invParam = typeof window !== "undefined"
    ? (new URLSearchParams(window.location.search).get("inv") ?? "")
    : "";

  const { data, isLoading, error } = useQuery({
    queryKey: ["track-invoice", invParam],
    queryFn: async () => {
      if (!invParam) throw new Error("No invoice specified");
      // Resolve invoice number → numeric id via a search-style call
      const r = await axiosInstance.get<TrackInvoiceData>(`/invoices/by-number/${encodeURIComponent(invParam)}/track`);
      return r.data;
    },
    enabled: !!invParam,
    retry: false,
  });

  const currentStep = data ? resolveStep(data.status) : -1;

  return (
    <ShopLayout>
      <div className="max-w-xl mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <Package className="h-10 w-10 text-primary mx-auto mb-3" />
          <h1 className="text-3xl font-bold mb-1">Track Your Shipment</h1>
          {invParam
            ? <p className="text-muted-foreground font-mono text-sm">{invParam}</p>
            : <p className="text-muted-foreground text-sm">No invoice number provided</p>}
        </div>

        {!invParam && (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="pt-4 text-center text-sm text-amber-700">
              Open the link from your shipping notification to track your order.
            </CardContent>
          </Card>
        )}

        {isLoading && (
          <div className="text-center py-10 text-muted-foreground">Loading…</div>
        )}

        {error && (
          <Card className="border-destructive/20 bg-destructive/5">
            <CardContent className="pt-4 text-center">
              <p className="font-semibold text-destructive">Invoice not found</p>
              <p className="text-sm text-muted-foreground mt-1">
                Please check the link in your notification and try again.
              </p>
            </CardContent>
          </Card>
        )}

        {data && (
          <div className="space-y-5">
            {/* Summary card */}
            <Card>
              <CardContent className="pt-5 space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs text-muted-foreground">Invoice</p>
                    <p className="text-2xl font-bold font-mono">{data.invoiceNumber}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">{fmtDate(data.date)}</p>
                  </div>
                  <Badge
                    variant={
                      data.status === "paid" || data.status === "delivered"
                        ? "default"
                        : data.status === "overdue"
                        ? "destructive"
                        : "secondary"
                    }
                    className="capitalize text-sm px-3 py-1"
                  >
                    {data.status}
                  </Badge>
                </div>

                <div className="text-sm">
                  <span className="text-muted-foreground">Customer: </span>
                  <span className="font-medium">{data.customerName}</span>
                </div>

                <div className="flex gap-6 text-sm border-t pt-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Total</p>
                    <p className="font-bold">{data.currencySymbol} {data.total.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Paid</p>
                    <p className={`font-bold ${data.paid >= data.total ? "text-green-600" : ""}`}>
                      {data.currencySymbol} {data.paid.toLocaleString()}
                    </p>
                  </div>
                  {data.balanceDue > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground">Balance Due</p>
                      <p className="font-bold text-destructive">
                        {data.currencySymbol} {data.balanceDue.toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Shipment progress */}
            <Card>
              <CardContent className="pt-5">
                <h3 className="font-semibold mb-5 text-sm">Shipment Status</h3>
                <div className="flex justify-between relative">
                  <div className="absolute top-5 left-0 right-0 h-0.5 bg-gray-200 z-0" />
                  {STATUS_STEPS.map((step, i) => {
                    const done    = i <= currentStep;
                    const current = i === currentStep;
                    return (
                      <div key={step.key} className="flex flex-col items-center gap-2 z-10">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors
                          ${done ? "bg-primary border-primary text-primary-foreground" : "bg-white border-gray-200 text-gray-400"}
                          ${current ? "ring-2 ring-primary ring-offset-2" : ""}`}>
                          <step.icon className="h-5 w-5" />
                        </div>
                        <p className={`text-xs text-center leading-tight max-w-[64px] ${done ? "font-semibold" : "text-muted-foreground"}`}>
                          {step.label}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Courier tracking */}
            {(data.courierName || data.courierCn) && (
              <Card className="border-blue-200">
                <CardContent className="pt-5 space-y-2">
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    <Truck className="h-4 w-4 text-blue-600" /> Courier Details
                  </h3>
                  {data.courierName && (
                    <p className="text-sm">
                      <span className="text-muted-foreground">Courier: </span>
                      <span className="font-medium">{data.courierName}</span>
                    </p>
                  )}
                  {data.courierCn && (
                    <p className="text-sm">
                      <span className="text-muted-foreground">Tracking No: </span>
                      <span className="font-mono font-bold">{data.courierCn}</span>
                    </p>
                  )}
                  {data.courierTrackingUrl && (
                    <a
                      href={data.courierTrackingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline mt-1"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Track on Courier Website
                    </a>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Items */}
            <Card>
              <CardContent className="pt-5">
                <h3 className="font-semibold text-sm mb-3">Items</h3>
                <ul className="space-y-1.5">
                  {data.items.map((item, i) => (
                    <li key={i} className="flex justify-between text-sm">
                      <span className="text-foreground">{item.description}</span>
                      <span className="text-muted-foreground ml-4">× {item.qty}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <p className="text-center text-xs text-muted-foreground pt-2">
              Questions? WhatsApp us at{" "}
              <a href="https://wa.me/923078680005" className="text-primary font-medium hover:underline">
                +92 307-8680005
              </a>
            </p>
          </div>
        )}
      </div>
    </ShopLayout>
  );
}
