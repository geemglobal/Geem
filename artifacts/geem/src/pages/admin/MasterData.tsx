import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { axiosInstance } from "@/lib/axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Smartphone, Tag, Folder, Truck, Store, CreditCard } from "lucide-react";

interface Brand { id: number; name: string; deviceIdMandatory: boolean; active: boolean; modelsCount: number; }
interface DeviceModel { id: number; brandId: number; brandName: string; name: string; hasImei: boolean; warrantyDays: number; active: boolean; }
interface Category { id: number; name: string; parentId: number | null; active: boolean; }
interface Vendor { id: number; name: string; contactPerson: string | null; phone: string | null; email: string | null; active: boolean; }
interface Courier { id: number; name: string; apiProvider: string | null; trackingUrl: string | null; active: boolean; }
interface PaymentMethod { id: number; name: string; type: string; active: boolean; }

const TABS = [
  { id: "brands", label: "Brands", icon: Smartphone },
  { id: "models", label: "Models", icon: Smartphone },
  { id: "categories", label: "Categories", icon: Folder },
  { id: "vendors", label: "Vendors", icon: Store },
  { id: "couriers", label: "Couriers", icon: Truck },
  { id: "payment-methods", label: "Payment Methods", icon: CreditCard },
];

function SimpleDialog({ open, onClose, title, children, onSave, saving }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; onSave: () => void; saving: boolean }) {
  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="space-y-4">{children}</div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={onSave} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function MasterData() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [tab, setTab] = useState("brands");
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<Record<string, unknown> | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>({});

  const { data: brands } = useQuery({ queryKey: ["brands"], queryFn: () => axiosInstance.get<Brand[]>("/brands").then(r => r.data), enabled: tab === "brands" });
  const { data: models } = useQuery({ queryKey: ["models"], queryFn: () => axiosInstance.get<DeviceModel[]>("/models").then(r => r.data), enabled: tab === "models" });
  const { data: categories } = useQuery({ queryKey: ["categories"], queryFn: () => axiosInstance.get<Category[]>("/categories").then(r => r.data), enabled: tab === "categories" });
  const { data: vendors } = useQuery({ queryKey: ["vendors"], queryFn: () => axiosInstance.get<Vendor[]>("/vendors").then(r => r.data), enabled: tab === "vendors" });
  const { data: couriers } = useQuery({ queryKey: ["couriers"], queryFn: () => axiosInstance.get<Courier[]>("/couriers").then(r => r.data), enabled: tab === "couriers" });
  const { data: paymentMethods } = useQuery({ queryKey: ["payment-methods"], queryFn: () => axiosInstance.get<PaymentMethod[]>("/payment-methods").then(r => r.data), enabled: tab === "payment-methods" });

  const endpoints: Record<string, string> = { brands: "/brands", models: "/models", categories: "/categories", vendors: "/vendors", couriers: "/couriers", "payment-methods": "/payment-methods" };

  const saveMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => {
      const ep = endpoints[tab];
      return editItem
        ? axiosInstance.patch(`${ep}/${editItem.id}`, payload).then(r => r.data)
        : axiosInstance.post(ep, payload).then(r => r.data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [tab === "payment-methods" ? "payment-methods" : tab] });
      setShowForm(false);
      setEditItem(null);
      setForm({});
      toast({ title: "Saved successfully" });
    },
    onError: () => toast({ title: "Error saving", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => axiosInstance.delete(`${endpoints[tab]}/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: [tab === "payment-methods" ? "payment-methods" : tab] }); toast({ title: "Deleted" }); },
  });

  function openNew() { setEditItem(null); setForm({ active: true }); setShowForm(true); }
  function openEdit(item: Record<string, unknown>) { setEditItem(item); setForm({ ...item }); setShowForm(true); }

  function renderForm() {
    const f = (key: string, label: string, type: "text" | "number" | "select" = "text", options?: string[]) => (
      <div key={key}>
        <Label>{label}</Label>
        {type === "select" && options ? (
          <Select value={String(form[key] ?? "")} onValueChange={v => setForm(p => ({ ...p, [key]: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{options.map(o => <SelectItem key={o} value={o} className="capitalize">{o}</SelectItem>)}</SelectContent>
          </Select>
        ) : (
          <Input type={type} value={String(form[key] ?? "")} onChange={e => setForm(p => ({ ...p, [key]: type === "number" ? parseInt(e.target.value) || 0 : e.target.value }))} />
        )}
      </div>
    );

    if (tab === "brands") return <>{f("name", "Brand Name *")}<div><Label>Device ID Mandatory</Label><div className="mt-1"><Switch checked={!!form.deviceIdMandatory} onCheckedChange={v => setForm(p => ({ ...p, deviceIdMandatory: v }))} /></div></div></>;
    if (tab === "models") return <>
      <div>
        <Label>Brand *</Label>
        <SearchableSelect
          value={String(form.brandId ?? "")}
          onValueChange={v => setForm(p => ({ ...p, brandId: parseInt(v) }))}
          options={brands?.map(b => ({ value: String(b.id), label: b.name })) ?? []}
          placeholder="Select brand"
          searchPlaceholder="Search brand…"
        />
      </div>
      {f("name", "Model Name *")}
      {f("warrantyDays", "Warranty Days", "number")}
      <div className="flex gap-4">
        <div><Label>Has IMEI</Label><div className="mt-1"><Switch checked={form.hasImei !== false} onCheckedChange={v => setForm(p => ({ ...p, hasImei: v }))} /></div></div>
      </div>
    </>;
    if (tab === "categories") return <>{f("name", "Category Name *")}</>;
    if (tab === "vendors") return <>{f("name", "Vendor Name *")}{f("contactPerson", "Contact Person")}{f("phone", "Phone")}{f("email", "Email")}</>;
    if (tab === "couriers") return <>{f("name", "Courier Name *")}{f("apiProvider", "API Provider (e.g. leopards, tcs, mnp)")}{f("trackingUrl", "Tracking URL (use {cn} placeholder, e.g. https://leopardscourier.com/track?id={cn})")}</>;
    if (tab === "payment-methods") return <>{f("name", "Name *")}{f("type", "Type *", "select", ["cash", "mobile_wallet", "bank", "card", "cheque"])}{f("accountDetails", "Account Details")}</>;
    return null;
  }

  function renderTable() {
    if (tab === "brands") return (
      <Table>
        <TableHeader><TableRow><TableHead>Brand</TableHead><TableHead>Device ID Mandatory</TableHead><TableHead>Models</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
        <TableBody>
          {brands?.map(b => (
            <TableRow key={b.id}>
              <TableCell className="font-medium">{b.name}</TableCell>
              <TableCell>{b.deviceIdMandatory ? "Yes" : "No"}</TableCell>
              <TableCell>{b.modelsCount}</TableCell>
              <TableCell><Badge variant={b.active ? "default" : "secondary"}>{b.active ? "Active" : "Inactive"}</Badge></TableCell>
              <TableCell className="text-right space-x-1">
                <Button size="sm" variant="outline" onClick={() => openEdit(b as unknown as Record<string, unknown>)}><Pencil className="h-3 w-3" /></Button>
                <Button size="sm" variant="ghost" onClick={() => deleteMutation.mutate(b.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
    if (tab === "models") return (
      <Table>
        <TableHeader><TableRow><TableHead>Model</TableHead><TableHead>Brand</TableHead><TableHead>Warranty</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
        <TableBody>
          {models?.map(m => (
            <TableRow key={m.id}>
              <TableCell className="font-medium">{m.name}</TableCell>
              <TableCell>{m.brandName}</TableCell>
              <TableCell>{m.warrantyDays} days</TableCell>
              <TableCell><Badge variant={m.active ? "default" : "secondary"}>{m.active ? "Active" : "Inactive"}</Badge></TableCell>
              <TableCell className="text-right space-x-1">
                <Button size="sm" variant="outline" onClick={() => openEdit(m as unknown as Record<string, unknown>)}><Pencil className="h-3 w-3" /></Button>
                <Button size="sm" variant="ghost" onClick={() => deleteMutation.mutate(m.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
    if (tab === "categories") return (
      <Table>
        <TableHeader><TableRow><TableHead>Category</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
        <TableBody>
          {categories?.map(c => (
            <TableRow key={c.id}>
              <TableCell className="font-medium">{c.name}</TableCell>
              <TableCell><Badge variant={c.active ? "default" : "secondary"}>{c.active ? "Active" : "Inactive"}</Badge></TableCell>
              <TableCell className="text-right space-x-1">
                <Button size="sm" variant="outline" onClick={() => openEdit(c as unknown as Record<string, unknown>)}><Pencil className="h-3 w-3" /></Button>
                <Button size="sm" variant="ghost" onClick={() => deleteMutation.mutate(c.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
    if (tab === "vendors") return (
      <Table>
        <TableHeader><TableRow><TableHead>Vendor</TableHead><TableHead>Contact</TableHead><TableHead>Phone</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
        <TableBody>
          {vendors?.map(v => (
            <TableRow key={v.id}>
              <TableCell className="font-medium">{v.name}</TableCell>
              <TableCell>{v.contactPerson ?? "—"}</TableCell>
              <TableCell>{v.phone ?? "—"}</TableCell>
              <TableCell><Badge variant={v.active ? "default" : "secondary"}>{v.active ? "Active" : "Inactive"}</Badge></TableCell>
              <TableCell className="text-right space-x-1">
                <Button size="sm" variant="outline" onClick={() => openEdit(v as unknown as Record<string, unknown>)}><Pencil className="h-3 w-3" /></Button>
                <Button size="sm" variant="ghost" onClick={() => deleteMutation.mutate(v.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
    if (tab === "couriers") return (
      <Table>
        <TableHeader><TableRow><TableHead>Courier</TableHead><TableHead>API Provider</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
        <TableBody>
          {couriers?.map(c => (
            <TableRow key={c.id}>
              <TableCell className="font-medium">{c.name}</TableCell>
              <TableCell>{c.apiProvider ?? "—"}</TableCell>
              <TableCell><Badge variant={c.active ? "default" : "secondary"}>{c.active ? "Active" : "Inactive"}</Badge></TableCell>
              <TableCell className="text-right space-x-1">
                <Button size="sm" variant="outline" onClick={() => openEdit(c as unknown as Record<string, unknown>)}><Pencil className="h-3 w-3" /></Button>
                <Button size="sm" variant="ghost" onClick={() => deleteMutation.mutate(c.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
    if (tab === "payment-methods") return (
      <Table>
        <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Type</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
        <TableBody>
          {paymentMethods?.map(pm => (
            <TableRow key={pm.id}>
              <TableCell className="font-medium">{pm.name}</TableCell>
              <TableCell className="capitalize">{pm.type.replace("_", " ")}</TableCell>
              <TableCell><Badge variant={pm.active ? "default" : "secondary"}>{pm.active ? "Active" : "Inactive"}</Badge></TableCell>
              <TableCell className="text-right space-x-1">
                <Button size="sm" variant="outline" onClick={() => openEdit(pm as unknown as Record<string, unknown>)}><Pencil className="h-3 w-3" /></Button>
                <Button size="sm" variant="ghost" onClick={() => deleteMutation.mutate(pm.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
    return null;
  }

  const currentTab = TABS.find(t => t.id === tab);

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">Master Data</h1><p className="text-muted-foreground">Manage core reference data</p></div>

      <div className="flex gap-2 flex-wrap">
        {TABS.map(t => (
          <Button key={t.id} variant={tab === t.id ? "default" : "outline"} size="sm" onClick={() => setTab(t.id)}>
            <t.icon className="h-4 w-4 mr-2" />{t.label}
          </Button>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{currentTab?.label}</CardTitle>
          <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-2" />Add {currentTab?.label.slice(0, -1)}</Button>
        </CardHeader>
        <CardContent>{renderTable()}</CardContent>
      </Card>

      <SimpleDialog
        open={showForm}
        onClose={() => { setShowForm(false); setEditItem(null); setForm({}); }}
        title={editItem ? `Edit ${currentTab?.label.slice(0, -1)}` : `New ${currentTab?.label.slice(0, -1)}`}
        onSave={() => saveMutation.mutate(form)}
        saving={saveMutation.isPending}
      >
        {renderForm()}
      </SimpleDialog>
    </div>
  );
}
