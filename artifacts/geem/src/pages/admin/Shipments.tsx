import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { axiosInstance } from "@/lib/axios";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Truck } from "lucide-react";

interface Shipment { id: number; courierId: number; courierName: string; destination: string; cn: string | null; status: string; codAmount: number; shippingCharges: number; invoiceId: number | null; webOrderId: number | null; pieces: number | null; createdAt: string; }
interface Courier { id: number; name: string; }

const STATUS_COLORS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline", booked: "secondary", in_transit: "secondary", delivered: "default", returned: "destructive", cancelled: "destructive",
};

export default function Shipments() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [form, setForm] = useState({ courierId: "", destination: "", pieces: "1", codAmount: "0", shippingCharges: "0" });
  const [updateCn, setUpdateCn] = useState("");
  const [updateStatus, setUpdateStatus] = useState("");

  const { data: shipments } = useQuery({
    queryKey: ["shipments"],
    queryFn: () => axiosInstance.get<Shipment[]>("/shipments").then(r => r.data),
  });

  const { data: couriers } = useQuery({
    queryKey: ["couriers"],
    queryFn: () => axiosInstance.get<Courier[]>("/couriers").then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (payload: object) => axiosInstance.post("/shipments", payload).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["shipments"] }); setShowForm(false); toast({ title: "Shipment booked" }); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...updates }: { id: number; [k: string]: unknown }) => axiosInstance.patch(`/shipments/${id}`, updates).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["shipments"] }); setSelectedShipment(null); toast({ title: "Shipment updated" }); },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold flex items-center gap-2"><Truck className="h-6 w-6" />Courier Center</h1><p className="text-muted-foreground">Manage outgoing shipments</p></div>
        <Button onClick={() => setShowForm(true)}><Plus className="h-4 w-4 mr-2" />Book Shipment</Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Courier</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead>CN</TableHead>
                <TableHead>COD</TableHead>
                <TableHead>Charges</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shipments?.map(s => (
                <TableRow key={s.id}>
                  <TableCell className="font-mono">#{s.id}</TableCell>
                  <TableCell>{s.courierName}</TableCell>
                  <TableCell>{s.destination}</TableCell>
                  <TableCell className="font-mono text-xs">{s.cn ?? "—"}</TableCell>
                  <TableCell>Rs {s.codAmount.toLocaleString()}</TableCell>
                  <TableCell>Rs {s.shippingCharges.toLocaleString()}</TableCell>
                  <TableCell><Badge variant={STATUS_COLORS[s.status] ?? "outline"}>{s.status}</Badge></TableCell>
                  <TableCell className="text-sm">{new Date(s.createdAt).toLocaleDateString("en-PK", { timeZone: "Asia/Karachi", day: "2-digit", month: "short", year: "numeric" })}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => { setSelectedShipment(s); setUpdateCn(s.cn ?? ""); setUpdateStatus(s.status); }}>Update</Button>
                  </TableCell>
                </TableRow>
              ))}
              {!shipments?.length && <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No shipments found</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>Book Shipment</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Courier *</Label>
              <Select value={form.courierId} onValueChange={v => setForm(f => ({ ...f, courierId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select courier" /></SelectTrigger>
                <SelectContent>{couriers?.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Destination *</Label><Input value={form.destination} onChange={e => setForm(f => ({ ...f, destination: e.target.value }))} placeholder="City, full address" /></div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Pieces</Label><Input type="number" value={form.pieces} onChange={e => setForm(f => ({ ...f, pieces: e.target.value }))} /></div>
              <div><Label>COD Amount</Label><Input type="number" value={form.codAmount} onChange={e => setForm(f => ({ ...f, codAmount: e.target.value }))} /></div>
              <div><Label>Shipping Charges</Label><Input type="number" value={form.shippingCharges} onChange={e => setForm(f => ({ ...f, shippingCharges: e.target.value }))} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate({ courierId: parseInt(form.courierId), destination: form.destination, pieces: parseInt(form.pieces), codAmount: parseFloat(form.codAmount), shippingCharges: parseFloat(form.shippingCharges) })} disabled={createMutation.isPending || !form.courierId || !form.destination}>
              {createMutation.isPending ? "Booking..." : "Book Shipment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedShipment} onOpenChange={v => !v && setSelectedShipment(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Update Shipment #{selectedShipment?.id}</DialogTitle></DialogHeader>
          {selectedShipment && (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">Courier: {selectedShipment.courierName} → {selectedShipment.destination}</div>
              <div><Label>CN / Tracking Number</Label><Input value={updateCn} onChange={e => setUpdateCn(e.target.value)} placeholder="e.g. TCS-123456789" /></div>
              <div>
                <Label>Status</Label>
                <Select value={updateStatus} onValueChange={setUpdateStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["pending", "booked", "in_transit", "delivered", "returned", "cancelled"].map(s => <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setSelectedShipment(null)}>Cancel</Button>
                <Button onClick={() => updateMutation.mutate({ id: selectedShipment.id, cn: updateCn || undefined, status: updateStatus })} disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? "Updating..." : "Save"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
