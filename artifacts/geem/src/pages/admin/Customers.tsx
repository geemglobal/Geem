import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { axiosInstance } from "@/lib/axios";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Pencil, Trash2, Download, BookOpen, Building2, User, Shield, Globe, ExternalLink, Mail, Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PAKISTAN_CITIES } from "@/data/pakistan-cities";

interface Customer {
  id: number;
  name: string;
  mobile: string;
  phone: string | null;
  type: string;
  email: string | null;
  cnic: string | null;
  vehicleNumber: string | null;
  city: string | null;
  country: string | null;
  address: string | null;
  notes: string | null;
  ledgerBalance: number;
  walletBalance: number;
  active: boolean;
  createdAt: string;
}

const CUSTOMER_TYPES = [
  { value: "individual",  label: "Individual",      icon: User,      color: "bg-blue-100 text-blue-800" },
  { value: "corporate",   label: "Corporate",       icon: Building2, color: "bg-purple-100 text-purple-800" },
  { value: "government",  label: "Government",      icon: Shield,    color: "bg-green-100 text-green-800" },
  { value: "agency",      label: "Agency / Intel",  icon: Shield,    color: "bg-red-100 text-red-800" },
  { value: "foreign",     label: "Foreign / Embassy", icon: Globe,   color: "bg-orange-100 text-orange-800" },
  { value: "ngo",         label: "NGO / Charity",   icon: User,      color: "bg-cyan-100 text-cyan-800" },
];

const emptyForm = {
  name: "", mobile: "", phone: "", type: "individual", email: "",
  cnic: "", vehicleNumber: "", city: "", country: "Pakistan", address: "", notes: "", active: true,
};

function TypeBadge({ type }: { type: string }) {
  const t = CUSTOMER_TYPES.find(x => x.value === type);
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${t?.color ?? "bg-gray-100 text-gray-700"}`}>
      {t?.label ?? type}
    </span>
  );
}

function exportCSV(customers: Customer[]) {
  const headers = ["Name","Mobile","Phone","Type","Email","CNIC","Asset/Plate No","City","Address","Balance","Status","Created"];
  const rows = customers.map(c => [
    c.name, c.mobile, c.phone ?? "", c.type, c.email ?? "", c.cnic ?? "",
    c.vehicleNumber ?? "", c.city ?? "", c.address ?? "",
    c.ledgerBalance, c.active ? "Active" : "Inactive", c.createdAt.split("T")[0],
  ]);
  const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = `customers-${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
}

export default function Customers() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [emailTarget, setEmailTarget] = useState<Customer | null>(null);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const [emailSending, setEmailSending] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["customers", search, page, filterType],
    queryFn: () => {
      const params = new URLSearchParams({ search, page: String(page), limit: "50" });
      return axiosInstance.get<{ customers: Customer[]; total: number }>(`/customers?${params}`).then(r => r.data);
    },
  });

  const customers = data?.customers ?? [];
  const filtered = filterType === "all" ? customers : customers.filter(c => c.type === filterType);

  const saveMutation = useMutation({
    mutationFn: (payload: typeof emptyForm) =>
      editCustomer
        ? axiosInstance.patch(`/customers/${editCustomer.id}`, payload).then(r => r.data)
        : axiosInstance.post("/customers", payload).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      setShowForm(false);
      setEditCustomer(null);
      setForm(emptyForm);
      toast({ title: editCustomer ? "Customer updated" : "Customer created" });
    },
    onError: () => toast({ title: "Error saving customer", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => axiosInstance.delete(`/customers/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      toast({ title: "Customer deleted" });
      setDeleteId(null);
      setConfirmText("");
    },
  });

  function openNew() {
    setEditCustomer(null);
    setForm(emptyForm);
    setShowForm(true);
  }
  async function sendCustomerEmail() {
    if (!emailTarget) return;
    setEmailSending(true);
    try {
      const r = await axiosInstance.post(`/customers/${emailTarget.id}/email`, { subject: emailSubject, message: emailMessage });
      toast({ title: "Email sent", description: `Delivered to ${r.data.sentTo}` });
      setEmailTarget(null);
      setEmailSubject("");
      setEmailMessage("");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Failed to send email";
      toast({ title: "Email failed", description: msg, variant: "destructive" });
    } finally {
      setEmailSending(false);
    }
  }

  function openEdit(c: Customer) {
    setEditCustomer(c);
    setForm({
      name: c.name, mobile: c.mobile, phone: c.phone ?? "", type: c.type ?? "individual",
      email: c.email ?? "", cnic: c.cnic ?? "", vehicleNumber: c.vehicleNumber ?? "",
      city: c.city ?? "", country: c.country ?? "Pakistan", address: c.address ?? "",
      notes: c.notes ?? "", active: c.active,
    });
    setShowForm(true);
  }

  const deleteTarget = customers.find(c => c.id === deleteId);

  // Summary counts
  const typeCounts = CUSTOMER_TYPES.map(t => ({
    ...t,
    count: customers.filter(c => c.type === t.value).length,
  }));

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Customers</h1>
          <p className="text-muted-foreground text-sm">Manage clients, agencies &amp; government contacts</p>
        </div>
        <div className="flex gap-2">
          {customers.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => exportCSV(customers)}>
              <Download className="h-4 w-4 mr-1.5" />Export CSV
            </Button>
          )}
          <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1.5" />Add Customer</Button>
        </div>
      </div>

      {/* Type filter pills */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilterType("all")}
          className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${filterType === "all" ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
        >
          All ({customers.length})
        </button>
        {typeCounts.filter(t => t.count > 0).map(t => (
          <button
            key={t.value}
            onClick={() => setFilterType(t.value)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${filterType === t.value ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
          >
            {t.label} ({t.count})
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-3 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, mobile, address…"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                className="pl-9"
              />
            </div>
          </div>

          {isLoading ? (
            <p className="text-center py-10 text-muted-foreground">Loading...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Mobile</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>CNIC</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead>Ledger</TableHead>
                  <TableHead>Wallet</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(c => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">
                      <button onClick={() => setLocation(`/customers/${c.id}`)} className="hover:underline text-left flex items-center gap-1 group">
                        {c.name}
                        <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    </TableCell>
                    <TableCell>
                      <div>{c.mobile}</div>
                      {c.phone && <div className="text-xs text-muted-foreground">{c.phone}</div>}
                    </TableCell>
                    <TableCell><TypeBadge type={c.type} /></TableCell>
                    <TableCell className="font-mono text-xs">{c.cnic ?? "—"}</TableCell>
                    <TableCell>{c.city ?? "—"}</TableCell>
                    <TableCell className={c.ledgerBalance !== 0 ? "font-semibold text-destructive" : ""}>
                      Rs {Number(c.ledgerBalance).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {Number(c.walletBalance) > 0 ? (
                        <span className="inline-flex items-center gap-1 text-sm font-semibold text-green-700">
                          Rs {Number(c.walletBalance).toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={c.active ? "default" : "secondary"}>{c.active ? "Active" : "Inactive"}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="outline" size="sm" onClick={() => setLocation(`/customers/${c.id}/ledger`)}>
                          <BookOpen className="h-3.5 w-3.5 mr-1" />Ledger
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => openEdit(c)}>
                          <Pencil className="h-3.5 w-3.5 mr-1" />Edit
                        </Button>
                        {c.email && (
                          <Button variant="outline" size="sm" title={`Email ${c.email}`}
                            onClick={() => { setEmailTarget(c); setEmailSubject(""); setEmailMessage(""); }}>
                            <Mail className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive"
                          onClick={() => { setDeleteId(c.id); setConfirmText(""); }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No customers found</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}

          {(data?.total ?? 0) > 50 && (
            <div className="flex justify-center gap-2 mt-4">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Prev</Button>
              <span className="text-sm text-muted-foreground self-center">Page {page}</span>
              <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={showForm} onOpenChange={v => { setShowForm(v); if (!v) setEditCustomer(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editCustomer ? "Edit Customer" : "New Customer"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="col-span-2">
              <Label className="text-xs">Full Name *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Full name" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Mobile * <span className="text-muted-foreground">(primary)</span></Label>
              <Input value={form.mobile} onChange={e => setForm(f => ({ ...f, mobile: e.target.value }))} placeholder="0300-1234567" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Phone <span className="text-muted-foreground">(secondary / office)</span></Label>
              <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="021-1234567" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Customer Type *</Label>
              <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CUSTOMER_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Email</Label>
              <Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="email@example.com" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">CNIC / NTN</Label>
              <Input value={form.cnic} onChange={e => setForm(f => ({ ...f, cnic: e.target.value }))} placeholder="12345-1234567-1" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Asset / Vehicle / Plate No</Label>
              <Input value={form.vehicleNumber} onChange={e => setForm(f => ({ ...f, vehicleNumber: e.target.value }))} placeholder="ABC-123 or serial" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">City</Label>
              <Select value={form.city || "none"} onValueChange={v => setForm(f => ({ ...f, city: v === "none" ? "" : v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select city" /></SelectTrigger>
                <SelectContent className="max-h-64">
                  <SelectItem value="none">Select city…</SelectItem>
                  {PAKISTAN_CITIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Country</Label>
              <Input value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} placeholder="Pakistan" className="mt-1" />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Address</Label>
              <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Street address" className="mt-1" />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Notes</Label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Internal notes, special requirements…" rows={2} className="mt-1" />
            </div>
            {editCustomer && (
              <div className="col-span-2">
                <Label className="text-xs">Status</Label>
                <Select value={form.active ? "active" : "inactive"} onValueChange={v => setForm(f => ({ ...f, active: v === "active" }))}>
                  <SelectTrigger className="mt-1 w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending || !form.name || !form.mobile}>
              {saveMutation.isPending ? "Saving…" : "Save Customer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Email Compose Dialog */}
      <Dialog open={emailTarget !== null} onOpenChange={v => { if (!v) setEmailTarget(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-blue-600" />
              Email to {emailTarget?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-xs text-muted-foreground">Sending to: <strong>{emailTarget?.email}</strong></p>
            <div>
              <Label className="text-xs">Subject</Label>
              <Input value={emailSubject} onChange={e => setEmailSubject(e.target.value)} placeholder="Subject…" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Message</Label>
              <Textarea value={emailMessage} onChange={e => setEmailMessage(e.target.value)} placeholder="Type your message…" rows={6} className="mt-1 resize-none" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailTarget(null)}>Cancel</Button>
            <Button onClick={sendCustomerEmail} disabled={emailSending || !emailSubject || !emailMessage}>
              {emailSending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Sending…</> : <><Mail className="h-4 w-4 mr-2" />Send Email</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={deleteId !== null} onOpenChange={v => { if (!v) { setDeleteId(null); setConfirmText(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-destructive">Delete Customer</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              You are about to permanently delete <strong>{deleteTarget?.name}</strong>. This cannot be undone.
            </p>
            <div>
              <Label className="text-sm">Type <span className="font-mono bg-muted px-1 rounded">DELETE</span> to confirm</Label>
              <Input value={confirmText} onChange={e => setConfirmText(e.target.value)} placeholder="DELETE" className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteId(null); setConfirmText(""); }}>Cancel</Button>
            <Button variant="destructive" disabled={confirmText !== "DELETE" || deleteMutation.isPending}
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}>
              {deleteMutation.isPending ? "Deleting…" : "Delete Customer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
