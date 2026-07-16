import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { axiosInstance } from "@/lib/axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { PAKISTAN_CITIES } from "@/data/pakistan-cities";
import {
  ArrowLeft, Pencil, Save, X, BookOpen, User, Building2, Shield, Globe,
  Phone, Mail, MapPin, CreditCard, Car, StickyNote, CheckCircle2,
  AlertCircle, Calendar, BadgeDollarSign, Wallet, Plus, TrendingUp, TrendingDown,
} from "lucide-react";
import { formatPakDateTime } from "@/lib/format";

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

interface WalletTx {
  id: number;
  type: "credit" | "debit";
  amount: number;
  balanceAfter: number;
  description: string;
  reference: string | null;
  createdAt: string;
}

interface WalletData {
  balance: number;
  transactions: WalletTx[];
}

const CUSTOMER_TYPES = [
  { value: "individual",  label: "Individual",        icon: User,      color: "bg-blue-100 text-blue-800 border-blue-200" },
  { value: "corporate",   label: "Corporate",         icon: Building2, color: "bg-purple-100 text-purple-800 border-purple-200" },
  { value: "government",  label: "Government",        icon: Shield,    color: "bg-green-100 text-green-800 border-green-200" },
  { value: "agency",      label: "Agency / Intel",    icon: Shield,    color: "bg-red-100 text-red-800 border-red-200" },
  { value: "foreign",     label: "Foreign / Embassy", icon: Globe,     color: "bg-orange-100 text-orange-800 border-orange-200" },
  { value: "ngo",         label: "NGO / Charity",     icon: User,      color: "bg-cyan-100 text-cyan-800 border-cyan-200" },
];

function TypeBadge({ type }: { type: string }) {
  const t = CUSTOMER_TYPES.find(x => x.value === type);
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium border ${t?.color ?? "bg-gray-100 text-gray-700 border-gray-200"}`}>
      {t?.label ?? type}
    </span>
  );
}

function SectionHeader({ icon, title, onEdit }: { icon: React.ReactNode; title: string; onEdit?: () => void }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
        {icon} {title}
      </h2>
      {onEdit && (
        <button onClick={onEdit} className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors">
          <Pencil className="h-3 w-3" /> Edit
        </button>
      )}
    </div>
  );
}

function InfoRow({ label, value, href, type }: { label: string; value?: string | null; href?: string; type?: "tel" | "email" }) {
  return (
    <div className="py-2.5 border-b last:border-0">
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      {value ? (
        href ? (
          <a href={href} className="text-sm text-blue-600 hover:underline">{value}</a>
        ) : (
          <p className="text-sm font-medium text-foreground">{value}</p>
        )
      ) : (
        <p className="text-sm text-muted-foreground italic">Not set</p>
      )}
    </div>
  );
}

export default function CustomerDetail() {
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const id = Number(location.match(/\/customers\/(\d+)/)?.[1]);

  // Which section is being edited: null | "contact" | "identity" | "address" | "notes"
  const [editSection, setEditSection] = useState<"contact" | "identity" | "address" | "notes" | null>(null);
  const [form, setForm] = useState<Omit<Customer, "id" | "ledgerBalance" | "walletBalance" | "createdAt"> | null>(null);

  const [creditDialog, setCreditDialog] = useState(false);
  const [creditAmount, setCreditAmount] = useState("");
  const [creditDesc, setCreditDesc] = useState("");
  const [creditRef, setCreditRef] = useState("");

  const { data: customer, isLoading, isError } = useQuery<Customer>({
    queryKey: ["customer", id],
    queryFn: () => axiosInstance.get<Customer>(`/customers/${id}`).then(r => r.data),
    enabled: !!id,
  });

  const { data: walletData, refetch: refetchWallet } = useQuery<WalletData>({
    queryKey: ["customer-wallet", id],
    queryFn: () => axiosInstance.get<WalletData>(`/customers/${id}/wallet`).then(r => r.data),
    enabled: !!id,
  });

  const saveMutation = useMutation({
    mutationFn: (data: typeof form) => axiosInstance.patch<Customer>(`/customers/${id}`, data).then(r => r.data),
    onSuccess: (updated) => {
      qc.setQueryData(["customer", id], updated);
      qc.invalidateQueries({ queryKey: ["customers"] });
      setEditSection(null);
      setForm(null);
      toast({ title: "Saved successfully" });
    },
    onError: () => toast({ title: "Failed to save", variant: "destructive" }),
  });

  const creditMutation = useMutation({
    mutationFn: () => axiosInstance.post(`/customers/${id}/wallet/credit`, {
      amount: parseFloat(creditAmount),
      description: creditDesc,
      reference: creditRef || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customer", id] });
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["wallet-overview"] });
      refetchWallet();
      setCreditDialog(false);
      setCreditAmount(""); setCreditDesc(""); setCreditRef("");
      toast({ title: "Wallet credited successfully" });
    },
    onError: () => toast({ title: "Failed to credit wallet", variant: "destructive" }),
  });

  function startEdit(section: typeof editSection) {
    if (!customer) return;
    setForm({
      name: customer.name,
      mobile: customer.mobile,
      phone: customer.phone ?? "",
      type: customer.type,
      email: customer.email ?? "",
      cnic: customer.cnic ?? "",
      vehicleNumber: customer.vehicleNumber ?? "",
      city: customer.city ?? "",
      country: customer.country ?? "Pakistan",
      address: customer.address ?? "",
      notes: customer.notes ?? "",
      active: customer.active,
    });
    setEditSection(section);
  }

  function cancelEdit() { setEditSection(null); setForm(null); }

  function f(field: keyof NonNullable<typeof form>) {
    return (form as Record<string, unknown>)?.[field as string] as string ?? "";
  }
  function set(field: keyof NonNullable<typeof form>, value: string | boolean) {
    setForm(prev => prev ? { ...prev, [field]: value } : prev);
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 w-48 bg-muted rounded animate-pulse" />
        <div className="h-32 bg-muted rounded animate-pulse" />
        <div className="h-64 bg-muted rounded animate-pulse" />
      </div>
    );
  }

  if (isError || !customer) {
    return (
      <div className="p-6 flex flex-col items-center gap-4 py-20 text-muted-foreground">
        <AlertCircle className="h-10 w-10" />
        <p className="font-medium">Customer not found</p>
        <Button variant="outline" onClick={() => navigate("/customers")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Customers
        </Button>
      </div>
    );
  }

  const initials = customer.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const ledger = Number(customer.ledgerBalance);
  const walletBal = walletData?.balance ?? Number(customer.walletBalance ?? 0);
  const ledgerColor = ledger > 0 ? "text-red-600" : ledger < 0 ? "text-green-600" : "text-muted-foreground";
  const typeInfo = CUSTOMER_TYPES.find(t => t.value === customer.type);

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Button variant="ghost" size="sm" onClick={() => navigate("/customers")} className="h-7 px-2">
          <ArrowLeft className="h-4 w-4 mr-1" /> Customers
        </Button>
        <span className="text-muted-foreground">/</span>
        <span className="font-medium truncate">{customer.name}</span>
      </div>

      {/* ── Profile header card ── */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="h-1.5 bg-primary" />
        <div className="p-5 flex flex-col sm:flex-row items-start gap-4">

          {/* Avatar */}
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-2xl shrink-0">
            {initials}
          </div>

          {/* Name / type / city */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <h1 className="text-2xl font-bold">{customer.name}</h1>
              <Badge variant={customer.active ? "default" : "secondary"} className="text-xs">
                {customer.active ? "Active" : "Inactive"}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <TypeBadge type={customer.type} />
              {customer.mobile && (
                <a href={`tel:${customer.mobile}`} className="hover:text-foreground flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5" />{customer.mobile}
                </a>
              )}
              {customer.city && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />{customer.city}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                Since {new Date(customer.createdAt).toLocaleDateString("en-PK", { timeZone: "Asia/Karachi", year: "numeric", month: "long" })}
              </span>
            </div>
          </div>

          {/* Balance badges */}
          <div className="flex flex-col sm:items-end gap-3 shrink-0">
            <div className="flex gap-3">
              {/* Ledger balance */}
              <div className="text-center bg-muted/50 rounded-lg px-4 py-2.5 min-w-[110px]">
                <p className="text-xs text-muted-foreground mb-0.5">Ledger Balance</p>
                <p className={`text-xl font-bold ${ledgerColor}`}>Rs {Math.abs(ledger).toLocaleString()}</p>
                {ledger !== 0 && <p className="text-xs text-muted-foreground">{ledger > 0 ? "Receivable" : "Payable"}</p>}
              </div>
              {/* Wallet balance — always visible */}
              <div className="text-center bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2.5 min-w-[110px]">
                <p className="text-xs text-emerald-700 mb-0.5 flex items-center justify-center gap-1">
                  <Wallet className="h-3 w-3" /> Wallet
                </p>
                <p className="text-xl font-bold text-emerald-700">Rs {walletBal.toLocaleString()}</p>
                <p className="text-xs text-emerald-600">Available</p>
              </div>
            </div>
            {/* Quick actions */}
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => navigate(`/customers/${id}/ledger`)}>
                <BookOpen className="h-3.5 w-3.5 mr-1.5" /> Ledger
              </Button>
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => setCreditDialog(true)}>
                <Plus className="h-3.5 w-3.5 mr-1.5" /> Credit Wallet
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Contact Information */}
        <div className="rounded-xl border bg-card shadow-sm p-5">
          <SectionHeader
            icon={<Phone className="h-4 w-4 text-primary" />}
            title="Contact Information"
            onEdit={() => startEdit("contact")}
          />

          {editSection === "contact" ? (
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Full Name *</Label>
                <Input className="mt-1" value={f("name")} onChange={e => set("name", e.target.value)} placeholder="Full name" />
              </div>
              <div>
                <Label className="text-xs">Mobile * <span className="text-muted-foreground">(primary)</span></Label>
                <Input className="mt-1" value={f("mobile")} onChange={e => set("mobile", e.target.value)} placeholder="0300-1234567" />
              </div>
              <div>
                <Label className="text-xs">Phone <span className="text-muted-foreground">(secondary / office)</span></Label>
                <Input className="mt-1" value={f("phone")} onChange={e => set("phone", e.target.value)} placeholder="021-1234567" />
              </div>
              <div>
                <Label className="text-xs">Email</Label>
                <Input className="mt-1" type="email" value={f("email")} onChange={e => set("email", e.target.value)} placeholder="email@example.com" />
              </div>
              <div className="flex gap-2 pt-1">
                <Button size="sm" onClick={() => form && saveMutation.mutate(form)} disabled={saveMutation.isPending || !form?.name || !form?.mobile}>
                  <Save className="h-3.5 w-3.5 mr-1" /> {saveMutation.isPending ? "Saving…" : "Save"}
                </Button>
                <Button size="sm" variant="outline" onClick={cancelEdit}><X className="h-3.5 w-3.5 mr-1" /> Cancel</Button>
              </div>
            </div>
          ) : (
            <div>
              <InfoRow label="Mobile (Primary)" value={customer.mobile} href={`tel:${customer.mobile}`} />
              <InfoRow label="Phone (Secondary)" value={customer.phone} href={customer.phone ? `tel:${customer.phone}` : undefined} />
              <InfoRow label="Email" value={customer.email} href={customer.email ? `mailto:${customer.email}` : undefined} />
            </div>
          )}
        </div>

        {/* Identity & Classification */}
        <div className="rounded-xl border bg-card shadow-sm p-5">
          <SectionHeader
            icon={<CreditCard className="h-4 w-4 text-primary" />}
            title="Identity & Classification"
            onEdit={() => startEdit("identity")}
          />

          {editSection === "identity" ? (
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Customer Type *</Label>
                <Select value={f("type")} onValueChange={v => set("type", v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CUSTOMER_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">CNIC / NTN</Label>
                <Input className="mt-1" value={f("cnic")} onChange={e => set("cnic", e.target.value)} placeholder="12345-1234567-1" />
              </div>
              <div>
                <Label className="text-xs">Asset / Vehicle / Plate No</Label>
                <Input className="mt-1" value={f("vehicleNumber")} onChange={e => set("vehicleNumber", e.target.value)} placeholder="ABC-123 or serial" />
              </div>
              <div>
                <Label className="text-xs">Account Status</Label>
                <Select value={form?.active === true ? "active" : "inactive"} onValueChange={v => set("active", v === "active")}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2 pt-1">
                <Button size="sm" onClick={() => form && saveMutation.mutate(form)} disabled={saveMutation.isPending}>
                  <Save className="h-3.5 w-3.5 mr-1" /> {saveMutation.isPending ? "Saving…" : "Save"}
                </Button>
                <Button size="sm" variant="outline" onClick={cancelEdit}><X className="h-3.5 w-3.5 mr-1" /> Cancel</Button>
              </div>
            </div>
          ) : (
            <div>
              <div className="py-2.5 border-b">
                <p className="text-xs text-muted-foreground mb-1">Customer Type</p>
                <TypeBadge type={customer.type} />
              </div>
              <InfoRow label="CNIC / NTN" value={customer.cnic} />
              <InfoRow label="Asset / Vehicle / Plate No" value={customer.vehicleNumber} />
              <div className="py-2.5">
                <p className="text-xs text-muted-foreground mb-1">Status</p>
                <Badge variant={customer.active ? "default" : "secondary"}>{customer.active ? "Active" : "Inactive"}</Badge>
              </div>
            </div>
          )}
        </div>

        {/* Address & Location */}
        <div className="rounded-xl border bg-card shadow-sm p-5">
          <SectionHeader
            icon={<MapPin className="h-4 w-4 text-primary" />}
            title="Address & Location"
            onEdit={() => startEdit("address")}
          />

          {editSection === "address" ? (
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Street Address</Label>
                <Textarea className="mt-1" rows={3} value={f("address")} onChange={e => set("address", e.target.value)}
                  placeholder="House / Shop / Office no, Street, Area, Tehsil" />
              </div>
              <div>
                <Label className="text-xs">City</Label>
                <Select value={f("city") || "__none__"} onValueChange={v => set("city", v === "__none__" ? "" : v)}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select city…" /></SelectTrigger>
                  <SelectContent className="max-h-60">
                    <SelectItem value="__none__">— Select city —</SelectItem>
                    {PAKISTAN_CITIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Country</Label>
                <Input className="mt-1" value={f("country")} onChange={e => set("country", e.target.value)} placeholder="Pakistan" />
              </div>
              <div className="flex gap-2 pt-1">
                <Button size="sm" onClick={() => form && saveMutation.mutate(form)} disabled={saveMutation.isPending}>
                  <Save className="h-3.5 w-3.5 mr-1" /> {saveMutation.isPending ? "Saving…" : "Save"}
                </Button>
                <Button size="sm" variant="outline" onClick={cancelEdit}><X className="h-3.5 w-3.5 mr-1" /> Cancel</Button>
              </div>
            </div>
          ) : (
            <div>
              {!customer.address && !customer.city && !customer.country ? (
                <div className="flex flex-col items-center gap-3 py-6 text-center">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                    <MapPin className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">No address saved</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Click Edit to add address, city, and country</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => startEdit("address")}>
                    <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Address
                  </Button>
                </div>
              ) : (
                <div>
                  <InfoRow label="Street Address" value={customer.address} />
                  <InfoRow label="City" value={customer.city} />
                  <InfoRow label="Country" value={customer.country} />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="rounded-xl border bg-card shadow-sm p-5">
          <SectionHeader
            icon={<StickyNote className="h-4 w-4 text-primary" />}
            title="Notes"
            onEdit={() => startEdit("notes")}
          />

          {editSection === "notes" ? (
            <div className="space-y-3">
              <Textarea rows={5} value={f("notes")} onChange={e => set("notes", e.target.value)}
                placeholder="Internal notes, special requirements, payment history, preferences…" />
              <div className="flex gap-2">
                <Button size="sm" onClick={() => form && saveMutation.mutate(form)} disabled={saveMutation.isPending}>
                  <Save className="h-3.5 w-3.5 mr-1" /> {saveMutation.isPending ? "Saving…" : "Save"}
                </Button>
                <Button size="sm" variant="outline" onClick={cancelEdit}><X className="h-3.5 w-3.5 mr-1" /> Cancel</Button>
              </div>
            </div>
          ) : (
            customer.notes ? (
              <p className="text-sm text-foreground whitespace-pre-line">{customer.notes}</p>
            ) : (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <StickyNote className="h-7 w-7 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground italic">No notes added</p>
                <Button size="sm" variant="ghost" onClick={() => startEdit("notes")}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add Note
                </Button>
              </div>
            )
          )}
        </div>
      </div>

      {/* ── Financials strip ── */}
      <div className="rounded-xl border bg-card shadow-sm p-5 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
        <div>
          <p className="text-xs text-muted-foreground mb-1 flex items-center justify-center gap-1">
            <BadgeDollarSign className="h-3.5 w-3.5" /> Ledger Balance
          </p>
          <p className={`text-lg font-bold ${ledgerColor}`}>Rs {Math.abs(ledger).toLocaleString()}</p>
          {ledger !== 0 && <p className="text-xs text-muted-foreground">{ledger > 0 ? "Receivable" : "Payable"}</p>}
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1 flex items-center justify-center gap-1">
            <Wallet className="h-3.5 w-3.5 text-emerald-600" /> Wallet Balance
          </p>
          <p className="text-lg font-bold text-emerald-700">Rs {walletBal.toLocaleString()}</p>
          <p className="text-xs text-emerald-600">Available</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1 flex items-center justify-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5" /> Status
          </p>
          <Badge variant={customer.active ? "default" : "secondary"} className="text-xs">
            {customer.active ? "Active" : "Inactive"}
          </Badge>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1 flex items-center justify-center gap-1">
            <Calendar className="h-3.5 w-3.5" /> Member Since
          </p>
          <p className="text-sm font-medium">
            {new Date(customer.createdAt).toLocaleDateString("en-PK", { timeZone: "Asia/Karachi", year: "numeric", month: "short" })}
          </p>
        </div>
      </div>

      {/* ── Wallet section ── */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="p-5 border-b flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
              <Wallet className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">Customer Wallet</h2>
              <p className="text-xs text-muted-foreground">Refund balance — credited on returns, used at checkout</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-emerald-700">Rs {walletBal.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Available balance</p>
          </div>
        </div>

        <div className="p-4 border-b bg-emerald-50/50">
          <Button onClick={() => setCreditDialog(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            <Plus className="h-4 w-4 mr-2" /> Credit Wallet (Return / Refund)
          </Button>
          <p className="text-xs text-muted-foreground mt-2">
            Add funds when a customer returns a product or you owe them a refund. They can use it at next purchase.
          </p>
        </div>

        {/* Transactions */}
        <div>
          <div className="px-5 py-3 border-b bg-muted/30">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Transaction History</p>
          </div>
          {!walletData || walletData.transactions.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Wallet className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No wallet transactions yet</p>
            </div>
          ) : (
            <div className="divide-y">
              {walletData.transactions.map(tx => (
                <div key={tx.id} className="flex items-start gap-3 px-5 py-3.5">
                  <div className={`mt-0.5 w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${tx.type === "credit" ? "bg-emerald-100" : "bg-red-100"}`}>
                    {tx.type === "credit"
                      ? <TrendingUp className="h-4 w-4 text-emerald-600" />
                      : <TrendingDown className="h-4 w-4 text-red-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{tx.description}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${tx.type === "credit" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}>
                        {tx.type === "credit" ? "Credit" : "Debit"}
                      </span>
                      {tx.reference && <span className="text-xs text-muted-foreground font-mono">{tx.reference}</span>}
                      <span className="text-xs text-muted-foreground">
                        {formatPakDateTime(tx.createdAt, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-bold ${tx.type === "credit" ? "text-emerald-600" : "text-red-500"}`}>
                      {tx.type === "credit" ? "+" : "−"}Rs {tx.amount.toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">Bal: Rs {tx.balanceAfter.toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Credit Wallet Dialog ── */}
      <Dialog open={creditDialog} onOpenChange={v => { setCreditDialog(v); if (!v) { setCreditAmount(""); setCreditDesc(""); setCreditRef(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-emerald-600" /> Credit Wallet — {customer.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-center">
              <p className="text-xs text-emerald-700 mb-0.5">Current Balance</p>
              <p className="text-2xl font-bold text-emerald-700">Rs {walletBal.toLocaleString()}</p>
            </div>
            <div>
              <Label className="text-xs">Amount (Rs) *</Label>
              <Input className="mt-1" type="number" min="1" value={creditAmount}
                onChange={e => setCreditAmount(e.target.value.replace(/[^\d.]/g, ""))} placeholder="e.g. 1500" />
            </div>
            <div>
              <Label className="text-xs">Reason / Description *</Label>
              <Input className="mt-1" value={creditDesc} onChange={e => setCreditDesc(e.target.value)}
                placeholder="e.g. Return refund — Order #123" />
            </div>
            <div>
              <Label className="text-xs">Reference <span className="text-muted-foreground">(optional)</span></Label>
              <Input className="mt-1" value={creditRef} onChange={e => setCreditRef(e.target.value)}
                placeholder="Invoice / order / return number" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreditDialog(false)}>Cancel</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={!creditAmount || !creditDesc || parseFloat(creditAmount) <= 0 || creditMutation.isPending}
              onClick={() => creditMutation.mutate()}>
              {creditMutation.isPending ? "Crediting…" : "Add Credit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
