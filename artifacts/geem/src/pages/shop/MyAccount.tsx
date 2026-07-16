import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { axiosInstance } from "@/lib/axios";
import { ShopLayout } from "./ShopLayout";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useShopAuth, SHOP_TOKEN_KEY } from "@/lib/shopAuth";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import {
  Package, Truck, CheckCircle2, User, LogIn, Mail, Phone,
  MapPin, ShoppingBag, Clock, ChevronRight, Star, HeadphonesIcon,
  RotateCcw, Shield, ArrowRight, Eye, EyeOff, XCircle, AlertCircle,
  LayoutDashboard, Settings, ChevronDown, ChevronUp, AtSign, LogOut, KeyRound,
  Wallet, TrendingUp, TrendingDown, Pencil, Save, X, Plus, SendHorizontal, FileDown,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { formatPakDateTime } from "@/lib/format";
import { PAKISTAN_CITIES } from "@/data/pakistan-cities";

interface WebOrder {
  id: number; orderNumber: string; status: string; paymentStatus: string;
  customerName: string; customerEmail: string | null;
  customerMobile: string; customerAddress: string; customerCity: string;
  paymentMethod: string; transactionId: string | null;
  subtotal: number; shipping: number; total: number;
  courierCn: string | null; rejectionReason: string | null;
  invoiceUrl: string | null;
  createdAt: string;
  items: Array<{ description: string; qty: number; price: number; amount: number }>;
}

interface ShopProfile {
  id: number; name: string; email: string | null; mobile: string | null;
  username: string | null; address: string; city: string; country: string;
}

interface WalletTx {
  id: number; type: "credit" | "debit"; amount: number; balanceAfter: number;
  description: string; reference: string | null; createdAt: string;
}

interface WalletData { balance: number; transactions: WalletTx[]; }

interface ReturnRequest {
  id: number; orderNumber: string; reason: string; description: string;
  status: string; adminNotes: string | null; createdAt: string;
}

const RETURN_REASONS = [
  { value: "defective",        label: "Defective / Not working" },
  { value: "wrong_item",       label: "Wrong item received" },
  { value: "not_as_described", label: "Not as described" },
  { value: "damaged_delivery", label: "Damaged during delivery" },
  { value: "changed_mind",     label: "Changed my mind" },
  { value: "other",            label: "Other" },
];

const RETURN_STATUS_META: Record<string, { label: string; color: string }> = {
  pending:   { label: "Pending Review", color: "bg-amber-100 text-amber-800 border-amber-200" },
  approved:  { label: "Approved",       color: "bg-green-100 text-green-800 border-green-200" },
  rejected:  { label: "Rejected",       color: "bg-red-100 text-red-800 border-red-200" },
  completed: { label: "Completed",      color: "bg-blue-100 text-blue-800 border-blue-200" },
};

const STATUS_META: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  new:        { label: "Pending",     color: "bg-amber-100 text-amber-800 border-amber-200",    icon: <Clock className="h-3.5 w-3.5" /> },
  confirmed:  { label: "Confirmed",   color: "bg-blue-100 text-blue-800 border-blue-200",       icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  processing: { label: "Processing",  color: "bg-indigo-100 text-indigo-800 border-indigo-200", icon: <Package className="h-3.5 w-3.5" /> },
  shipped:    { label: "Shipped",     color: "bg-violet-100 text-violet-800 border-violet-200", icon: <Truck className="h-3.5 w-3.5" /> },
  delivered:  { label: "Delivered",   color: "bg-green-100 text-green-800 border-green-200",    icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  cancelled:  { label: "Cancelled",   color: "bg-red-100 text-red-800 border-red-200",          icon: <XCircle className="h-3.5 w-3.5" /> },
};

const PAYMENT_META: Record<string, { label: string; color: string }> = {
  pending:  { label: "Unpaid",   color: "bg-amber-50 text-amber-700" },
  paid:     { label: "Paid",     color: "bg-green-50 text-green-700" },
  failed:   { label: "Failed",   color: "bg-red-50 text-red-700" },
  refunded: { label: "Refunded", color: "bg-slate-100 text-slate-600" },
};

type Tab = "overview" | "orders" | "wallet" | "profile" | "security";

function StatusBadge({ status }: { status: string }) {
  const m = STATUS_META[status] ?? { label: status, color: "bg-slate-100 text-slate-700 border-slate-200", icon: null };
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border capitalize", m.color)}>
      {m.icon}{m.label}
    </span>
  );
}

function OrderCard({ order, onReturn, existingReturn }: {
  order: WebOrder;
  onReturn?: (order: WebOrder) => void;
  existingReturn?: ReturnRequest;
}) {
  const [open, setOpen] = useState(false);
  const fmt = (n: number) => "Rs " + Number(n).toLocaleString();
  const date = new Date(order.createdAt).toLocaleDateString("en-PK", { timeZone: "Asia/Karachi", year: "numeric", month: "short", day: "numeric" });
  const pm = PAYMENT_META[order.paymentStatus] ?? { label: order.paymentStatus, color: "bg-slate-100 text-slate-600" };

  return (
    <div className="rounded-xl border bg-white overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="font-mono font-bold text-sm text-slate-800">{order.orderNumber}</span>
          <span className="text-xs text-slate-400">{date}</span>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={order.status} />
          <button onClick={() => setOpen(v => !v)} className="text-slate-400 hover:text-slate-700 p-1">
            {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>
      <div className="px-4 py-3 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-4">
          <div><p className="text-xs text-slate-400">Items</p><p className="text-sm font-medium text-slate-700">{order.items.length} item{order.items.length !== 1 ? "s" : ""}</p></div>
          <div><p className="text-xs text-slate-400">Total</p><p className="text-sm font-bold text-slate-900">{fmt(order.total)}</p></div>
          <div><p className="text-xs text-slate-400">Payment</p><span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full", pm.color)}>{pm.label}</span></div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {order.courierCn && (
            <Link href={`/shop/track?order=${order.orderNumber}`}>
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1"><Truck className="h-3.5 w-3.5" /> Track</Button>
            </Link>
          )}
          {order.invoiceUrl && (["shipped", "delivered"].includes(order.status)) && (
            <a href={order.invoiceUrl} target="_blank" rel="noopener noreferrer">
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1 border-green-200 bg-green-50 text-green-700 hover:bg-green-100">
                <FileDown className="h-3.5 w-3.5" /> Invoice
              </Button>
            </a>
          )}
          <Button size="sm" variant="ghost" className="h-8 text-xs gap-1" onClick={() => setOpen(v => !v)}>
            <Eye className="h-3.5 w-3.5" /> Details
          </Button>
        </div>
      </div>
      {open && (
        <div className="px-4 pb-4 border-t pt-3 space-y-3">
          <div>
            <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">Order Items</p>
            <div className="divide-y rounded-lg border overflow-hidden">
              {order.items.map((item, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2 bg-white text-sm">
                  <span className="text-slate-700 flex-1">{item.description}</span>
                  <span className="text-slate-400 mx-3 text-xs">× {item.qty}</span>
                  <span className="font-medium text-slate-800 text-right">{fmt(item.amount)}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-slate-50 rounded-lg px-3 py-2 text-sm space-y-1">
            <div className="flex justify-between text-slate-500"><span>Subtotal</span><span>{fmt(order.subtotal)}</span></div>
            {Number(order.shipping) > 0 && <div className="flex justify-between text-slate-500"><span>Shipping</span><span>{fmt(order.shipping)}</span></div>}
            <Separator className="my-1" />
            <div className="flex justify-between font-bold text-slate-800"><span>Total</span><span>{fmt(order.total)}</span></div>
          </div>
          <div className="text-xs text-slate-500 flex items-start gap-1.5">
            <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>{order.customerAddress}, {order.customerCity}</span>
          </div>
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5" />
            Payment: <span className="font-medium capitalize">{order.paymentMethod.replace(/_/g, " ")}</span>
            {order.transactionId && <span className="font-mono ml-1 text-slate-400">#{order.transactionId}</span>}
          </div>
          {order.courierCn && (
            <div className="text-xs flex items-center gap-1.5 text-slate-500">
              <Truck className="h-3.5 w-3.5 text-green-600" />
              Courier CN: <span className="font-mono font-bold text-green-700">{order.courierCn}</span>
            </div>
          )}
          {order.rejectionReason && (
            <div className="flex items-start gap-1.5 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
              <AlertCircle className="h-3.5 w-3.5 mt-0.5" /><span>{order.rejectionReason}</span>
            </div>
          )}
          {(order.status === "delivered" || order.status === "shipped") && (
            <div className="pt-1 border-t space-y-2">
              {order.invoiceUrl && (
                <a
                  href={order.invoiceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-green-200 bg-green-50 text-green-700 hover:bg-green-100 transition-colors"
                >
                  <FileDown className="h-3.5 w-3.5" /> View / Download Invoice
                </a>
              )}
              {existingReturn ? (
                <div className={cn("flex items-center gap-2 text-xs px-3 py-2 rounded-lg border", RETURN_STATUS_META[existingReturn.status]?.color ?? "bg-slate-100 text-slate-700")}>
                  <RotateCcw className="h-3.5 w-3.5 shrink-0" />
                  <span>Return {RETURN_STATUS_META[existingReturn.status]?.label ?? existingReturn.status}</span>
                  {existingReturn.adminNotes && <span className="ml-1 text-slate-500">— {existingReturn.adminNotes}</span>}
                </div>
              ) : onReturn && (
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5 text-orange-600 border-orange-200 hover:bg-orange-50"
                  onClick={e => { e.stopPropagation(); onReturn(order); }}>
                  <RotateCcw className="h-3 w-3" /> Request Return / Report Issue
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ChangePasswordTab({ getToken }: { getToken: () => string | null }) {
  const { toast } = useToast();
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.current || !form.next || !form.confirm) { setError("All fields are required."); return; }
    if (form.next.length < 6) { setError("New password must be at least 6 characters."); return; }
    if (form.next !== form.confirm) { setError("New passwords do not match."); return; }
    setLoading(true);
    try {
      const token = getToken();
      await axiosInstance.post("/shop/auth/change-password",
        { currentPassword: form.current, newPassword: form.next },
        { headers: token ? { Authorization: `Bearer ${token}` } : {} },
      );
      setSuccess(true);
      setForm({ current: "", next: "", confirm: "" });
      toast({ title: "Password changed successfully" });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Failed to change password.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-primary" /> Change Password
        </CardTitle>
      </CardHeader>
      <CardContent>
        {success ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle2 className="h-7 w-7 text-green-600" />
            </div>
            <p className="font-semibold text-slate-800">Password updated!</p>
            <p className="text-sm text-slate-500">Your password has been changed successfully.</p>
            <Button size="sm" variant="outline" onClick={() => setSuccess(false)}>Change again</Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 max-w-sm">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Current Password</label>
              <div className="relative">
                <Input type={showCurrent ? "text" : "password"} value={form.current}
                  onChange={e => setForm(f => ({ ...f, current: e.target.value }))}
                  placeholder="Enter current password" className="pr-10" />
                <button type="button" onClick={() => setShowCurrent(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" tabIndex={-1}>
                  {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">New Password <span className="text-xs text-slate-400">(min. 6 characters)</span></label>
              <div className="relative">
                <Input type={showNext ? "text" : "password"} value={form.next}
                  onChange={e => setForm(f => ({ ...f, next: e.target.value }))}
                  placeholder="New password" className="pr-10" />
                <button type="button" onClick={() => setShowNext(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" tabIndex={-1}>
                  {showNext ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Confirm New Password</label>
              <Input type="password" value={form.confirm}
                onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
                placeholder="Repeat new password" />
            </div>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2">{error}</div>
            )}
            <Button type="submit" disabled={loading}>
              {loading ? "Saving…" : "Update Password"}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

function SignedInAccount() {
  const { customer, logout, getToken } = useShopAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("overview");
  const [orderFilter, setOrderFilter] = useState("all");
  const [editingAddress, setEditingAddress] = useState(false);
  const [editingInfo, setEditingInfo] = useState(false);
  const [addressForm, setAddressForm] = useState({ address: "", city: "", country: "Pakistan" });
  const [infoForm, setInfoForm] = useState({ name: "", mobile: "" });
  const [returnOrder, setReturnOrder] = useState<WebOrder | null>(null);
  const [returnForm, setReturnForm] = useState({ reason: "", description: "" });

  usePushNotifications({
    authHeader: () => {
      const t = getToken();
      return t ? { Authorization: `Bearer ${t}` } : ({} as Record<string, string>);
    },
    userType: "shop",
    userId: customer?.email ?? undefined,
  });

  const authHeader = () => {
    const token = getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const { data: orders = [], isLoading } = useQuery<WebOrder[]>({
    queryKey: ["my-orders-auth", customer?.id],
    queryFn: () => axiosInstance.get<WebOrder[]>("/shop/auth/orders", { headers: authHeader() }).then(r => r.data),
    enabled: !!customer,
    staleTime: 60_000,
  });

  const { data: profile, isLoading: profileLoading } = useQuery<ShopProfile>({
    queryKey: ["shop-profile", customer?.id],
    queryFn: () => axiosInstance.get<ShopProfile>("/shop/auth/profile", { headers: authHeader() }).then(r => r.data),
    enabled: !!customer,
    staleTime: 30_000,
  });

  const { data: walletData } = useQuery<WalletData>({
    queryKey: ["shop-wallet", customer?.id],
    queryFn: () => axiosInstance.get<WalletData>("/shop/auth/wallet", { headers: authHeader() }).then(r => r.data),
    enabled: !!customer,
    staleTime: 60_000,
  });

  const { data: returnRequests = [] } = useQuery<ReturnRequest[]>({
    queryKey: ["shop-returns", customer?.id],
    queryFn: () => axiosInstance.get<ReturnRequest[]>("/shop/auth/return-requests", { headers: authHeader() }).then(r => r.data),
    enabled: !!customer,
    staleTime: 60_000,
  });

  const returnMutation = useMutation({
    mutationFn: (data: { orderNumber: string; reason: string; description: string }) =>
      axiosInstance.post("/shop/auth/return-request", data, { headers: authHeader() }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shop-returns", customer?.id] });
      setReturnOrder(null);
      setReturnForm({ reason: "", description: "" });
      toast({ title: "Return request submitted", description: "Our team will review it and get back to you." });
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Failed to submit return request";
      toast({ title: msg, variant: "destructive" });
    },
  });

  const profileMutation = useMutation({
    mutationFn: (data: Partial<ShopProfile>) =>
      axiosInstance.patch<ShopProfile>("/shop/auth/profile", data, { headers: authHeader() }).then(r => r.data),
    onSuccess: (updated) => {
      qc.setQueryData(["shop-profile", customer?.id], updated);
      setEditingAddress(false);
      setEditingInfo(false);
      toast({ title: "Profile updated" });
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Failed to update";
      toast({ title: msg, variant: "destructive" });
    },
  });

  const filtered = orderFilter === "all" ? orders : orders.filter(o => o.status === orderFilter);
  const totalSpent = orders.reduce((s, o) => s + Number(o.total), 0);
  const delivered = orders.filter(o => o.status === "delivered").length;
  const pending = orders.filter(o => ["new", "confirmed", "processing"].includes(o.status)).length;
  const walletBal = walletData?.balance ?? 0;

  const displayName = customer?.name ?? "My Account";
  const initials = displayName.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() || "U";

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "overview",  label: "Overview",                                               icon: <LayoutDashboard className="h-4 w-4" /> },
    { id: "orders",    label: `Orders${orders.length ? ` (${orders.length})` : ""}`,   icon: <Package className="h-4 w-4" /> },
    { id: "wallet",    label: "Wallet",                                                 icon: <Wallet className="h-4 w-4" /> },
    { id: "profile",   label: "Profile",                                                icon: <Settings className="h-4 w-4" /> },
    { id: "security",  label: "Security",                                               icon: <KeyRound className="h-4 w-4" /> },
  ];

  async function handleLogout() {
    await logout();
    navigate("/shop");
  }

  function startEditAddress() {
    setAddressForm({ address: profile?.address ?? "", city: profile?.city ?? "", country: profile?.country ?? "Pakistan" });
    setEditingAddress(true);
  }

  function startEditInfo() {
    setInfoForm({ name: profile?.name ?? customer?.name ?? "", mobile: profile?.mobile ?? customer?.mobile ?? "" });
    setEditingInfo(true);
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xl shrink-0">
            {initials}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{displayName}</h1>
            <div className="flex flex-wrap gap-3 mt-0.5">
              {customer?.email && (
                <p className="text-sm text-slate-500 flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{customer.email}</p>
              )}
              {customer?.mobile && (
                <p className="text-sm text-slate-500 flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{customer.mobile}</p>
              )}
            </div>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={handleLogout} className="text-red-600 border-red-200 hover:bg-red-50">
          <LogOut className="h-4 w-4 mr-1.5" /> Sign Out
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex border-b gap-0 overflow-x-auto">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn("flex items-center gap-1.5 px-3 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
              tab === t.id ? "border-primary text-primary" : "border-transparent text-slate-500 hover:text-slate-800")}>
            {t.icon}{t.label}
            {t.id === "wallet" && walletBal > 0 && (
              <span className="ml-1 text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-semibold">
                Rs {walletBal.toLocaleString()}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* OVERVIEW */}
      {tab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: "Total Orders", value: orders.length,                          icon: <ShoppingBag className="h-5 w-5 text-blue-600" />,    bg: "bg-blue-50" },
              { label: "Delivered",    value: delivered,                               icon: <CheckCircle2 className="h-5 w-5 text-green-600" />,  bg: "bg-green-50" },
              { label: "In Progress",  value: pending,                                 icon: <Clock className="h-5 w-5 text-amber-600" />,          bg: "bg-amber-50" },
              { label: "Total Spent",  value: "Rs " + totalSpent.toLocaleString(),     icon: <Star className="h-5 w-5 text-violet-600" />,          bg: "bg-violet-50" },
              { label: "Wallet",       value: "Rs " + walletBal.toLocaleString(),      icon: <Wallet className="h-5 w-5 text-emerald-600" />,       bg: "bg-emerald-50" },
            ].map(s => (
              <div key={s.label} className={cn("rounded-xl border p-4 flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity", s.bg)}
                onClick={() => s.label === "Wallet" ? setTab("wallet") : s.label === "Total Orders" || s.label === "In Progress" || s.label === "Delivered" ? setTab("orders") : undefined}>
                <div className="shrink-0">{s.icon}</div>
                <div>
                  <p className="text-xs text-slate-500">{s.label}</p>
                  <p className="text-lg font-bold text-slate-800">{s.value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Wallet callout if balance > 0 */}
          {walletBal > 0 && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center shrink-0">
                <Wallet className="h-6 w-6 text-emerald-600" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-emerald-800">You have Rs {walletBal.toLocaleString()} in wallet credit!</p>
                <p className="text-sm text-emerald-700">This balance will be automatically applied at your next checkout.</p>
              </div>
              <Button size="sm" variant="outline" className="border-emerald-300 text-emerald-700 hover:bg-emerald-100 shrink-0" onClick={() => setTab("wallet")}>
                View
              </Button>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-base text-slate-800">Recent Orders</h2>
              <button onClick={() => setTab("orders")} className="text-sm text-primary hover:underline flex items-center gap-1">
                View all <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            {isLoading ? (
              <div className="space-y-3">{[1,2].map(i => <div key={i} className="h-20 bg-slate-100 rounded-xl animate-pulse" />)}</div>
            ) : orders.length === 0 ? (
              <div className="border rounded-xl py-12 text-center text-slate-400">
                <ShoppingBag className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium text-slate-600">No orders yet</p>
                <Link href="/shop/products"><Button className="mt-4" size="sm">Shop Now <ArrowRight className="h-4 w-4 ml-1.5" /></Button></Link>
              </div>
            ) : (
              <div className="space-y-3">
                {orders.slice(0, 3).map(o => <OrderCard key={o.id} order={o}
                  onReturn={setReturnOrder}
                  existingReturn={returnRequests.find(r => r.orderNumber === o.orderNumber)} />)}
                {orders.length > 3 && (
                  <button onClick={() => setTab("orders")} className="w-full text-center text-sm text-primary hover:underline py-2">
                    + {orders.length - 3} more orders
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { icon: <Truck className="h-5 w-5 text-violet-600" />,        label: "Track an Order",    sub: "Enter order # to track", href: "/shop/track",   bg: "bg-violet-50" },
              { icon: <HeadphonesIcon className="h-5 w-5 text-blue-600" />, label: "Get Support",       sub: "Contact our team",        href: "/shop/contact", bg: "bg-blue-50" },
              { icon: <RotateCcw className="h-5 w-5 text-amber-600" />,     label: "Returns & Refunds", sub: "Return policy",           href: "/shop/returns", bg: "bg-amber-50" },
            ].map(q => (
              <Link key={q.label} href={q.href}>
                <div className={cn("rounded-xl border p-4 flex items-center gap-3 cursor-pointer hover:shadow-sm transition-shadow", q.bg)}>
                  {q.icon}
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{q.label}</p>
                    <p className="text-xs text-slate-500">{q.sub}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-400 ml-auto" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ORDERS */}
      {tab === "orders" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {["all", "new", "confirmed", "processing", "shipped", "delivered", "cancelled"].map(f => {
              const cnt = f === "all" ? orders.length : orders.filter(o => o.status === f).length;
              return (
                <button key={f} onClick={() => setOrderFilter(f)}
                  className={cn("px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                    orderFilter === f ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:border-slate-400")}>
                  <span className="capitalize">{f === "all" ? "All Orders" : f}</span>
                  {cnt > 0 && <span className={cn("ml-1.5 font-bold", orderFilter === f ? "text-white/80" : "text-slate-400")}>{cnt}</span>}
                </button>
              );
            })}
          </div>
          {isLoading ? (
            <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-24 bg-slate-100 rounded-xl animate-pulse" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="border rounded-xl py-14 text-center text-slate-400">
              <Package className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium text-slate-600">{orderFilter === "all" ? "No orders yet" : `No ${orderFilter} orders`}</p>
              {orderFilter === "all" && <Link href="/shop/products"><Button className="mt-4" size="sm">Browse Products <ArrowRight className="h-4 w-4 ml-1.5" /></Button></Link>}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-slate-500">Showing {filtered.length} order{filtered.length !== 1 ? "s" : ""}{orderFilter !== "all" && ` · ${orderFilter}`}</p>
              {filtered.map(o => <OrderCard key={o.id} order={o}
                onReturn={setReturnOrder}
                existingReturn={returnRequests.find(r => r.orderNumber === o.orderNumber)} />)}
            </div>
          )}
        </div>
      )}

      {/* WALLET */}
      {tab === "wallet" && (
        <div className="space-y-5">
          {/* Balance card */}
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Wallet className="h-7 w-7 text-emerald-600" />
              </div>
              <p className="text-4xl font-bold text-emerald-700 mb-1">Rs {walletBal.toLocaleString()}</p>
              <p className="text-sm text-emerald-600">Available wallet balance</p>
              {walletBal > 0 && (
                <p className="text-xs text-emerald-700 mt-3 bg-emerald-100 rounded-full px-4 py-1.5 inline-block">
                  This credit will be automatically applied at your next checkout
                </p>
              )}
            </div>
          </div>

          {/* How wallet works */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-slate-700">How does the wallet work?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-600">
              <div className="flex items-start gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                <p><span className="font-medium text-emerald-700">Credits</span> are added by our team when you return a product or receive a refund.</p>
              </div>
              <div className="flex items-start gap-2">
                <TrendingDown className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                <p><span className="font-medium text-red-600">Debits</span> happen automatically when you use wallet credit at checkout.</p>
              </div>
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                <p>To add funds or for any questions, please <Link href="/shop/contact"><span className="text-primary underline">contact support</span></Link>.</p>
              </div>
            </CardContent>
          </Card>

          {/* Transaction history */}
          <div>
            <h2 className="font-semibold text-base text-slate-800 mb-3">Transaction History</h2>
            {!walletData || walletData.transactions.length === 0 ? (
              <div className="border rounded-xl py-12 text-center text-slate-400">
                <Wallet className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium text-slate-600">No wallet transactions yet</p>
                <p className="text-sm mt-1">Credits will appear here when added by our team.</p>
              </div>
            ) : (
              <div className="rounded-xl border overflow-hidden divide-y bg-white">
                {walletData.transactions.map(tx => (
                  <div key={tx.id} className="flex items-center gap-3 px-4 py-3.5">
                    <div className={cn("w-9 h-9 rounded-full flex items-center justify-center shrink-0",
                      tx.type === "credit" ? "bg-emerald-100" : "bg-red-100")}>
                      {tx.type === "credit"
                        ? <TrendingUp className="h-4 w-4 text-emerald-600" />
                        : <TrendingDown className="h-4 w-4 text-red-500" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{tx.description}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {tx.reference && <span className="text-xs font-mono text-slate-400">{tx.reference}</span>}
                        <span className="text-xs text-slate-400">
                          {formatPakDateTime(tx.createdAt, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={cn("text-sm font-bold", tx.type === "credit" ? "text-emerald-600" : "text-red-500")}>
                        {tx.type === "credit" ? "+" : "−"}Rs {tx.amount.toLocaleString()}
                      </p>
                      <p className="text-xs text-slate-400">Bal: Rs {tx.balanceAfter.toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* PROFILE */}
      {tab === "profile" && (
        <div className="space-y-5">

          {/* Personal info */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" /> Personal Information
                </CardTitle>
                {!editingInfo && (
                  <button onClick={startEditInfo} className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors">
                    <Pencil className="h-3 w-3" /> Edit
                  </button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {editingInfo ? (
                <div className="space-y-3 max-w-sm">
                  <div>
                    <Label className="text-xs">Full Name *</Label>
                    <Input className="mt-1" value={infoForm.name} onChange={e => setInfoForm(f => ({ ...f, name: e.target.value }))} placeholder="Your full name" />
                  </div>
                  <div>
                    <Label className="text-xs">Mobile Number</Label>
                    <Input className="mt-1" value={infoForm.mobile} onChange={e => setInfoForm(f => ({ ...f, mobile: e.target.value }))} placeholder="03XX-XXXXXXX" />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" onClick={() => profileMutation.mutate({ name: infoForm.name, mobile: infoForm.mobile })}
                      disabled={!infoForm.name.trim() || profileMutation.isPending}>
                      <Save className="h-3.5 w-3.5 mr-1" /> {profileMutation.isPending ? "Saving…" : "Save"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEditingInfo(false)}>
                      <X className="h-3.5 w-3.5 mr-1" /> Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xl">{initials}</div>
                    <div>
                      <p className="font-semibold text-slate-800">{profile?.name ?? displayName}</p>
                      {(profile?.email ?? customer?.email) && (
                        <p className="text-sm text-slate-500 flex items-center gap-1.5 mt-0.5">
                          <Mail className="h-3.5 w-3.5" />{profile?.email ?? customer?.email}
                        </p>
                      )}
                      {(profile?.mobile ?? customer?.mobile) && (
                        <p className="text-sm text-slate-500 flex items-center gap-1.5 mt-0.5">
                          <Phone className="h-3.5 w-3.5" />{profile?.mobile ?? customer?.mobile}
                        </p>
                      )}
                      {customer?.username && (
                        <p className="text-sm text-slate-500 flex items-center gap-1.5 mt-0.5">
                          <AtSign className="h-3.5 w-3.5" />@{customer.username}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Delivery address */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" /> Delivery Address
                </CardTitle>
                {!editingAddress && (profile?.address || profile?.city) && (
                  <button onClick={startEditAddress} className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors">
                    <Pencil className="h-3 w-3" /> Edit
                  </button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {profileLoading ? (
                <div className="h-16 bg-slate-100 rounded-lg animate-pulse" />
              ) : editingAddress ? (
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs">Street Address</Label>
                    <Textarea className="mt-1" rows={2} value={addressForm.address}
                      onChange={e => setAddressForm(f => ({ ...f, address: e.target.value }))}
                      placeholder="House / flat no., street, area" />
                  </div>
                  <div>
                    <Label className="text-xs">City</Label>
                    <Select value={addressForm.city || "__none__"} onValueChange={v => setAddressForm(f => ({ ...f, city: v === "__none__" ? "" : v }))}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Select city…" /></SelectTrigger>
                      <SelectContent className="max-h-60">
                        <SelectItem value="__none__">— Select city —</SelectItem>
                        {PAKISTAN_CITIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Country</Label>
                    <Input className="mt-1" value={addressForm.country} onChange={e => setAddressForm(f => ({ ...f, country: e.target.value }))} placeholder="Pakistan" />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" onClick={() => profileMutation.mutate({ address: addressForm.address, city: addressForm.city, country: addressForm.country })}
                      disabled={profileMutation.isPending}>
                      <Save className="h-3.5 w-3.5 mr-1" /> {profileMutation.isPending ? "Saving…" : "Save Address"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEditingAddress(false)}>
                      <X className="h-3.5 w-3.5 mr-1" /> Cancel
                    </Button>
                  </div>
                </div>
              ) : profile?.address || profile?.city ? (
                <div className="space-y-2 text-sm text-slate-700">
                  {profile.address && (
                    <p className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                      {profile.address}
                    </p>
                  )}
                  {profile.city && (
                    <p className="flex items-center gap-2 text-slate-500">
                      <span className="w-4 h-4 shrink-0" />
                      {profile.city}{profile.country ? `, ${profile.country}` : ""}
                    </p>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 py-6 text-center">
                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                    <MapPin className="h-6 w-6 text-slate-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-600">No delivery address saved</p>
                    <p className="text-xs text-slate-400 mt-0.5">Save your address to speed up checkout</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={startEditAddress}>
                    <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Address
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Account Actions</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setTab("security")}>
                <KeyRound className="h-3.5 w-3.5 mr-1.5" /> Change Password
              </Button>
              <Button variant="destructive" size="sm" onClick={handleLogout}>
                <LogOut className="h-3.5 w-3.5 mr-1.5" /> Sign Out
              </Button>
            </CardContent>
          </Card>

          {/* Help */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Help & Support</CardTitle></CardHeader>
            <CardContent className="grid gap-1">
              {[
                { label: "Track an Order",         href: "/shop/track",    icon: <Truck className="h-4 w-4 text-slate-400" /> },
                { label: "Contact Support",         href: "/shop/contact",  icon: <HeadphonesIcon className="h-4 w-4 text-slate-400" /> },
                { label: "Return & Refund Policy",  href: "/shop/returns",  icon: <RotateCcw className="h-4 w-4 text-slate-400" /> },
                { label: "Shipping Info",           href: "/shop/shipping", icon: <Truck className="h-4 w-4 text-slate-400" /> },
                { label: "FAQs",                    href: "/shop/faq",      icon: <AlertCircle className="h-4 w-4 text-slate-400" /> },
              ].map(l => (
                <Link key={l.label} href={l.href}>
                  <div className="flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors">
                    {l.icon}<span className="text-sm text-slate-700">{l.label}</span>
                    <ChevronRight className="h-4 w-4 text-slate-300 ml-auto" />
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* SECURITY */}
      {tab === "security" && <ChangePasswordTab getToken={getToken} />}

      {/* RETURN REQUEST DIALOG */}
      <Dialog open={!!returnOrder} onOpenChange={v => { if (!v) { setReturnOrder(null); setReturnForm({ reason: "", description: "" }); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-4 w-4 text-orange-600" /> Request Return / Report Issue
            </DialogTitle>
          </DialogHeader>
          {returnOrder && (
            <div className="space-y-4">
              <div className="bg-slate-50 rounded-lg px-3 py-2 text-sm">
                <span className="text-slate-500">Order: </span>
                <span className="font-mono font-bold">{returnOrder.orderNumber}</span>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Reason *</Label>
                <Select value={returnForm.reason} onValueChange={v => setReturnForm(f => ({ ...f, reason: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select a reason…" /></SelectTrigger>
                  <SelectContent>
                    {RETURN_REASONS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Describe the issue *</Label>
                <Textarea rows={4} placeholder="Describe what happened with the product…"
                  value={returnForm.description} onChange={e => setReturnForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
                Our team will review your request and contact you within 1–2 business days.
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setReturnOrder(null); setReturnForm({ reason: "", description: "" }); }}>
              Cancel
            </Button>
            <Button
              onClick={() => returnOrder && returnMutation.mutate({ orderNumber: returnOrder.orderNumber, ...returnForm })}
              disabled={!returnForm.reason || !returnForm.description.trim() || returnMutation.isPending}
              className="gap-1.5">
              <SendHorizontal className="h-3.5 w-3.5" />
              {returnMutation.isPending ? "Submitting…" : "Submit Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function GuestAccount() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [tab, setTab] = useState<"track" | "login">("track");
  const { login } = useShopAuth();

  return (
    <div className="max-w-lg mx-auto px-4 py-16 space-y-8 text-center">
      <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
        <LogIn className="h-9 w-9 text-primary" />
      </div>
      <div>
        <h1 className="text-3xl font-bold text-slate-900">My Account</h1>
        <p className="text-slate-500 mt-2">Sign in to track orders, view your wallet, and manage your profile</p>
      </div>
      <div className="flex gap-3 justify-center">
        <Link href="/shop/sign-in">
          <Button size="lg">Sign In</Button>
        </Link>
        <Link href="/shop/sign-up">
          <Button size="lg" variant="outline">Create Account</Button>
        </Link>
      </div>
      <div className="pt-4 border-t">
        <p className="text-sm text-slate-500 mb-3">Already have an order number?</p>
        <Link href="/shop/track">
          <Button variant="ghost" size="sm" className="text-primary">
            <Truck className="h-4 w-4 mr-1.5" /> Track your order
          </Button>
        </Link>
      </div>
    </div>
  );
}

export default function MyAccount() {
  const { customer, isLoaded } = useShopAuth();

  return (
    <ShopLayout>
      {!isLoaded ? (
        <div className="max-w-4xl mx-auto px-4 py-16 space-y-4">
          <div className="h-16 bg-slate-100 rounded-xl animate-pulse" />
          <div className="h-12 bg-slate-100 rounded-xl animate-pulse" />
          <div className="h-64 bg-slate-100 rounded-xl animate-pulse" />
        </div>
      ) : customer ? (
        <SignedInAccount />
      ) : (
        <GuestAccount />
      )}
    </ShopLayout>
  );
}
