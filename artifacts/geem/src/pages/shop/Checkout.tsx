import { useState, useEffect } from "react";
import { useCart } from "@/contexts/CartContext";
import { ShopLayout } from "./ShopLayout";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { axiosInstance } from "@/lib/axios";
import { Package, ArrowLeft, ShieldCheck, Truck, CheckCircle2, CreditCard, Wallet } from "lucide-react";
import { useShopAuth, SHOP_TOKEN_KEY } from "@/lib/shopAuth";
import { getRecaptchaToken } from "@/lib/recaptcha";

import { PAKISTAN_CITIES } from "@/data/pakistan-cities";
const CITIES = PAKISTAN_CITIES;

interface OrderResponse {
  orderNumber: string;
  total: number;
}

interface ShopProfile {
  id: number; name: string; email: string | null; mobile: string | null;
  username: string | null; address: string; city: string; country: string;
}

interface WalletData { balance: number; }

interface RecentOrder {
  customerName: string; customerEmail: string | null; customerMobile: string;
  customerAddress: string; customerCity: string;
}

export default function Checkout() {
  const { cart, subtotal, shipping, total, clearCart } = useCart();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { customer, getToken } = useShopAuth();
  const qc = useQueryClient();

  const authHeader = () => {
    const t = localStorage.getItem(SHOP_TOKEN_KEY);
    return t ? { Authorization: `Bearer ${t}` } : {};
  };

  const [form, setForm] = useState({
    name: "", email: "", mobile: "", city: "", address: "", notes: "",
    paymentMethod: "cod", transactionId: "",
  });
  const [step, setStep] = useState<"info" | "payment">("info");
  const [walletBalance, setWalletBalance] = useState(0);

  // Bypass Axios interceptor entirely — use raw fetch for shop auth calls
  useEffect(() => {
    const token = getToken();
    if (!token) return;

    const hdrs = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

    // Fetch profile + last order in parallel, then fill form once
    // Guest fallbacks from chat widget intro form
    const chatName   = localStorage.getItem("geem_chat_name")   || "";
    const chatMobile = localStorage.getItem("geem_chat_mobile") || "";

    Promise.all([
      fetch("/api/shop/auth/profile", { headers: hdrs }).then(r => r.ok ? r.json() as Promise<ShopProfile> : null).catch(() => null),
      fetch("/api/shop/auth/orders",  { headers: hdrs }).then(r => r.ok ? r.json() as Promise<RecentOrder[]> : []).catch(() => [] as RecentOrder[]),
      fetch("/api/shop/auth/wallet",  { headers: hdrs }).then(r => r.ok ? r.json() as Promise<WalletData> : null).catch(() => null),
    ]).then(([profile, orders, wallet]) => {
      const last = (orders as RecentOrder[])[0];
      if (wallet) setWalletBalance((wallet as WalletData).balance ?? 0);
      setForm(p => ({
        ...p,
        name:    p.name    || (profile as ShopProfile | null)?.name    || last?.customerName    || chatName   || "",
        email:   p.email   || (profile as ShopProfile | null)?.email   || last?.customerEmail   || "",
        mobile:  p.mobile  || (profile as ShopProfile | null)?.mobile  || last?.customerMobile  || chatMobile || "",
        city:    p.city    || (profile as ShopProfile | null)?.city    || last?.customerCity    || "",
        address: p.address || (profile as ShopProfile | null)?.address || last?.customerAddress || "",
      }));
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const f = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [key]: e.target.value }));

  const orderMutation = useMutation({
    mutationFn: (payload: object) =>
      axiosInstance.post<OrderResponse>("/shop/orders", payload, {
        headers: authHeader(),
      }).then(r => r.data),
    onSuccess: async (data) => {
      clearCart();
      // Update local wallet state immediately so subsequent checkouts show correct balance
      setWalletBalance(prev => Math.max(0, prev - data.total));
      // Force-refetch wallet + orders queries everywhere (including MyAccount)
      await qc.invalidateQueries({ queryKey: ["shop-wallet", customer?.id], refetchType: "all" });
      await qc.invalidateQueries({ queryKey: ["my-orders-auth", customer?.id], refetchType: "all" });
      navigate(`/shop/order-confirmed?order=${data.orderNumber}&total=${data.total}`);
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast({ title: msg || "Failed to place order. Please try again.", variant: "destructive" });
    },
  });

  function handleContinue() {
    if (!form.name || !form.mobile || !form.address || !form.city) {
      toast({ title: "Please fill all required fields", variant: "destructive" });
      return;
    }
    setStep("payment");
  }

  async function handlePlaceOrder() {
    if (form.paymentMethod === "wallet") {
      if (walletBalance < total) {
        toast({ title: "Insufficient wallet balance", variant: "destructive" });
        return;
      }
    } else if (form.paymentMethod !== "cod" && !form.transactionId) {
      toast({ title: "Please enter your transaction ID", variant: "destructive" });
      return;
    }
    const recaptchaToken = await getRecaptchaToken("order");
    orderMutation.mutate({
      customerName: form.name,
      customerEmail: form.email,
      customerMobile: form.mobile,
      customerCity: form.city,
      customerAddress: form.address,
      paymentMethod: form.paymentMethod,
      transactionId: form.transactionId || undefined,
      notes: form.notes || undefined,
      items: cart.map(i => ({ productId: i.productId, qty: i.qty, price: i.price })),
      visitorFp: sessionStorage.getItem("geem_canvas_fp") || localStorage.getItem("geem_canvas_fp") || undefined,
      recaptchaToken,
    });
  }

  if (cart.length === 0) {
    return (
      <ShopLayout>
        <div className="max-w-xl mx-auto px-4 py-20 text-center">
          <h1 className="text-2xl font-bold mb-4">Your cart is empty</h1>
          <Link href="/shop/products"><Button>Browse Products</Button></Link>
        </div>
      </ShopLayout>
    );
  }

  const paymentMethods = [
    { value: "cod",       label: "Cash on Delivery (COD)", desc: "Pay when you receive your order", icon: "💵" },
    { value: "jazzcash",  label: "JazzCash",               desc: "Send to: 0307-8680005",           icon: "🟠" },
    { value: "easypaisa", label: "Easypaisa",              desc: "Send to: 0300-0000001",           icon: "🟢" },
    { value: "bank",      label: "Bank Transfer",          desc: "HBL: 0123-4567890-01 (Geem Pvt Ltd)", icon: "🏦" },
    ...(customer
      ? [{
          value: "wallet",
          label: "Wallet Balance",
          desc: walletBalance >= total
            ? `Available: Rs ${walletBalance.toLocaleString()} — enough to cover this order`
            : `Available: Rs ${walletBalance.toLocaleString()} — insufficient (need Rs ${total.toLocaleString()})`,
          icon: "👛",
          disabled: walletBalance < total,
        }]
      : []),
  ];

  return (
    <ShopLayout>
      <div className="max-w-5xl mx-auto px-4 py-10">
        <div className="flex items-center gap-3 mb-8">
          <Link href="/shop/cart"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />Cart</Button></Link>
          <div className="flex items-center gap-2 text-sm">
            <span className={step === "info" ? "font-bold text-primary" : "text-muted-foreground"}>1. Delivery Info</span>
            <span className="text-muted-foreground">→</span>
            <span className={step === "payment" ? "font-bold text-primary" : "text-muted-foreground"}>2. Payment</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            {step === "info" && (
              <div className="bg-white border rounded-xl p-6 shadow-sm">
                <h2 className="font-bold text-lg mb-5">Delivery Information</h2>
                <form autoComplete="on" onSubmit={e => { e.preventDefault(); handleContinue(); }} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="checkout-name">Full Name *</Label>
                      <Input id="checkout-name" name="name" autoComplete="name" value={form.name} onChange={f("name")} placeholder="Your full name" className="mt-1" />
                    </div>
                    <div>
                      <Label htmlFor="checkout-tel">Mobile Number *</Label>
                      <Input id="checkout-tel" name="tel" autoComplete="tel" type="tel" value={form.mobile} onChange={f("mobile")} placeholder="03XX-XXXXXXX" className="mt-1" />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="checkout-email">Email Address</Label>
                    <Input id="checkout-email" name="email" autoComplete="email" type="email" value={form.email} onChange={f("email")} placeholder="for order updates (optional)" className="mt-1" />
                  </div>
                  <div>
                    <Label>City *</Label>
                    <Select value={form.city} onValueChange={v => setForm(p => ({ ...p, city: v }))}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Select your city" /></SelectTrigger>
                      <SelectContent
                        className="max-h-[50vh] overflow-y-auto"
                        position="popper"
                        sideOffset={4}
                      >
                        {CITIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="checkout-address">Full Delivery Address *</Label>
                    <Textarea id="checkout-address" name="street-address" autoComplete="street-address" value={form.address} onChange={f("address")} placeholder="House #, Street, Area..." className="mt-1" rows={2} />
                  </div>
                  <div>
                    <Label htmlFor="checkout-notes">Order Notes</Label>
                    <Textarea id="checkout-notes" name="notes" value={form.notes} onChange={f("notes")} placeholder="Any special instructions..." className="mt-1" rows={2} />
                  </div>
                  <Button type="submit" className="w-full" size="lg">
                    Continue to Payment →
                  </Button>
                </form>
              </div>
            )}

            {step === "payment" && (
              <div className="bg-white border rounded-xl p-6 shadow-sm">
                <h2 className="font-bold text-lg mb-5">Select Payment Method</h2>
                <div className="space-y-3">
                  {paymentMethods.map(pm => (
                    <label
                      key={pm.value}
                      className={`flex items-center gap-4 p-4 border rounded-xl transition-all ${
                        "disabled" in pm && pm.disabled
                          ? "opacity-50 cursor-not-allowed border-gray-200"
                          : `cursor-pointer ${form.paymentMethod === pm.value ? "border-primary bg-primary/5" : "hover:border-gray-300"}`
                      }`}
                    >
                      <input
                        type="radio"
                        name="paymentMethod"
                        value={pm.value}
                        checked={form.paymentMethod === pm.value}
                        disabled={"disabled" in pm && pm.disabled}
                        onChange={() => !("disabled" in pm && pm.disabled) && setForm(p => ({ ...p, paymentMethod: pm.value }))}
                        className="sr-only"
                      />
                      <span className="text-2xl">{pm.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{pm.label}</p>
                        <p className="text-xs text-muted-foreground">{pm.desc}</p>
                      </div>
                      {form.paymentMethod === pm.value && <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />}
                    </label>
                  ))}
                </div>

                {form.paymentMethod !== "cod" && form.paymentMethod !== "wallet" && (
                  <div className="mt-4">
                    <Label>Transaction ID / Reference Number *</Label>
                    <Input value={form.transactionId} onChange={f("transactionId")} placeholder="Enter your transaction ID" className="mt-1" />
                    <p className="text-xs text-muted-foreground mt-1">After sending payment, enter the transaction ID here.</p>
                  </div>
                )}

                {form.paymentMethod === "wallet" && (
                  <div className="mt-4 flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                    <Wallet className="h-4 w-4 flex-shrink-0" />
                    <span>Rs {walletBalance.toLocaleString()} will be deducted from your wallet on order confirmation.</span>
                  </div>
                )}

                <div className="flex gap-3 mt-6">
                  <Button variant="outline" onClick={() => setStep("info")}>← Back</Button>
                  <Button className="flex-1" size="lg" onClick={handlePlaceOrder} disabled={orderMutation.isPending}>
                    {orderMutation.isPending ? "Placing Order..." : `Place Order — Rs ${total.toLocaleString()}`}
                  </Button>
                </div>
              </div>
            )}

            <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><ShieldCheck className="h-4 w-4 text-green-500" />Secure Checkout</span>
              <span className="flex items-center gap-1"><Truck className="h-4 w-4 text-blue-500" />Free Returns</span>
              <span className="flex items-center gap-1"><CreditCard className="h-4 w-4 text-purple-500" />Safe Payment</span>
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="bg-white border rounded-xl p-5 shadow-sm sticky top-24">
              <h3 className="font-bold mb-4">Your Order</h3>
              <div className="space-y-3 mb-4">
                {cart.map(item => (
                  <div key={item.productId} className="flex gap-3">
                    <div className="w-12 h-12 rounded-lg bg-gray-50 flex-shrink-0 overflow-hidden">
                      {item.image ? <img src={item.image} alt={item.title} className="w-full h-full object-cover" /> : <Package className="h-6 w-6 m-3 text-muted-foreground opacity-30" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium line-clamp-1">{item.title}</p>
                      <p className="text-xs text-muted-foreground">× {item.qty}</p>
                    </div>
                    <p className="text-xs font-bold">Rs {(item.price * item.qty).toLocaleString()}</p>
                  </div>
                ))}
              </div>
              <div className="border-t pt-3 space-y-2 text-sm">
                <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>Rs {subtotal.toLocaleString()}</span></div>
                <div className="flex justify-between text-muted-foreground"><span>Shipping</span><span>Rs {shipping.toLocaleString()}</span></div>
                <div className="flex justify-between font-bold text-base border-t pt-2"><span>Total</span><span className="text-primary">Rs {total.toLocaleString()}</span></div>
                {customer && walletBalance > 0 && (
                  <div className="flex justify-between text-xs text-green-600 pt-1">
                    <span className="flex items-center gap-1"><Wallet className="h-3 w-3" />Wallet</span>
                    <span>Rs {walletBalance.toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </ShopLayout>
  );
}
