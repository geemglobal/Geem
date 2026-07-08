import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { axiosInstance } from "@/lib/axios";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Truck, Plus, RotateCcw, Phone, MapPin, Mail, CreditCard,
  Package, Calendar, Hash, User, Wallet, Smartphone,
  Copy, MessageCircle, FileText, Send,
} from "lucide-react";
import { cn, isIccid, imeiLabel } from "@/lib/utils";
import { formatPakDate, formatPakDateTime, toWaPhone } from "@/lib/format";

interface WebOrderItem {
  id: number; description: string; qty: number; price: number; amount: number; productId?: number | null;
}

interface WebOrder {
  id: number; orderNumber: string; status: string;
  paymentStatus: string; paymentMethod: string;
  customerName: string; customerMobile: string; customerCity: string;
  customerAddress: string | null; customerEmail: string | null;
  transactionId: string | null;
  subtotal: number; shipping: number; total: number;
  courierCn: string | null; createdAt: string;
  invoiceId: number | null; invoiceStatus: string | null;
  invoicePaid: number | null; invoiceTotal: number | null;
  items: WebOrderItem[];
}

interface Courier { id: number; name: string; }
interface ReturnRequest {
  id: number; orderNumber: string; customerName: string; customerEmail: string | null;
  customerMobile: string; reason: string; description: string;
  status: string; adminNotes: string | null; refundAmount: number | null; createdAt: string;
}

const STATUS_OPTIONS = ["new", "confirmed", "processing", "shipped", "delivered", "cancelled"];
const PAYMENT_STATUS_OPTIONS = ["cod", "pending", "paid", "failed"];

const STATUS_COLORS: Record<string, string> = {
  new:        "bg-blue-100 text-blue-800 border-blue-200",
  confirmed:  "bg-indigo-100 text-indigo-800 border-indigo-200",
  processing: "bg-amber-100 text-amber-800 border-amber-200",
  shipped:    "bg-purple-100 text-purple-800 border-purple-200",
  delivered:  "bg-green-100 text-green-800 border-green-200",
  cancelled:  "bg-red-100 text-red-800 border-red-200",
};

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  cod:     "bg-slate-100 text-slate-700 border-slate-200",
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  paid:    "bg-green-100 text-green-800 border-green-200",
  failed:  "bg-red-100 text-red-800 border-red-200",
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cod:    "Cash on Delivery",
  wallet: "Wallet",
  bank:   "Bank Transfer",
  easypaisa: "Easypaisa",
  jazzcash:  "JazzCash",
};

const RETURN_STATUS_COLORS: Record<string, string> = {
  pending:   "bg-amber-100 text-amber-800 border-amber-200",
  approved:  "bg-green-100 text-green-800 border-green-200",
  rejected:  "bg-red-100 text-red-800 border-red-200",
  completed: "bg-blue-100 text-blue-800 border-blue-200",
};
const RETURN_STATUS_OPTIONS = ["pending", "approved", "rejected", "completed"];
const RETURN_REASON_LABELS: Record<string, string> = {
  defective:        "Defective / Not working",
  wrong_item:       "Wrong item received",
  not_as_described: "Not as described",
  damaged_delivery: "Damaged during delivery",
  changed_mind:     "Changed my mind",
  other:            "Other",
};

type MainTab = "orders" | "returns";

function PaymentIcon({ method }: { method: string }) {
  if (method === "wallet") return <Wallet className="h-3.5 w-3.5" />;
  if (method === "cod") return <Package className="h-3.5 w-3.5" />;
  return <CreditCard className="h-3.5 w-3.5" />;
}

function StatusBadge({ status, map }: { status: string; map: Record<string, string> }) {
  return (
    <span className={cn("inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full border capitalize", map[status] ?? "bg-slate-100 text-slate-700 border-slate-200")}>
      {status}
    </span>
  );
}

export default function WebOrders() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [mainTab, setMainTab] = useState<MainTab>("orders");
  const [filterStatus, setFilterStatus] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<WebOrder | null>(null);
  const [newStatus, setNewStatus] = useState("");
  const [newPaymentStatus, setNewPaymentStatus] = useState("");
  const [courierCn, setCourierCn] = useState("");
  const [courierMode, setCourierMode] = useState<"manual" | "auto">("manual");
  const [selectedCourierId, setSelectedCourierId] = useState("");
  const [selectedReturn, setSelectedReturn] = useState<ReturnRequest | null>(null);
  const [returnStatus, setReturnStatus] = useState("");
  const [returnNotes, setReturnNotes] = useState("");
  const [returnRefundAmount, setReturnRefundAmount] = useState("");
  const [returnFilter, setReturnFilter] = useState("");
  const [imeiDialog, setImeiDialog] = useState(false);
  const [pendingShipFromCourier, setPendingShipFromCourier] = useState(false);
  type InventoryOption = { id: number; imei: string; deviceId: string | null; iccid: string | null; modelName: string; sellingPrice: number };
  // Per-unit state keyed by `${itemIndex}-${unitIndex}` (0-based)
  const [inventoryByUnit, setInventoryByUnit] = useState<Record<string, InventoryOption[]>>({});
  const [inventorySelections, setInventorySelections] = useState<Record<string, string>>({});
  const [inventorySearchText, setInventorySearchText] = useState<Record<string, string>>({});
  const [inventorySearching, setInventorySearching] = useState<Record<string, boolean>>({});
  const [manualImeis, setManualImeis] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["web-orders", filterStatus],
    queryFn: () => axiosInstance.get<{ orders: WebOrder[]; total: number; summary: Record<string, number> }>(`/web-orders?status=${filterStatus}`).then(r => r.data),
  });

  const { data: couriers } = useQuery({
    queryKey: ["couriers"],
    queryFn: () => axiosInstance.get<Courier[]>("/couriers").then(r => r.data),
  });

  const { data: returnRequests = [], isLoading: returnsLoading } = useQuery<ReturnRequest[]>({
    queryKey: ["web-order-returns", returnFilter],
    queryFn: () => axiosInstance.get<ReturnRequest[]>(`/web-orders/returns${returnFilter ? `?status=${returnFilter}` : ""}`).then(r => r.data),
    enabled: mainTab === "returns",
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...updates }: { id: number; [k: string]: unknown }) =>
      axiosInstance.patch(`/web-orders/${id}`, updates).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["web-orders"] });
      setSelectedOrder(null);
      toast({ title: "Order updated successfully" });
    },
  });

  const createShipmentMutation = useMutation({
    mutationFn: (payload: object) => axiosInstance.post("/shipments", payload).then(r => r.data),
    onSuccess: (shipment) => {
      qc.invalidateQueries({ queryKey: ["web-orders"] });
      toast({ title: `Shipment created — CN: ${shipment.cn ?? "pending"}` });
    },
    onError: () => toast({ title: "Failed to create shipment", variant: "destructive" }),
  });

  const { data: returnOrderDetail } = useQuery<{ total: number } | null>({
    queryKey: ["return-order-detail", selectedReturn?.orderNumber],
    queryFn: () => selectedReturn
      ? axiosInstance.get<{ total: number }>(`/web-orders/track?orderNumber=${selectedReturn.orderNumber}`).then(r => r.data)
      : Promise.resolve(null),
    enabled: !!selectedReturn,
  });

  const updateReturnMutation = useMutation({
    mutationFn: ({ id, ...patch }: { id: number; status?: string; adminNotes?: string; refundAmount?: number }) =>
      axiosInstance.patch(`/web-orders/returns/${id}`, patch).then(r => r.data),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["web-order-returns"] });
      setSelectedReturn(null);
      if (data?.walletCredited) {
        toast({ title: `Return updated — Rs ${data.refundAmount?.toLocaleString()} credited to wallet` });
      } else {
        toast({ title: "Return request updated" });
      }
    },
    onError: () => toast({ title: "Failed to update", variant: "destructive" }),
  });

  const collectCodMutation = useMutation({
    mutationFn: ({ id }: { id: number }) =>
      axiosInstance.post(`/web-orders/${id}/collect-cod`).then(r => r.data),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["web-orders"] });
      setSelectedOrder(null);
      toast({ title: `COD Collected — Rs ${data.collected?.toLocaleString()} recorded for ${data.orderNumber}` });
    },
    onError: () => toast({ title: "Failed to record COD collection", variant: "destructive" }),
  });

  useEffect(() => {
    if (!imeiDialog || !selectedOrder) {
      setInventoryByUnit({});
      setInventorySelections({});
      setInventorySearchText({});
      setInventorySearching({});
      setManualImeis({});
      return;
    }
    // Create per-unit keys: `${itemIdx}-${unitIdx}`
    // qty is a Drizzle numeric column → returned as string; use parseFloat for safety
    const newByUnit: Record<string, InventoryOption[]> = {};
    const newSel: Record<string, string> = {};
    selectedOrder.items.forEach((item, itemIdx) => {
      const qty = Math.max(1, Math.round(parseFloat(String(item.qty)) || 1));
      for (let u = 0; u < qty; u++) {
        newSel[`${itemIdx}-${u}`] = "loading";
      }
      if (!item.productId) {
        for (let u = 0; u < qty; u++) newSel[`${itemIdx}-${u}`] = "manual";
        return;
      }
      axiosInstance.get<InventoryOption[]>(`/web-orders/inventory-for-product?productId=${item.productId}`)
        .then(res => {
          const opts = res.data;
          setInventoryByUnit(prev => {
            const all: Record<string, InventoryOption[]> = {};
            for (let u = 0; u < qty; u++) all[`${itemIdx}-${u}`] = opts;
            return { ...prev, ...all };
          });
          setInventorySelections(prev => {
            const updated = { ...prev };
            for (let u = 0; u < qty; u++) {
              const key = `${itemIdx}-${u}`;
              if (opts.length === 0) {
                // No inventory at all → manual entry for all units
                updated[key] = "manual";
              } else if (qty === 1 && opts.length === 1) {
                // Single unit + single match → auto-select
                updated[key] = String(opts[0].id);
              } else {
                // Multiple units or multiple choices → let operator pick
                updated[key] = "";
              }
            }
            return updated;
          });
        })
        .catch(() => {
          setInventorySelections(prev => {
            const updated = { ...prev };
            for (let u = 0; u < qty; u++) updated[`${itemIdx}-${u}`] = "manual";
            return updated;
          });
        });
    });
    setInventoryByUnit(newByUnit);
    setInventorySelections(newSel);
    setInventorySearchText({});
    setInventorySearching({});
    setManualImeis({});
  }, [imeiDialog, selectedOrder?.id]);

  function openImeiDialog(fromCourier: boolean) {
    if (!selectedOrder) return;
    setPendingShipFromCourier(fromCourier);
    setImeiDialog(true);
  }

  function handleSave() {
    if (!selectedOrder) return;
    if (newStatus === "shipped") { openImeiDialog(false); return; }
    updateMutation.mutate({
      id: selectedOrder.id,
      status: newStatus,
      paymentStatus: newPaymentStatus,
      courierCn: courierCn || undefined,
    });
  }

  function handleCreateShipment() {
    if (!selectedOrder || !selectedCourierId) {
      toast({ title: "Select a courier first", variant: "destructive" }); return;
    }
    openImeiDialog(true);
  }

  function confirmShipWithImeis() {
    if (!selectedOrder) return;
    const inventoryAssignments: { itemIndex: number; inventoryItemIds: number[] }[] = [];
    const itemImeisPayload: { itemIndex: number; imeis: string[] }[] = [];
    selectedOrder.items.forEach((item, itemIdx) => {
      const qty = Math.max(1, Math.round(parseFloat(String(item.qty)) || 1));
      const ids: number[] = [];
      const imeis: string[] = [];
      for (let u = 0; u < qty; u++) {
        const key = `${itemIdx}-${u}`;
        const sel = inventorySelections[key];
        if (sel && sel !== "" && sel !== "manual" && sel !== "loading") {
          ids.push(parseInt(sel));
        } else if (sel === "manual" && manualImeis[key]?.trim()) {
          imeis.push(manualImeis[key].trim());
        }
      }
      if (ids.length) inventoryAssignments.push({ itemIndex: itemIdx, inventoryItemIds: ids });
      if (imeis.length) itemImeisPayload.push({ itemIndex: itemIdx, imeis });
    });

    if (pendingShipFromCourier) {
      createShipmentMutation.mutate({
        webOrderId: selectedOrder.id, courierId: parseInt(selectedCourierId),
        destination: selectedOrder.customerCity + (selectedOrder.customerAddress ? `, ${selectedOrder.customerAddress}` : ""),
        codAmount: selectedOrder.total, pieces: selectedOrder.items.length,
      });
    }

    updateMutation.mutate({
      id: selectedOrder.id,
      status: "shipped",
      paymentStatus: newPaymentStatus,
      courierCn: courierCn || undefined,
      ...(pendingShipFromCourier && selectedCourierId ? { courierId: parseInt(selectedCourierId) } : {}),
      ...(inventoryAssignments.length ? { inventoryAssignments } : {}),
      ...(itemImeisPayload.length ? { itemImeis: itemImeisPayload } : {}),
    });
    setImeiDialog(false);
  }

  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text).then(() => toast({ title: `${label} copied` }));
  }

  function buildWhatsAppMessage(order: WebOrder, cn: string, effectiveStatus?: string): string {
    const status = effectiveStatus ?? order.status;
    const invoiceUrl = order.invoiceId
      ? `https://geem.pk/api/invoices/${order.invoiceId}/print`
      : null;
    const statusEmoji = status === "delivered" ? "✅" : "🚚";
    const statusVerb = status === "delivered" ? "delivered" : "shipped";
    const itemLines = order.items.map(i => `  - ${i.description} x${i.qty} — Rs ${i.amount.toLocaleString()}`).join("\n");
    const shippingTo = [order.customerAddress, order.customerCity].filter(Boolean).join(", ");
    return [
      `Assalam-o-Alaikum *${order.customerName}*! 🎉`,
      ``,
      `Your order from Geem.pk has been ${statusVerb}! ${statusEmoji}`,
      ``,
      `Order #${order.orderNumber}`,
      cn ? `Tracking/CN: ${cn}` : null,
      shippingTo ? `Shipping to: ${shippingTo}` : null,
      ``,
      `Items:`,
      itemLines,
      ``,
      `Total: Rs ${order.total.toLocaleString()}`,
      invoiceUrl ? `\nView/Download Invoice:\n${invoiceUrl}` : null,
      ``,
      `Track at: https://geem.pk/track`,
      `Questions? WhatsApp: +92 307-8680005`,
      ``,
      `Thank you for shopping with Geem ❤️`,
    ].filter(l => l !== null).join("\n");
  }

  function openWhatsApp(order: WebOrder, cn: string, effectiveStatus?: string) {
    const msg = buildWhatsAppMessage(order, cn, effectiveStatus);
    const phone = toWaPhone(order.customerMobile);
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank");
  }

  const summary = data?.summary ?? {};
  const pendingReturnsCount = returnRequests.filter(r => r.status === "pending").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Web Orders</h1>
        <p className="text-muted-foreground">Manage incoming online orders and return requests</p>
      </div>

      {/* Main tab bar */}
      <div className="flex gap-1 border-b">
        {([
          { id: "orders" as MainTab, label: "Orders" },
          { id: "returns" as MainTab, label: "Return Requests", badge: pendingReturnsCount > 0 ? pendingReturnsCount : undefined },
        ]).map(t => (
          <button key={t.id} onClick={() => setMainTab(t.id)}
            className={cn("flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
              mainTab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {t.label}
            {t.badge !== undefined && (
              <span className="bg-orange-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">{t.badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* ORDERS tab */}
      {mainTab === "orders" && (
        <>
          <div className="grid grid-cols-5 gap-3">
            {["new", "confirmed", "processing", "shipped", "delivered"].map(s => (
              <Card key={s}
                className={cn("cursor-pointer border-2 transition-all hover:shadow-sm", filterStatus === s ? "border-primary" : "border-transparent")}
                onClick={() => setFilterStatus(filterStatus === s ? "" : s)}>
                <CardContent className="pt-3 pb-3 text-center">
                  <p className="text-xs text-muted-foreground capitalize">{s}</p>
                  <p className="text-2xl font-bold">{summary[s] ?? 0}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardContent className="pt-6">
              {isLoading ? <p className="text-center py-10 text-muted-foreground">Loading orders...</p> : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order #</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>City</TableHead>
                      <TableHead>Items</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Payment</TableHead>
                      <TableHead>Courier CN</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.orders.map(order => (
                      <TableRow key={order.id} className="cursor-pointer hover:bg-muted/50" onClick={() => {
                        setSelectedOrder(order); setNewStatus(order.status);
                        setNewPaymentStatus(order.paymentStatus);
                        setCourierCn(order.courierCn ?? ""); setCourierMode("manual"); setSelectedCourierId("");
                      }}>
                        <TableCell className="font-mono font-semibold text-sm">{order.orderNumber}</TableCell>
                        <TableCell>
                          <div className="font-medium">{order.customerName}</div>
                          <div className="text-xs text-muted-foreground">{order.customerMobile}</div>
                        </TableCell>
                        <TableCell className="text-sm">{order.customerCity}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{order.items.length} item{order.items.length !== 1 ? "s" : ""}</TableCell>
                        <TableCell className="font-bold">Rs {order.total.toLocaleString()}</TableCell>
                        <TableCell><StatusBadge status={order.status} map={STATUS_COLORS} /></TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <StatusBadge status={order.paymentStatus} map={PAYMENT_STATUS_COLORS} />
                            <span className="text-xs text-muted-foreground capitalize">{PAYMENT_METHOD_LABELS[order.paymentMethod] ?? order.paymentMethod}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{order.courierCn ?? <span className="text-muted-foreground">—</span>}</TableCell>
                        <TableCell className="text-sm whitespace-nowrap">{formatPakDate(order.createdAt)}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="outline" size="sm" onClick={e => {
                            e.stopPropagation();
                            setSelectedOrder(order); setNewStatus(order.status);
                            setNewPaymentStatus(order.paymentStatus);
                            setCourierCn(order.courierCn ?? ""); setCourierMode("manual"); setSelectedCourierId("");
                          }}>Manage</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!data?.orders.length && (
                      <TableRow><TableCell colSpan={10} className="text-center py-12 text-muted-foreground">
                        <Package className="h-10 w-10 mx-auto mb-2 opacity-20" />
                        <p>No orders found{filterStatus ? ` with status "${filterStatus}"` : ""}</p>
                      </TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* RETURNS tab */}
      {mainTab === "returns" && (
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            {["", "pending", "approved", "rejected", "completed"].map(s => (
              <button key={s} onClick={() => setReturnFilter(s)}
                className={cn("px-3 py-1.5 rounded-full text-xs font-medium border transition-colors capitalize",
                  returnFilter === s ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:border-slate-400")}>
                {s === "" ? "All" : s}
              </button>
            ))}
          </div>
          <Card>
            <CardContent className="pt-6">
              {returnsLoading ? <p className="text-center py-10 text-muted-foreground">Loading...</p> : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order #</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {returnRequests.map(r => (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono font-medium">{r.orderNumber}</TableCell>
                        <TableCell>
                          {r.customerName}
                          <div className="text-xs text-muted-foreground">{r.customerMobile}</div>
                          {r.customerEmail && <div className="text-xs text-muted-foreground">{r.customerEmail}</div>}
                        </TableCell>
                        <TableCell className="text-sm max-w-40">
                          <p className="font-medium">{RETURN_REASON_LABELS[r.reason] ?? r.reason}</p>
                          <p className="text-muted-foreground text-xs truncate">{r.description}</p>
                        </TableCell>
                        <TableCell><StatusBadge status={r.status} map={RETURN_STATUS_COLORS} /></TableCell>
                        <TableCell className="text-sm">{formatPakDate(r.createdAt)}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="outline" size="sm" onClick={() => {
                            setSelectedReturn(r); setReturnStatus(r.status); setReturnNotes(r.adminNotes ?? ""); setReturnRefundAmount(r.refundAmount != null ? String(r.refundAmount) : "");
                          }}>Review</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!returnRequests.length && (
                      <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                        <RotateCcw className="h-8 w-8 mx-auto mb-2 opacity-20" />
                        No return requests {returnFilter ? `with status "${returnFilter}"` : "yet"}
                      </TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ─── Order Detail Dialog ─── */}
      <Dialog open={!!selectedOrder} onOpenChange={v => !v && setSelectedOrder(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedOrder && (
            <>
              <DialogHeader className="pb-2">
                <DialogTitle className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    <Hash className="h-4 w-4 text-muted-foreground" />
                    <span className="font-mono text-lg">{selectedOrder.orderNumber}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={selectedOrder.status} map={STATUS_COLORS} />
                    <StatusBadge status={selectedOrder.paymentStatus} map={PAYMENT_STATUS_COLORS} />
                  </div>
                </DialogTitle>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1">
                  <Calendar className="h-3 w-3" />
                  {formatPakDateTime(selectedOrder.createdAt)}
                </div>
              </DialogHeader>

              <div className="space-y-4">

                {/* ─── Customer Info ─── */}
                <div className="rounded-lg border bg-slate-50/60 p-4 space-y-2.5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Customer Details</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center gap-2">
                      <User className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                      <span className="font-medium">{selectedOrder.customerName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                      <span>{selectedOrder.customerMobile}</span>
                      <a href={`https://wa.me/${toWaPhone(selectedOrder.customerMobile)}`}
                        target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded hover:bg-green-200 transition-colors">
                        <MessageCircle className="h-3 w-3" /> WhatsApp
                      </a>
                      <button onClick={() => copyToClipboard(selectedOrder.customerMobile, "Mobile")} className="text-muted-foreground hover:text-foreground">
                        <Copy className="h-3 w-3" />
                      </button>
                    </div>
                    {selectedOrder.customerEmail && (
                      <div className="flex items-center gap-2 sm:col-span-2">
                        <Mail className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                        <span>{selectedOrder.customerEmail}</span>
                      </div>
                    )}
                    <div className="flex items-start gap-2 sm:col-span-2">
                      <MapPin className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
                      <div>
                        <span className="font-medium">{selectedOrder.customerCity}</span>
                        {selectedOrder.customerAddress && (
                          <span className="text-muted-foreground"> — {selectedOrder.customerAddress}</span>
                        )}
                      </div>
                      <button onClick={() => copyToClipboard(`${selectedOrder.customerCity}${selectedOrder.customerAddress ? ", " + selectedOrder.customerAddress : ""}`, "Address")}
                        className="text-muted-foreground hover:text-foreground ml-auto flex-shrink-0">
                        <Copy className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* ─── Payment Summary ─── */}
                <div className="rounded-lg border bg-slate-50/60 p-4 space-y-2.5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Payment Summary</p>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex items-center gap-2">
                      <PaymentIcon method={selectedOrder.paymentMethod} />
                      <span className="text-muted-foreground">Method:</span>
                      <span className="font-medium capitalize">{PAYMENT_METHOD_LABELS[selectedOrder.paymentMethod] ?? selectedOrder.paymentMethod}</span>
                      {selectedOrder.paymentMethod !== "cod" && selectedOrder.paymentMethod !== "wallet" && (
                        <StatusBadge status={selectedOrder.paymentStatus} map={PAYMENT_STATUS_COLORS} />
                      )}
                    </div>
                    {selectedOrder.transactionId && (
                      <div className="flex items-center gap-2">
                        <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-muted-foreground">Transaction ID:</span>
                        <span className="font-mono font-medium">{selectedOrder.transactionId}</span>
                        <button onClick={() => copyToClipboard(selectedOrder.transactionId!, "Transaction ID")} className="text-muted-foreground hover:text-foreground">
                          <Copy className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                    <div className="border-t pt-2 mt-2 space-y-1">
                      <div className="flex justify-between text-muted-foreground">
                        <span>Subtotal</span>
                        <span>Rs {selectedOrder.subtotal.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>Shipping</span>
                        <span>Rs {selectedOrder.shipping.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between font-bold text-base border-t pt-1.5 mt-1">
                        <span>Total</span>
                        <span className="text-primary">Rs {selectedOrder.total.toLocaleString()}</span>
                      </div>
                    </div>

                    {/* Invoice & COD collection status */}
                    <div className="border-t pt-3 mt-1 space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground">Invoice:</span>
                        {selectedOrder.invoiceStatus ? (
                          <>
                            <span className="font-mono text-xs">{selectedOrder.orderNumber}</span>
                            <span className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full border capitalize
                              ${selectedOrder.invoiceStatus === "paid" ? "bg-green-100 text-green-800 border-green-200"
                              : selectedOrder.invoiceStatus === "draft" ? "bg-amber-100 text-amber-800 border-amber-200"
                              : "bg-slate-100 text-slate-700 border-slate-200"}`}>
                              {selectedOrder.invoiceStatus === "draft" ? "Pending Payment" : selectedOrder.invoiceStatus}
                            </span>
                            {selectedOrder.invoicePaid != null && selectedOrder.invoicePaid > 0 && (
                              <span className="text-xs text-green-600 font-medium">Rs {selectedOrder.invoicePaid.toLocaleString()} collected</span>
                            )}
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">Not yet created</span>
                        )}
                      </div>
                      {selectedOrder.paymentMethod === "cod"
                        && selectedOrder.invoiceStatus === "draft"
                        && ["shipped", "delivered"].includes(selectedOrder.status) && (
                        <Button size="sm" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                          disabled={collectCodMutation.isPending}
                          onClick={() => collectCodMutation.mutate({ id: selectedOrder.id })}>
                          {collectCodMutation.isPending ? "Recording..." : `✓ Collect COD — Rs ${selectedOrder.total.toLocaleString()}`}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                {/* ─── Items ─── */}
                <div className="rounded-lg border overflow-hidden">
                  <div className="bg-slate-50 px-4 py-2.5 border-b">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Order Items ({selectedOrder.items.length})
                    </p>
                  </div>
                  <div className="divide-y">
                    {selectedOrder.items.map((item, i) => (
                      <div key={i} className="flex items-center gap-3 px-4 py-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.description}</p>
                          <p className="text-xs text-muted-foreground">
                            Rs {item.price.toLocaleString()} × {item.qty}
                          </p>
                        </div>
                        <p className="text-sm font-bold flex-shrink-0">Rs {item.amount.toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ─── Status & Payment Status ─── */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Order Status</Label>
                    <Select value={newStatus} onValueChange={setNewStatus}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map(s => (
                          <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Payment Status</Label>
                    <Select value={newPaymentStatus} onValueChange={setNewPaymentStatus}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PAYMENT_STATUS_OPTIONS.map(s => (
                          <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* ─── WhatsApp + Invoice Actions ─── */}
                {(newStatus === "shipped" || newStatus === "delivered" || selectedOrder.status === "shipped" || selectedOrder.status === "delivered") && (
                  <div className="rounded-lg border border-green-200 bg-green-50 p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <MessageCircle className="h-4 w-4 text-green-600" />
                      <p className="text-xs font-semibold uppercase tracking-wide text-green-700">Notify Customer</p>
                    </div>
                    <div className="bg-white rounded-md border border-green-200 p-3 text-xs text-slate-600 font-mono whitespace-pre-wrap max-h-36 overflow-y-auto">
                      {buildWhatsAppMessage(selectedOrder, courierCn || selectedOrder.courierCn || "", newStatus || selectedOrder.status)}
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white gap-1.5"
                        onClick={() => openWhatsApp(selectedOrder, courierCn || selectedOrder.courierCn || "", newStatus || selectedOrder.status)}>
                        <MessageCircle className="h-3.5 w-3.5" /> Send via WhatsApp
                      </Button>
                      {selectedOrder.invoiceId && (
                        <>
                          <Button size="sm" variant="outline" className="gap-1.5"
                            onClick={() => window.open(`https://geem.pk/api/invoices/${selectedOrder.invoiceId}/print`, "_blank")}>
                            <FileText className="h-3.5 w-3.5" /> View Invoice
                          </Button>
                          <Button size="sm" variant="outline" className="gap-1.5"
                            onClick={() => copyToClipboard(`https://geem.pk/api/invoices/${selectedOrder.invoiceId}/print`, "Invoice link")}>
                            <Copy className="h-3.5 w-3.5" /> Copy Invoice Link
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* ─── Courier / Shipping ─── */}
                <div className="space-y-3 border rounded-lg p-4 bg-muted/20">
                  <div className="flex items-center gap-2">
                    <Truck className="h-4 w-4 text-muted-foreground" />
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Courier & Shipping</p>
                    {selectedOrder.courierCn && (
                      <span className="ml-auto font-mono text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded">
                        {selectedOrder.courierCn}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant={courierMode === "manual" ? "default" : "outline"} onClick={() => setCourierMode("manual")}>
                      Manual CN
                    </Button>
                    <Button size="sm" variant={courierMode === "auto" ? "default" : "outline"} onClick={() => setCourierMode("auto")}>
                      <Plus className="h-3 w-3 mr-1" /> Create Parcel
                    </Button>
                  </div>
                  {courierMode === "manual" ? (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Courier Company</Label>
                        <Select value={selectedCourierId} onValueChange={setSelectedCourierId}>
                          <SelectTrigger className="mt-1"><SelectValue placeholder="Optional" /></SelectTrigger>
                          <SelectContent>
                            {couriers?.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Tracking / CN Number</Label>
                        <Input className="mt-1" value={courierCn} onChange={e => setCourierCn(e.target.value)} placeholder="e.g. TCS-123456789" />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div>
                        <Label className="text-xs">Select Courier *</Label>
                        <Select value={selectedCourierId} onValueChange={setSelectedCourierId}>
                          <SelectTrigger className="mt-1"><SelectValue placeholder="Select courier" /></SelectTrigger>
                          <SelectContent>
                            {couriers?.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <Input value={courierCn} onChange={e => setCourierCn(e.target.value)} placeholder="CN Number (if already known)" />
                      <Button size="sm" className="w-full" onClick={handleCreateShipment}
                        disabled={!selectedCourierId || createShipmentMutation.isPending}>
                        <Truck className="h-4 w-4 mr-1" />
                        {createShipmentMutation.isPending ? "Creating..." : "Create Shipment & Mark Shipped"}
                      </Button>
                      {!couriers?.length && (
                        <p className="text-xs text-amber-600">⚠ No couriers configured. Add couriers in Master Data → Couriers.</p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <DialogFooter className="pt-2">
                <Button variant="outline" onClick={() => setSelectedOrder(null)}>Cancel</Button>
                <Button onClick={handleSave} disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── IMEI / Device ID / ICCID Dialog (shown when marking as Shipped) ─── */}
      <Dialog open={imeiDialog} onOpenChange={v => !v && setImeiDialog(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-blue-600" />
              Assign Devices for Shipment
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            <p className="text-sm text-muted-foreground">
              Each unit needs its own device. Search by IMEI, Device ID, ICCID or model. Assigning marks <strong>Sold</strong>.
            </p>
            {selectedOrder?.items.map((item, itemIdx) => {
              const qty = Math.max(1, Math.round(parseFloat(String(item.qty)) || 1));
              return (
                <div key={itemIdx} className="border rounded-xl p-3 space-y-3 bg-white">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">{item.description}</p>
                    <Badge variant="outline" className="text-xs">Qty: {qty}</Badge>
                  </div>
                  {Array.from({ length: qty }).map((_, unitIdx) => {
                    const key = `${itemIdx}-${unitIdx}`;
                    const sel = inventorySelections[key];
                    const opts = inventoryByUnit[key] ?? [];
                    const searchText = inventorySearchText[key] ?? "";
                    const searching = inventorySearching[key] ?? false;

                    const alreadySelectedIds = new Set(
                      Object.entries(inventorySelections)
                        .filter(([k, v]) => k !== key && v && v !== "" && v !== "manual" && v !== "loading")
                        .map(([, v]) => v)
                    );
                    const filteredOpts = (searchText.length > 0
                      ? opts.filter(o =>
                          o.imei.toLowerCase().includes(searchText.toLowerCase()) ||
                          (o.deviceId ?? "").toLowerCase().includes(searchText.toLowerCase()) ||
                          (o.iccid ?? "").toLowerCase().includes(searchText.toLowerCase()) ||
                          o.modelName.toLowerCase().includes(searchText.toLowerCase())
                        )
                      : opts.slice(0, 6)
                    ).filter(o => !alreadySelectedIds.has(String(o.id)));

                    const selectedOpt = opts.find(o => String(o.id) === sel);

                    function doBackendSearch(text: string, k: string) {
                      if (text.length < 2) return;
                      setInventorySearching(p => ({ ...p, [k]: true }));
                      axiosInstance.get<InventoryOption[]>(`/web-orders/inventory-for-product?q=${encodeURIComponent(text)}`)
                        .then(res => { setInventoryByUnit(p => ({ ...p, [k]: res.data })); })
                        .finally(() => setInventorySearching(p => ({ ...p, [k]: false })));
                    }

                    return (
                      <div key={key} className="pl-3 border-l-2 border-blue-200 space-y-1.5">
                        <p className="text-[11px] font-semibold text-blue-700 uppercase tracking-wider">Unit {unitIdx + 1}</p>
                        {sel === "loading" ? (
                          <p className="text-xs text-muted-foreground animate-pulse">Searching inventory…</p>
                        ) : sel && sel !== "" && sel !== "manual" ? (
                          <div className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 p-2">
                            <div className="flex-1 min-w-0 space-y-0.5">
                              <p className="font-mono text-[11px] font-semibold text-blue-900">{imeiLabel(selectedOpt?.imei ?? sel)}: {selectedOpt?.imei ?? sel}</p>
                              {selectedOpt?.deviceId && <p className="font-mono text-[11px] text-blue-800">Device ID: {selectedOpt.deviceId}</p>}
                              {selectedOpt?.iccid && <p className="font-mono text-[11px] text-blue-700">ICCID: {selectedOpt.iccid}</p>}
                              <p className="text-[11px] text-blue-600">{selectedOpt?.modelName}</p>
                            </div>
                            <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px] shrink-0 text-blue-700 hover:text-red-600"
                              onClick={() => {
                                setInventorySelections(p => ({ ...p, [key]: "" }));
                                setInventorySearchText(p => ({ ...p, [key]: "" }));
                              }}>
                              Change
                            </Button>
                          </div>
                        ) : sel === "manual" ? (
                          <div className="space-y-1">
                            <Input placeholder="IMEI / Device ID / ICCID"
                              value={manualImeis[key] ?? ""}
                              onChange={e => setManualImeis(p => ({ ...p, [key]: e.target.value }))}
                              className="font-mono text-sm"
                              autoFocus
                            />
                            <button type="button" className="text-xs text-muted-foreground underline"
                              onClick={() => setInventorySelections(p => ({ ...p, [key]: "" }))}>
                              ← Back to search
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <div className="relative">
                              <Input placeholder="Search IMEI, Device ID, ICCID or model…"
                                value={searchText}
                                onChange={e => setInventorySearchText(p => ({ ...p, [key]: e.target.value }))}
                                onKeyDown={e => { if (e.key === "Enter") doBackendSearch(searchText, key); }}
                                className="font-mono text-sm pr-16"
                              />
                              {searchText.length >= 2 && (
                                <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-blue-600 hover:underline"
                                  onClick={() => doBackendSearch(searchText, key)}>
                                  {searching ? "…" : "Search all"}
                                </button>
                              )}
                            </div>
                            {filteredOpts.length > 0 ? (
                              <div className="rounded-md border divide-y max-h-28 overflow-y-auto">
                                {filteredOpts.map(opt => (
                                  <button key={opt.id} type="button"
                                    className="w-full text-left px-2 py-1 hover:bg-blue-50 transition-colors"
                                    onClick={() => {
                                      setInventorySelections(p => ({ ...p, [key]: String(opt.id) }));
                                      setInventorySearchText(p => ({ ...p, [key]: "" }));
                                    }}>
                                    <p className="font-mono text-[11px] font-medium">
                                      {opt.imei}
                                      {opt.deviceId && <span className="text-blue-700"> · Dev:{opt.deviceId}</span>}
                                      {opt.iccid && <span className="text-purple-700"> · ICCID:{opt.iccid}</span>}
                                    </p>
                                    <p className="text-[11px] text-muted-foreground">{opt.modelName}</p>
                                  </button>
                                ))}
                              </div>
                            ) : searchText.length > 0 && !searching ? (
                              <p className="text-xs text-muted-foreground px-1">
                                No matches — press <kbd className="rounded border px-1 text-xs">Enter</kbd> to search all inventory
                              </p>
                            ) : null}
                            <button type="button" className="text-xs text-muted-foreground underline"
                              onClick={() => setInventorySelections(p => ({ ...p, [key]: "manual" }))}>
                              ✏️ Enter manually
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImeiDialog(false)}>Cancel</Button>
            <Button onClick={confirmShipWithImeis} disabled={updateMutation.isPending} className="gap-1.5">
              <Truck className="h-4 w-4" />
              {updateMutation.isPending ? "Saving..." : "Confirm & Mark Shipped"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Return Review Dialog ─── */}
      <Dialog open={!!selectedReturn} onOpenChange={v => !v && setSelectedReturn(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-4 w-4 text-orange-600" /> Review Return Request
            </DialogTitle>
          </DialogHeader>
          {selectedReturn && (
            <div className="space-y-4">
              <div className="bg-slate-50 rounded-lg p-3 space-y-1.5 text-sm">
                <div><span className="text-muted-foreground">Order:</span> <span className="font-mono font-bold">{selectedReturn.orderNumber}</span></div>
                <div><span className="text-muted-foreground">Customer:</span> {selectedReturn.customerName} · {selectedReturn.customerMobile}</div>
                {selectedReturn.customerEmail && <div><span className="text-muted-foreground">Email:</span> {selectedReturn.customerEmail}</div>}
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase font-semibold tracking-wide">Reason</p>
                <p className="text-sm font-medium">{RETURN_REASON_LABELS[selectedReturn.reason] ?? selectedReturn.reason}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase font-semibold tracking-wide">Customer Description</p>
                <p className="text-sm bg-slate-50 rounded-lg p-3 border">{selectedReturn.description}</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Update Status</Label>
                <Select value={returnStatus} onValueChange={(v) => {
                  setReturnStatus(v);
                  if ((v === "approved" || v === "completed") && !returnRefundAmount && returnOrderDetail?.total) {
                    setReturnRefundAmount(String(returnOrderDetail.total));
                  }
                }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RETURN_STATUS_OPTIONS.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {returnStatus === "completed" && (
                <div className="space-y-1.5">
                  <Label className="text-sm">
                    Refund Amount
                    <span className="text-muted-foreground ml-1 text-xs">(wallet credited automatically when saved)</span>
                  </Label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Rs</span>
                    <Input type="number" min="0" step="1"
                      placeholder={returnOrderDetail ? `Full: Rs ${returnOrderDetail.total.toLocaleString()}` : "Enter amount"}
                      value={returnRefundAmount}
                      onChange={e => setReturnRefundAmount(e.target.value)}
                      className="flex-1"
                      disabled={selectedReturn?.status === "completed"} />
                    {returnOrderDetail && selectedReturn?.status !== "completed" && (
                      <Button type="button" variant="outline" size="sm"
                        onClick={() => setReturnRefundAmount(String(returnOrderDetail.total))}>Full</Button>
                    )}
                  </div>
                </div>
              )}
              <div className="space-y-1.5">
                <Label className="text-sm">Admin Notes</Label>
                <Input placeholder="Internal notes (optional)" value={returnNotes} onChange={e => setReturnNotes(e.target.value)} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedReturn(null)}>Cancel</Button>
            <Button onClick={() => {
              if (!selectedReturn) return;
              updateReturnMutation.mutate({
                id: selectedReturn.id, status: returnStatus, adminNotes: returnNotes,
                ...(returnRefundAmount ? { refundAmount: parseFloat(returnRefundAmount) } : {}),
              });
            }} disabled={updateReturnMutation.isPending}>
              {updateReturnMutation.isPending ? "Saving..." : "Save Return"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
