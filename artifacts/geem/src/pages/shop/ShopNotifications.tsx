import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { axiosInstance } from "@/lib/axios";
import { ShopLayout } from "./ShopLayout";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useShopAuth } from "@/lib/shopAuth";
import {
  Bell, BellOff, ShoppingCart, Truck, CheckCircle2, XCircle,
  Clock, RotateCcw, ArrowRight, RefreshCw, Package, LogIn, FileText,
} from "lucide-react";

interface ShopNotif {
  id: string;
  type: "order" | "return";
  orderNumber: string;
  title: string;
  subtitle: string;
  status: string;
  createdAt: string;
  invoiceId?: number | null;
}

const STATUS_STYLE: Record<string, { icon: React.ElementType; dot: string; badge: string }> = {
  new:       { icon: ShoppingCart, dot: "bg-blue-500",   badge: "bg-blue-500 text-white"   },
  confirmed: { icon: CheckCircle2, dot: "bg-indigo-500", badge: "bg-indigo-500 text-white" },
  shipped:   { icon: Truck,        dot: "bg-purple-500", badge: "bg-purple-500 text-white" },
  delivered: { icon: CheckCircle2, dot: "bg-green-500",  badge: "bg-green-500 text-white"  },
  cancelled: { icon: XCircle,      dot: "bg-gray-400",   badge: "bg-gray-400 text-white"   },
  pending:   { icon: Clock,        dot: "bg-orange-500", badge: "bg-orange-500 text-white" },
  approved:  { icon: CheckCircle2, dot: "bg-green-500",  badge: "bg-green-500 text-white"  },
  rejected:  { icon: XCircle,      dot: "bg-red-500",    badge: "bg-red-500 text-white"    },
  completed: { icon: CheckCircle2, dot: "bg-teal-500",   badge: "bg-teal-500 text-white"   },
};

const STORAGE_KEY = "shop_notif_last_read";

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function getLastRead() {
  return parseInt(localStorage.getItem(STORAGE_KEY) ?? "0", 10);
}

export function getShopUnreadCount(notifs: ShopNotif[]): number {
  const last = getLastRead();
  return notifs.filter(n => new Date(n.createdAt).getTime() > last).length;
}

export function markShopNotifsRead() {
  const now = String(Date.now());
  localStorage.setItem(STORAGE_KEY, now);
  window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY, newValue: now }));
}

export default function ShopNotifications() {
  const { customer, getToken } = useShopAuth();
  const [, setLocation] = useLocation();

  const authHeader = () => {
    const t = getToken();
    return t ? { Authorization: `Bearer ${t}` } : {};
  };

  const { data: notifs = [], isLoading, refetch } = useQuery<ShopNotif[]>({
    queryKey: ["shop-notifs", customer?.id],
    queryFn: () => axiosInstance.get<ShopNotif[]>("/shop/auth/notifications", { headers: authHeader() }).then(r => r.data),
    enabled: !!customer,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const [lastRead, setLastReadState] = useState(getLastRead());
  const unreadCount = notifs.filter(n => new Date(n.createdAt).getTime() > lastRead).length;

  function handleMarkRead() {
    markShopNotifsRead();
    setLastReadState(Date.now());
    refetch();
  }

  if (!customer) {
    return (
      <ShopLayout>
        <div className="max-w-xl mx-auto px-4 py-20 text-center">
          <Bell className="h-16 w-16 mx-auto mb-6 text-muted-foreground opacity-30" />
          <h1 className="text-2xl font-bold mb-2">Sign in to see notifications</h1>
          <p className="text-muted-foreground mb-6">Your order updates and alerts will appear here.</p>
          <Button onClick={() => setLocation("/shop/sign-in")}>
            <LogIn className="h-4 w-4 mr-2" />Sign In
          </Button>
        </div>
      </ShopLayout>
    );
  }

  const orderNotifs = notifs.filter(n => n.type === "order");
  const returnNotifs = notifs.filter(n => n.type === "return");

  return (
    <ShopLayout>
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Bell className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold">My Notifications</h1>
              <p className="text-xs text-muted-foreground">
                {unreadCount > 0 ? `${unreadCount} new update${unreadCount > 1 ? "s" : ""}` : "You're all caught up"}
              </p>
            </div>
            {unreadCount > 0 && (
              <span className="bg-primary text-primary-foreground text-xs font-bold px-2 py-0.5 rounded-full">
                {unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-muted-foreground"
              title="Refresh"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            </button>
            {unreadCount > 0 && (
              <Button variant="outline" size="sm" onClick={handleMarkRead}>
                <BellOff className="h-4 w-4 mr-1.5" />Mark read
              </Button>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-20 rounded-2xl bg-gray-100 animate-pulse" />)}
          </div>
        ) : notifs.length === 0 ? (
          <div className="rounded-2xl border bg-white p-16 text-center">
            <Package className="h-14 w-14 mx-auto mb-4 text-muted-foreground opacity-20" />
            <p className="font-semibold text-muted-foreground">No notifications yet</p>
            <p className="text-sm text-muted-foreground mt-1">Order updates and alerts will appear here.</p>
            <Link href="/shop/products">
              <Button variant="outline" className="mt-5">Browse Products</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Orders */}
            {orderNotifs.length > 0 && (
              <section>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                  <ShoppingCart className="h-3.5 w-3.5" /> My Orders
                  <span className="font-bold text-foreground/60">({orderNotifs.length})</span>
                </p>
                <div className="space-y-2">
                  {orderNotifs.map(n => <NotifCard key={n.id} notif={n} lastRead={lastRead} />)}
                </div>
              </section>
            )}

            {/* Returns */}
            {returnNotifs.length > 0 && (
              <section>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                  <RotateCcw className="h-3.5 w-3.5" /> Return Requests
                  <span className="font-bold text-foreground/60">({returnNotifs.length})</span>
                </p>
                <div className="space-y-2">
                  {returnNotifs.map(n => <NotifCard key={n.id} notif={n} lastRead={lastRead} />)}
                </div>
              </section>
            )}

            <div className="pt-2 text-center">
              <Link href="/shop/account">
                <Button variant="outline" size="sm">
                  View My Account <ArrowRight className="h-4 w-4 ml-1.5" />
                </Button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </ShopLayout>
  );
}

function NotifCard({ notif, lastRead }: { notif: ShopNotif; lastRead: number }) {
  const s = STATUS_STYLE[notif.status] ?? STATUS_STYLE["new"];
  const Icon = notif.type === "return" ? RotateCcw : s.icon;
  const isNew = new Date(notif.createdAt).getTime() > lastRead;

  return (
    <div className={`flex items-start gap-3 p-4 rounded-2xl border transition-all ${isNew ? "bg-primary/5 border-primary/20" : "bg-white border-border"}`}>
      <div className={`flex-shrink-0 w-9 h-9 rounded-full ${s.dot} flex items-center justify-center`}>
        <Icon className="h-4 w-4 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold leading-snug">{notif.title}</p>
          <span className="text-xs text-muted-foreground whitespace-nowrap">{timeAgo(notif.createdAt)}</span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">{notif.subtitle}</p>
        <div className="flex items-center gap-2 mt-2">
          <Badge className={`text-[10px] h-4 px-1.5 border-0 ${s.badge}`}>{notif.status}</Badge>
          {isNew && (
            <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">New</span>
          )}
          {notif.invoiceId && (
            <button
              onClick={(e) => { e.stopPropagation(); window.open(`/api/invoices/${notif.invoiceId}/print`, "_blank"); }}
              className="text-[10px] flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium"
            >
              <FileText className="h-3 w-3" />Invoice
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
