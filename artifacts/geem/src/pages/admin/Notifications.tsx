import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { axiosInstance } from "@/lib/axios";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import {
  ShoppingCart, RotateCcw, CheckCircle2, Truck, XCircle, Clock,
  Bell, BellOff, ArrowRight, RefreshCw, Package, MessageSquare, UserRound,
} from "lucide-react";

interface WebOrder {
  id: number;
  orderNumber: string;
  customerName: string;
  customerMobile: string;
  customerCity: string;
  total: number;
  status: string;
  paymentMethod: string;
  createdAt: string;
}

interface ReturnRequest {
  id: number;
  orderNumber: string;
  customerName: string;
  customerEmail: string | null;
  reason: string;
  status: string;
  createdAt: string;
}

interface ChatSession {
  id: number;
  customerName: string | null;
  customerMobile: string | null;
  status: string;
  aiMode: boolean;
  unreadCount: number;
  lastMessage: string | null;
  updatedAt: string;
  createdAt: string;
}

type NotifType = "new_order" | "return_request" | "order_update" | "chat_human" | "chat_new";

interface NotifItem {
  id: string;
  type: NotifType;
  title: string;
  subtitle: string;
  time: string;
  status: string;
  href: string;
  raw: WebOrder | ReturnRequest | ChatSession;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

const STATUS_META: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  new:          { label: "New",          color: "bg-blue-500",   icon: ShoppingCart  },
  confirmed:    { label: "Confirmed",    color: "bg-indigo-500", icon: CheckCircle2  },
  shipped:      { label: "Shipped",      color: "bg-purple-500", icon: Truck         },
  delivered:    { label: "Delivered",    color: "bg-green-500",  icon: CheckCircle2  },
  cancelled:    { label: "Cancelled",    color: "bg-gray-400",   icon: XCircle       },
  pending:      { label: "Pending",      color: "bg-orange-500", icon: Clock         },
  approved:     { label: "Approved",     color: "bg-green-500",  icon: CheckCircle2  },
  rejected:     { label: "Rejected",     color: "bg-red-500",    icon: XCircle       },
  completed:    { label: "Completed",    color: "bg-teal-500",   icon: CheckCircle2  },
  chat_human:   { label: "Needs Human",  color: "bg-orange-500", icon: UserRound     },
  chat_new:     { label: "Chat",         color: "bg-blue-400",   icon: MessageSquare },
};

function NotifCard({ item, isUnread }: { item: NotifItem; isUnread: boolean }) {
  const meta = STATUS_META[item.status] ?? STATUS_META["new"];
  const Icon = item.type === "return_request" ? RotateCcw : meta.icon;

  return (
    <div className={`flex items-start gap-4 p-4 rounded-xl border transition-all ${isUnread ? "bg-blue-50/60 border-blue-100" : "bg-white border-border"} hover:shadow-sm`}>
      <div className={`flex-shrink-0 w-10 h-10 rounded-full ${meta.color} flex items-center justify-center`}>
        <Icon className="h-5 w-5 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={`text-sm font-semibold leading-snug ${isUnread ? "text-foreground" : "text-foreground/80"}`}>
            {item.title}
          </p>
          <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">{item.time}</span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.subtitle}</p>
        <div className="flex items-center gap-2 mt-2">
          <Badge className={`text-[10px] px-1.5 py-0 h-4 ${meta.color} text-white border-0`}>
            {meta.label}
          </Badge>
          {isUnread && <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 text-blue-600 border-blue-300">New</Badge>}
          <Link href={item.href}>
            <button className="ml-auto text-xs text-primary font-medium hover:underline flex items-center gap-0.5">
              View <ArrowRight className="h-3 w-3" />
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}

const STORAGE_KEY = "geem_notif_last_read";

function getLastRead(): number {
  return parseInt(localStorage.getItem(STORAGE_KEY) ?? "0", 10);
}

function setLastRead() {
  const now = String(Date.now());
  localStorage.setItem(STORAGE_KEY, now);
  window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY, newValue: now }));
}

export default function Notifications() {
  const qc = useQueryClient();

  const { data: ordersData, isLoading: ordersLoading, refetch: refetchOrders } = useQuery({
    queryKey: ["notif-orders-all"],
    queryFn: () => axiosInstance.get<{ orders: WebOrder[] }>("/web-orders").then(r => r.data),
    refetchInterval: 60_000,
  });

  const { data: returns = [], isLoading: returnsLoading, refetch: refetchReturns } = useQuery<ReturnRequest[]>({
    queryKey: ["notif-returns-all"],
    queryFn: () => axiosInstance.get<ReturnRequest[]>("/web-orders/returns").then(r => r.data),
    refetchInterval: 60_000,
  });

  const { data: chatSessions = [], isLoading: chatLoading, refetch: refetchChat } = useQuery<ChatSession[]>({
    queryKey: ["notif-chat-sessions"],
    queryFn: () => axiosInstance.get<ChatSession[]>("/chat/sessions").then(r => r.data.filter(s => s.status === "open")),
    refetchInterval: 10_000,
  });

  const [lastRead, setLastReadState] = useState(getLastRead());

  const orderItems: NotifItem[] = (ordersData?.orders ?? []).map(o => ({
    id: `order-${o.id}`,
    type: o.status === "new" ? "new_order" : "order_update",
    title: o.status === "new"
      ? `New order from ${o.customerName}`
      : `Order ${o.orderNumber} — ${STATUS_META[o.status]?.label ?? o.status}`,
    subtitle: `${o.orderNumber} · Rs ${o.total.toLocaleString()} · ${o.customerCity} · ${o.paymentMethod.toUpperCase()}`,
    time: timeAgo(o.createdAt),
    status: o.status,
    href: "/shop-orders",
    raw: o,
  }));

  const returnItems: NotifItem[] = returns.map(r => ({
    id: `return-${r.id}`,
    type: "return_request" as NotifType,
    title: `Return request — ${r.customerName}`,
    subtitle: `Order ${r.orderNumber} · Reason: ${r.reason} · Status: ${r.status}`,
    time: timeAgo(r.createdAt),
    status: r.status,
    href: "/shop-orders",
    raw: r,
  }));

  const chatItems: NotifItem[] = chatSessions.map(s => ({
    id: `chat-${s.id}`,
    type: (!s.aiMode ? "chat_human" : "chat_new") as NotifType,
    title: !s.aiMode
      ? `🙋 ${s.customerName || "Customer"} needs a human agent`
      : `💬 Chat from ${s.customerName || "Customer"}${s.unreadCount > 0 ? ` (${s.unreadCount} unread)` : ""}`,
    subtitle: s.lastMessage
      ? `Last message: ${s.lastMessage}${s.customerMobile ? ` · ${s.customerMobile}` : ""}`
      : s.customerMobile ?? "No messages yet",
    time: timeAgo(s.updatedAt || s.createdAt),
    status: !s.aiMode ? "chat_human" : "chat_new",
    href: "/chat",
    raw: s,
  }));

  const allItems: NotifItem[] = [...orderItems, ...returnItems, ...chatItems].sort(
    (a, b) => new Date((b.raw as { createdAt: string; updatedAt?: string }).updatedAt || (b.raw as { createdAt: string }).createdAt).getTime()
            - new Date((a.raw as { createdAt: string; updatedAt?: string }).updatedAt || (a.raw as { createdAt: string }).createdAt).getTime()
  );

  const actionItems = allItems.filter(i =>
    i.type === "new_order" ||
    i.type === "chat_human" ||
    (i.type === "return_request" && (i.raw as ReturnRequest).status === "pending")
  );
  const activityItems = allItems.filter(i =>
    i.type === "order_update" ||
    i.type === "chat_new" ||
    (i.type === "return_request" && (i.raw as ReturnRequest).status !== "pending")
  );

  const unreadCount = allItems.filter(i => {
    const ts = (i.raw as { updatedAt?: string; createdAt: string }).updatedAt || (i.raw as { createdAt: string }).createdAt;
    return new Date(ts).getTime() > lastRead;
  }).length;

  function markAllRead() {
    setLastRead();
    setLastReadState(Date.now());
    qc.invalidateQueries({ queryKey: ["notif-bell-count"] });
  }

  function handleRefresh() {
    refetchOrders();
    refetchReturns();
    refetchChat();
  }

  const isLoading = ordersLoading || returnsLoading || chatLoading;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Bell className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Notifications</h1>
              <p className="text-xs text-muted-foreground">
                {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
            {unreadCount > 0 && (
              <Button variant="outline" size="sm" onClick={markAllRead}>
                <BellOff className="h-4 w-4 mr-1.5" />
                Mark all read
              </Button>
            )}
          </div>
        </div>

        {/* Action Required */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Action Required</h2>
            {actionItems.length > 0 && (
              <span className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                {actionItems.length}
              </span>
            )}
          </div>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-20 rounded-xl bg-gray-100 animate-pulse" />
              ))}
            </div>
          ) : actionItems.length === 0 ? (
            <div className="rounded-xl border bg-white p-8 text-center">
              <CheckCircle2 className="h-10 w-10 mx-auto mb-3 text-green-500 opacity-60" />
              <p className="font-medium text-sm text-muted-foreground">No pending actions</p>
              <p className="text-xs text-muted-foreground mt-1">All orders and return requests are up to date</p>
            </div>
          ) : (
            <div className="space-y-2">
              {actionItems.map(item => (
                <NotifCard
                  key={item.id}
                  item={item}
                  isUnread={new Date((item.raw as { createdAt: string }).createdAt).getTime() > lastRead}
                />
              ))}
            </div>
          )}
        </div>

        {/* Recent Activity */}
        {activityItems.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Recent Activity</h2>
              <span className="text-xs text-muted-foreground">({activityItems.length})</span>
            </div>
            <div className="space-y-2">
              {activityItems.slice(0, 20).map(item => (
                <NotifCard
                  key={item.id}
                  item={item}
                  isUnread={new Date((item.raw as { createdAt: string }).createdAt).getTime() > lastRead}
                />
              ))}
            </div>
            {activityItems.length > 20 && (
              <div className="mt-3 text-center">
                <Link href="/shop-orders">
                  <Button variant="outline" size="sm">
                    <Package className="h-4 w-4 mr-1.5" />
                    View all orders
                  </Button>
                </Link>
              </div>
            )}
          </div>
        )}

        {!isLoading && allItems.length === 0 && (
          <div className="rounded-xl border bg-white p-16 text-center">
            <Bell className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-30" />
            <p className="font-semibold text-muted-foreground">No notifications yet</p>
            <p className="text-sm text-muted-foreground mt-1">New orders and return requests will appear here</p>
          </div>
        )}
    </div>
  );
}
