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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, Wrench } from "lucide-react";

interface ServiceTicket { id: number; ticketNumber: string; status: string; customerId: number; customerName: string; issueDescription: string; resolutionNotes: string | null; warrantyValid: boolean; imei: string | null; productName: string | null; createdAt: string; }
interface Customer { id: number; name: string; mobile: string; }

const STATUS_COLORS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  received: "outline", diagnosing: "secondary", repairing: "secondary", resolved: "default", closed: "secondary", cancelled: "destructive",
};
const STATUS_OPTIONS = ["received", "diagnosing", "repairing", "resolved", "closed", "cancelled"];

export default function ServiceTickets() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<ServiceTicket | null>(null);
  const [filterStatus, setFilterStatus] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [form, setForm] = useState({ issueDescription: "", imei: "", productName: "" });
  const [resolution, setResolution] = useState("");
  const [updateStatus, setUpdateStatus] = useState("");

  const { data: tickets, isLoading } = useQuery({
    queryKey: ["service-tickets", filterStatus],
    queryFn: () => axiosInstance.get<ServiceTicket[]>(`/service-tickets?status=${filterStatus}`).then(r => r.data),
  });

  const { data: customers } = useQuery({
    queryKey: ["customers-svc", customerSearch],
    queryFn: () => axiosInstance.get<{ customers: Customer[] }>(`/customers?search=${customerSearch}`).then(r => r.data),
    enabled: customerSearch.length >= 2,
  });

  const createMutation = useMutation({
    mutationFn: (payload: object) => axiosInstance.post("/service-tickets", payload).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["service-tickets"] }); setShowForm(false); toast({ title: "Service ticket created" }); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...updates }: { id: number; [k: string]: unknown }) => axiosInstance.patch(`/service-tickets/${id}`, updates).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["service-tickets"] }); setSelectedTicket(null); toast({ title: "Ticket updated" }); },
  });

  const filtered = tickets?.filter(t => !filterStatus || t.status === filterStatus);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold flex items-center gap-2"><Wrench className="h-6 w-6" />Service Tickets</h1><p className="text-muted-foreground">Manage warranty and repair tickets</p></div>
        <Button onClick={() => { setShowForm(true); setSelectedCustomer(null); setForm({ issueDescription: "", imei: "", productName: "" }); }}><Plus className="h-4 w-4 mr-2" />New Ticket</Button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {["", ...STATUS_OPTIONS].map(s => (
          <Button key={s} variant={filterStatus === s ? "default" : "outline"} size="sm" onClick={() => setFilterStatus(s)} className="capitalize">{s || "All"}</Button>
        ))}
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? <p className="text-center py-10 text-muted-foreground">Loading...</p> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ticket #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Issue</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered?.map(t => (
                  <TableRow key={t.id}>
                    <TableCell className="font-mono font-medium">{t.ticketNumber}</TableCell>
                    <TableCell>{t.customerName}</TableCell>
                    <TableCell className="max-w-xs truncate">{t.issueDescription}</TableCell>
                    <TableCell><Badge variant={STATUS_COLORS[t.status] ?? "outline"}>{t.status}</Badge></TableCell>
                    <TableCell className="text-sm">{new Date(t.createdAt).toLocaleDateString("en-PK", { timeZone: "Asia/Karachi", day: "2-digit", month: "short", year: "numeric" })}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => { setSelectedTicket(t); setUpdateStatus(t.status); setResolution(t.resolutionNotes ?? ""); }}>Update</Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!filtered?.length && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No tickets found</TableCell></TableRow>}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* New Ticket */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Service Ticket</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Customer *</Label>
              {selectedCustomer ? (
                <div className="flex justify-between items-center p-2 bg-accent rounded mt-1">
                  <span>{selectedCustomer.name}</span>
                  <Button size="sm" variant="ghost" onClick={() => setSelectedCustomer(null)}>Change</Button>
                </div>
              ) : (
                <>
                  <Input value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} placeholder="Search customer..." className="mt-1" />
                  {customers?.customers && customerSearch.length >= 2 && (
                    <div className="border rounded divide-y mt-1">
                      {customers.customers.map(c => (
                        <div key={c.id} className="p-2 hover:bg-accent cursor-pointer text-sm" onClick={() => { setSelectedCustomer(c); setCustomerSearch(""); }}>{c.name} — {c.mobile}</div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
            <div><Label>Product IMEI</Label><Input value={form.imei} onChange={e => setForm(f => ({ ...f, imei: e.target.value }))} placeholder="Optional" /></div>
            <div><Label>Product Name</Label><Input value={form.productName} onChange={e => setForm(f => ({ ...f, productName: e.target.value }))} placeholder="e.g. Samsung Galaxy A55" /></div>
            <div><Label>Issue Description *</Label><Textarea value={form.issueDescription} onChange={e => setForm(f => ({ ...f, issueDescription: e.target.value }))} rows={3} placeholder="Describe the issue..." /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate({ customerId: selectedCustomer?.id, ...form })} disabled={createMutation.isPending || !selectedCustomer || !form.issueDescription}>
              {createMutation.isPending ? "Creating..." : "Create Ticket"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Update Ticket */}
      <Dialog open={!!selectedTicket} onOpenChange={v => !v && setSelectedTicket(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Update {selectedTicket?.ticketNumber}</DialogTitle></DialogHeader>
          {selectedTicket && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded text-sm"><p className="font-medium">{selectedTicket.customerName}</p><p className="mt-1 text-muted-foreground">{selectedTicket.issueDescription}</p></div>
              <div>
                <Label>Status</Label>
                <Select value={updateStatus} onValueChange={setUpdateStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUS_OPTIONS.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Resolution Notes</Label><Textarea value={resolution} onChange={e => setResolution(e.target.value)} rows={3} placeholder="What was done to resolve..." /></div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setSelectedTicket(null)}>Cancel</Button>
                <Button onClick={() => updateMutation.mutate({ id: selectedTicket.id, status: updateStatus, resolutionNotes: resolution })} disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? "Updating..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
