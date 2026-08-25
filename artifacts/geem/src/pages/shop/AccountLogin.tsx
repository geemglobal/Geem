import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { axiosInstance } from "@/lib/axios";
import { ShopLayout } from "./ShopLayout";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Package, Search, ArrowRight, Truck, CheckCircle2, User, LogIn, Mail, Phone, MapPin } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useShopAuth } from "@/lib/shopAuth";

interface WebOrder {
  id: number; orderNumber: string; status: string; paymentStatus: string;
  customerName: string; total: number; courierCn: string | null; createdAt: string;
  items: Array<{ description: string; qty: number; amount: number }>;
}

const STATUS_COLOR: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  new: "outline", confirmed: "secondary", processing: "secondary",
  shipped: "default", delivered: "default", cancelled: "destructive",
};

const BASE_PATH = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function AccountLogin() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { customer, isLoaded } = useShopAuth();

  const [email, setEmail] = useState("");
  const [submittedEmail, setSubmittedEmail] = useState(() => customer?.email ?? "");
  const [searched, setSearched] = useState(!!customer?.email);

  const { data: orders, isLoading } = useQuery({
    queryKey: ["my-orders", submittedEmail],
    queryFn: () => axiosInstance.get<WebOrder[]>(`/shop/orders/by-email?email=${encodeURIComponent(submittedEmail)}`).then(r => r.data),
    enabled: !!submittedEmail && searched,
    retry: false,
  });

  function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    const val = email.trim();
    if (!val || !val.includes("@")) {
      toast({ title: "Please enter a valid email address", variant: "destructive" });
      return;
    }
    setSubmittedEmail(val);
    setSearched(true);
  }

  if (!isLoaded) {
    return (
      <ShopLayout>
        <div className="max-w-3xl mx-auto px-4 py-16 text-center">
          <div className="h-8 w-48 bg-gray-100 rounded animate-pulse mx-auto" />
        </div>
      </ShopLayout>
    );
  }

  return (
    <ShopLayout>
      <div className="max-w-3xl mx-auto px-4 py-10">

        {customer ? (
          /* ── Signed-in: redirect to full account page ── */
          <div className="text-center py-16">
            <p className="text-slate-500 mb-4">You are signed in as <strong>{customer.name}</strong>.</p>
            <Link href="/shop/account">
              <Button>Go to My Account</Button>
            </Link>
          </div>
        ) : (
          /* ── Guest View ── */
          <div className="space-y-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <User className="h-8 w-8 text-primary" />
              </div>
              <h1 className="text-2xl font-bold mb-2">My Account</h1>
              <p className="text-muted-foreground">Sign in to view your orders and account details, or look up orders by email.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card className="border-primary/30">
                <CardContent className="pt-6 text-center space-y-3">
                  <LogIn className="h-8 w-8 text-primary mx-auto" />
                  <div>
                    <p className="font-semibold">Have an account?</p>
                    <p className="text-sm text-muted-foreground mt-1">Sign in to see all your orders and manage your profile.</p>
                  </div>
                  <Link href="/shop/sign-in">
                    <Button className="w-full">Sign In</Button>
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    New here? <Link href="/shop/sign-up"><span className="text-primary cursor-pointer hover:underline">Create account</span></Link>
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6 text-center space-y-3">
                  <Package className="h-8 w-8 text-muted-foreground mx-auto" />
                  <div>
                    <p className="font-semibold">Guest Order Lookup</p>
                    <p className="text-sm text-muted-foreground mt-1">Find your order using the email you provided at checkout.</p>
                  </div>
                  <form onSubmit={handleLookup} className="space-y-2 text-left">
                    <Input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="your@email.com"
                      autoComplete="email"
                      className="text-sm"
                    />
                    <Button type="submit" variant="outline" className="w-full" disabled={isLoading}>
                      <Search className="h-4 w-4 mr-2" />
                      {isLoading ? "Searching…" : "Find Orders"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>

            {searched && !isLoading && orders !== undefined && (
              <div>
                {orders.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground border rounded-xl">
                    <Package className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">No orders found for {submittedEmail}</p>
                    <p className="text-sm mt-1">Check the email or track by order number.</p>
                    <div className="flex gap-3 justify-center mt-4">
                      <Link href="/shop/track"><Button variant="outline" size="sm">Track by Order #</Button></Link>
                      <Link href="/shop/products"><Button size="sm">Browse Products</Button></Link>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground font-medium">{orders.length} order{orders.length !== 1 ? "s" : ""} for <strong>{submittedEmail}</strong></p>
                    {orders.map(order => (
                      <Card key={order.id}>
                        <CardContent className="pt-4">
                          <div className="flex items-start justify-between mb-2">
                            <p className="font-mono font-bold">{order.orderNumber}</p>
                            <Badge variant={STATUS_COLOR[order.status] ?? "outline"} className="capitalize">{order.status}</Badge>
                          </div>
                          <div className="space-y-1 text-sm mb-3">
                            {order.items.map((item, i) => (
                              <div key={i} className="flex justify-between text-muted-foreground">
                                <span>{item.description} × {item.qty}</span>
                                <span>Rs {item.amount.toLocaleString()}</span>
                              </div>
                            ))}
                          </div>
                          <div className="flex items-center justify-between border-t pt-2">
                            <span className="font-bold text-sm">Rs {order.total.toLocaleString()}</span>
                            <Link href={`/shop/track?order=${order.orderNumber}`}>
                              <Button size="sm" variant="outline"><Truck className="h-3.5 w-3.5 mr-1" /> Track</Button>
                            </Link>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}

            <p className="text-center text-sm text-muted-foreground">
              Questions? <Link href="/shop/contact"><span className="text-primary hover:underline cursor-pointer">Contact us</span></Link> or <Link href="/shop/track"><span className="text-primary hover:underline cursor-pointer">Track by order number</span></Link>
            </p>
          </div>
        )}
      </div>
    </ShopLayout>
  );
}
