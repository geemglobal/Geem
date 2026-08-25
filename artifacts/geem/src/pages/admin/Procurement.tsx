import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { axiosInstance } from "@/lib/axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Package, ClipboardList } from "lucide-react";

interface ImportOrder { id: number; importOrderNumber: string; vendorName: string; vendorId: number; orderDate: string; currency: string; total: number; paymentStatus: string; shipmentStatus: string; trackingNumber: string | null; items: Array<{ description: string; qty: number; price: number; amount: number }>; }
interface Vendor { id: number; name: string; }
interface Grn { id: number; grnNumber: string; importOrderNumber: string; receivedDate: string; itemsCount: number; status: string; }

const statusColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline", paid: "default", received: "default", complete: "default", partial: "secondary", cancelled: "destructive",
};

export default function Procurement() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"imports" | "grn">("imports");
  const [showForm, setShowForm] = useState(false);
  const [showGrnForm, setShowGrnForm] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<ImportOrder | null>(null);
  const [items, setItems] = useState([{ description: "", qty: 1, price: 0, amount: 0 }]);
  const [form, setForm] = useState({ vendorId: "", currency: "USD", exchangeRate: "285", shippingCost: "0" });
  const [grnForm, setGrnForm] = useState({ importOrderId: "", receivedDate: new Date().toISOString().split("T")[0] });

  const { data: importOrders } = useQuery({
    queryKey: ["import-orders"],
    queryFn: () => axiosInstance.get<ImportOrder[]>("/procurement/imports").then(r => r.data),
    enabled: activeTab === "imports",
  });

  const { data: grns } = useQuery({
    queryKey: ["grns"],
    queryFn: () => axiosInstance.get<Grn[]>("/procurement/grn").then(r => r.data),
    enabled: activeTab === "grn",
  });

  const { data: vendors } = useQuery({
    queryKey: ["vendors"],
    queryFn: () => axiosInstance.get<Vendor[]>("/vendors").then(r => r.data),
  });

  const createOrder = useMutation({
    mutationFn: (payload: object) => axiosInstance.post("/procurement/imports", payload).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["import-orders"] }); setShowForm(false); toast({ title: "Import order created" }); },
  });

  const updateOrder = useMutation({
    mutationFn: ({ id, ...updates }: { id: number; [k: string]: unknown }) => axiosInstance.patch(`/procurement/imports/${id}`, updates).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["import-orders"] }); setSelectedOrder(null); toast({ title: "Order updated" }); },
  });

  const createGrn = useMutation({
    mutationFn: (payload: object) => axiosInstance.post("/procurement/grn", payload).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["grns"] }); setShowGrnForm(false); toast({ title: "GRN created" }); },
  });

  function updateItem(idx: number, field: string, value: number | string) {
    setItems(prev => {
      const next = [...prev];
      (next[idx] as Record<string, unknown>)[field] = value;
      next[idx].amount = next[idx].qty * next[idx].price;
      return next;
    });
  }

  function submitOrder() {
    if (!form.vendorId) { toast({ title: "Select a vendor", variant: "destructive" }); return; }
    createOrder.mutate({ vendorId: parseInt(form.vendorId), currency: form.currency, exchangeRate: parseFloat(form.exchangeRate), shippingCost: parseFloat(form.shippingCost), items });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Procurement</h1><p className="text-muted-foreground">Manage import orders and goods receipt</p></div>
        <div className="flex gap-2">
          {activeTab === "imports" && <Button onClick={() => setShowForm(true)}><Plus className="h-4 w-4 mr-2" />New Import Order</Button>}
          {activeTab === "grn" && <Button onClick={() => setShowGrnForm(true)}><Plus className="h-4 w-4 mr-2" />New GRN</Button>}
        </div>
      </div>

      <div className="flex gap-2">
        <Button variant={activeTab === "imports" ? "default" : "outline"} onClick={() => setActiveTab("imports")}><ClipboardList className="h-4 w-4 mr-2" />Import Orders</Button>
        <Button variant={activeTab === "grn" ? "default" : "outline"} onClick={() => setActiveTab("grn")}><Package className="h-4 w-4 mr-2" />GRN</Button>
      </div>

      {activeTab === "imports" && (
        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order #</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Currency</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Shipment</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {importOrders?.map(o => (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono font-medium">{o.importOrderNumber}</TableCell>
                    <TableCell>{o.vendorName}</TableCell>
                    <TableCell>{o.orderDate}</TableCell>
                    <TableCell>{o.currency}</TableCell>
                    <TableCell className="font-bold">{o.currency} {o.total.toLocaleString()}</TableCell>
                    <TableCell><Badge variant={statusColors[o.paymentStatus] ?? "outline"}>{o.paymentStatus}</Badge></TableCell>
                    <TableCell><Badge variant={statusColors[o.shipmentStatus] ?? "outline"}>{o.shipmentStatus}</Badge></TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => setSelectedOrder(o)}>Update</Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!importOrders?.length && <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No import orders</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {activeTab === "grn" && (
        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>GRN #</TableHead>
                  <TableHead>Import Order</TableHead>
                  <TableHead>Received Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {grns?.map(g => (
                  <TableRow key={g.id}>
                    <TableCell className="font-mono font-medium">{g.grnNumber}</TableCell>
                    <TableCell>{g.importOrderNumber}</TableCell>
                    <TableCell>{g.receivedDate}</TableCell>
                    <TableCell><Badge variant={statusColors[g.status] ?? "outline"}>{g.status}</Badge></TableCell>
                  </TableRow>
                ))}
                {!grns?.length && <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No GRN records</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* New Import Order */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Import Order</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Vendor *</Label>
              <Select value={form.vendorId} onValueChange={v => setForm(f => ({ ...f, vendorId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select vendor" /></SelectTrigger>
                <SelectContent>{vendors?.map(v => <SelectItem key={v.id} value={String(v.id)}>{v.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Currency</Label>
                <Select value={form.currency} onValueChange={v => setForm(f => ({ ...f, currency: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="USD">USD</SelectItem><SelectItem value="PKR">PKR</SelectItem><SelectItem value="CNY">CNY</SelectItem><SelectItem value="EUR">EUR</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label>Exchange Rate (PKR)</Label><Input type="number" value={form.exchangeRate} onChange={e => setForm(f => ({ ...f, exchangeRate: e.target.value }))} /></div>
              <div><Label>Shipping Cost</Label><Input type="number" value={form.shippingCost} onChange={e => setForm(f => ({ ...f, shippingCost: e.target.value }))} /></div>
            </div>
            <div>
              <div className="flex justify-between items-center mb-2">
                <Label>Items</Label>
                <Button size="sm" variant="outline" onClick={() => setItems(p => [...p, { description: "", qty: 1, price: 0, amount: 0 }])}><Plus className="h-3 w-3 mr-1" />Row</Button>
              </div>
              {items.map((item, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 mb-2">
                  <Input className="col-span-5" placeholder="Description" value={item.description} onChange={e => updateItem(i, "description", e.target.value)} />
                  <Input className="col-span-2" type="number" placeholder="Qty" value={item.qty} onChange={e => updateItem(i, "qty", parseFloat(e.target.value) || 0)} />
                  <Input className="col-span-3" type="number" placeholder={`Price (${form.currency})`} value={item.price || ""} onChange={e => updateItem(i, "price", parseFloat(e.target.value) || 0)} />
                  <div className="col-span-1 flex items-center text-xs font-medium">{form.currency} {item.amount.toLocaleString()}</div>
                  <Button className="col-span-1" variant="ghost" size="sm" onClick={() => setItems(p => p.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              ))}
              <div className="text-right font-bold text-sm">{form.currency} {items.reduce((s, i) => s + i.amount, 0).toLocaleString()} + PKR {parseFloat(form.shippingCost || "0").toLocaleString()} shipping</div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={submitOrder} disabled={createOrder.isPending}>{createOrder.isPending ? "Creating..." : "Create Import Order"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Update Order */}
      <Dialog open={!!selectedOrder} onOpenChange={v => !v && setSelectedOrder(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Update {selectedOrder?.importOrderNumber}</DialogTitle></DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Vendor:</span> {selectedOrder.vendorName}</div>
                <div><span className="text-muted-foreground">Total:</span> <span className="font-bold">{selectedOrder.currency} {selectedOrder.total.toLocaleString()}</span></div>
              </div>
              <div>
                <Label>Payment Status</Label>
                <Select defaultValue={selectedOrder.paymentStatus} onValueChange={v => setSelectedOrder(o => o ? { ...o, paymentStatus: v } : null)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="pending">Pending</SelectItem><SelectItem value="paid">Paid</SelectItem><SelectItem value="partial">Partial</SelectItem></SelectContent>
                </Select>
              </div>
              <div>
                <Label>Shipment Status</Label>
                <Select defaultValue={selectedOrder.shipmentStatus} onValueChange={v => setSelectedOrder(o => o ? { ...o, shipmentStatus: v } : null)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="pending">Pending</SelectItem><SelectItem value="in_transit">In Transit</SelectItem><SelectItem value="received">Received</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label>Tracking Number</Label><Input value={selectedOrder.trackingNumber ?? ""} onChange={e => setSelectedOrder(o => o ? { ...o, trackingNumber: e.target.value } : null)} /></div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setSelectedOrder(null)}>Cancel</Button>
                <Button onClick={() => updateOrder.mutate({ id: selectedOrder.id, paymentStatus: selectedOrder.paymentStatus, shipmentStatus: selectedOrder.shipmentStatus, trackingNumber: selectedOrder.trackingNumber })} disabled={updateOrder.isPending}>
                  {updateOrder.isPending ? "Updating..." : "Update"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* New GRN */}
      <Dialog open={showGrnForm} onOpenChange={setShowGrnForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Goods Receipt Note</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Import Order *</Label>
              <Select value={grnForm.importOrderId} onValueChange={v => setGrnForm(f => ({ ...f, importOrderId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select import order" /></SelectTrigger>
                <SelectContent>{importOrders?.map(o => <SelectItem key={o.id} value={String(o.id)}>{o.importOrderNumber} — {o.vendorName}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Received Date</Label><Input type="date" value={grnForm.receivedDate} onChange={e => setGrnForm(f => ({ ...f, receivedDate: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGrnForm(false)}>Cancel</Button>
            <Button onClick={() => createGrn.mutate({ importOrderId: parseInt(grnForm.importOrderId), receivedDate: grnForm.receivedDate })} disabled={createGrn.isPending || !grnForm.importOrderId}>
              {createGrn.isPending ? "Creating..." : "Create GRN"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
