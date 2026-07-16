import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { axiosInstance } from "@/lib/axios";
import { ShopLayout } from "./ShopLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Search, Package, Truck, CheckCircle, Clock, XCircle } from "lucide-react";

interface WebOrder { id: number; orderNumber: string; status: string; paymentStatus: string; customerName: string; customerCity: string; total: number; courierCn: string | null; courierName: string | null; createdAt: string; items: Array<{ description: string; qty: number; price: number; amount: number }>; }

const STATUS_STEPS = [
  { key: "new", label: "Order Received", icon: Clock },
  { key: "confirmed", label: "Confirmed", icon: CheckCircle },
  { key: "processing", label: "Processing", icon: Package },
  { key: "shipped", label: "Shipped", icon: Truck },
  { key: "delivered", label: "Delivered", icon: CheckCircle },
];

const STATUS_ORDER = ["new", "confirmed", "processing", "shipped", "delivered"];

export default function TrackOrder() {
  const [orderNumber, setOrderNumber] = useState(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      return params.get("order") ?? "";
    }
    return "";
  });
  const [searchValue, setSearchValue] = useState(orderNumber);
  const [searched, setSearched] = useState(!!orderNumber);

  const { data: order, isLoading, error } = useQuery({
    queryKey: ["track-order", orderNumber],
    queryFn: () => axiosInstance.get<WebOrder>(`/shop/orders/${orderNumber}`).then(r => r.data),
    enabled: !!orderNumber && searched,
    retry: false,
  });

  const currentStep = order ? STATUS_ORDER.indexOf(order.status) : -1;

  return (
    <ShopLayout>
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Track Your Order</h1>
          <p className="text-muted-foreground">Enter your order number to check the status</p>
        </div>

        <form className="flex gap-2 mb-8" onSubmit={e => { e.preventDefault(); setOrderNumber(searchValue); setSearched(true); }}>
          <Input
            id="track-order-number"
            name="order-number"
            autoComplete="off"
            value={searchValue}
            onChange={e => setSearchValue(e.target.value)}
            placeholder="e.g. ORD-20240001"
            className="text-center text-lg"
          />
          <Button type="submit" disabled={!searchValue.trim()}>
            <Search className="h-4 w-4" />
          </Button>
        </form>

        {isLoading && <div className="text-center py-8 text-muted-foreground">Searching...</div>}

        {error && searched && (
          <Card className="border-destructive/20 bg-destructive/5">
            <CardContent className="pt-4 text-center">
              <XCircle className="h-10 w-10 text-destructive mx-auto mb-2" />
              <p className="font-semibold">Order not found</p>
              <p className="text-sm text-muted-foreground mt-1">Please check your order number and try again</p>
            </CardContent>
          </Card>
        )}

        {order && (
          <div className="space-y-6">
            <Card>
              <CardContent className="pt-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Order Number</p>
                    <p className="text-2xl font-bold font-mono">{order.orderNumber}</p>
                  </div>
                  <Badge variant={order.status === "delivered" ? "default" : order.status === "cancelled" ? "destructive" : "secondary"} className="text-sm px-3 py-1 capitalize">
                    {order.status}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-muted-foreground">Customer:</span> {order.customerName}</div>
                  <div><span className="text-muted-foreground">City:</span> {order.customerCity}</div>
                  <div><span className="text-muted-foreground">Date:</span> {new Date(order.createdAt).toLocaleDateString("en-PK", { timeZone: "Asia/Karachi", day: "2-digit", month: "short", year: "numeric" })}</div>
                  <div><span className="text-muted-foreground">Total:</span> <span className="font-bold">Rs {order.total.toLocaleString()}</span></div>
                  {order.courierCn && <div className="col-span-2"><span className="text-muted-foreground">Courier CN:</span> <span className="font-mono font-bold">{order.courierCn}</span></div>}
                </div>
              </CardContent>
            </Card>

            {order.status !== "cancelled" && (
              <Card>
                <CardContent className="pt-6">
                  <h3 className="font-semibold mb-4">Order Progress</h3>
                  <div className="flex justify-between relative">
                    <div className="absolute top-5 left-0 right-0 h-0.5 bg-gray-200 z-0"></div>
                    {STATUS_STEPS.map((step, i) => {
                      const done = i <= currentStep;
                      const current = i === currentStep;
                      return (
                        <div key={step.key} className="flex flex-col items-center gap-2 z-10">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors ${done ? "bg-primary border-primary text-primary-foreground" : "bg-white border-gray-200 text-gray-400"} ${current ? "ring-2 ring-primary ring-offset-2" : ""}`}>
                            <step.icon className="h-5 w-5" />
                          </div>
                          <p className={`text-xs text-center leading-tight max-w-[60px] ${done ? "font-medium" : "text-muted-foreground"}`}>{step.label}</p>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardContent className="pt-6">
                <h3 className="font-semibold mb-3">Items Ordered</h3>
                <div className="space-y-2">
                  {order.items.map((item, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span>{item.description} × {item.qty}</span>
                      <span className="font-medium">Rs {item.amount.toLocaleString()}</span>
                    </div>
                  ))}
                  <div className="border-t pt-2 flex justify-between font-bold">
                    <span>Total</span>
                    <span>Rs {order.total.toLocaleString()}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </ShopLayout>
  );
}
