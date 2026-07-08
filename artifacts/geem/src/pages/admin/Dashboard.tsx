import { useState, useRef, useEffect } from "react";
import { useGetDashboardStats, useGetDashboardRecentSales, useGetDashboardRevenue } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { axiosInstance } from "@/lib/axios";
import { imeiLabel } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, Legend } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Package, ShoppingCart, AlertCircle, TrendingUp, Boxes, ShieldCheck, ShieldAlert, DollarSign, Search, X, RotateCcw, Bell, Mail, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const PIE_COLORS = ["#22c55e", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899"];

function StatCard({ title, value, subtitle, icon: Icon, color = "default" }: {
  title: string; value: string | number; subtitle?: string;
  icon: React.ElementType; color?: "default" | "green" | "blue" | "red" | "orange";
}) {
  const colorMap = { default: "text-primary", green: "text-green-600", blue: "text-blue-600", red: "text-destructive", orange: "text-orange-600" };
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{title}</p>
            <p className={`text-2xl font-bold mt-1 ${colorMap[color]}`}>{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          </div>
          <div className={`p-2 rounded-lg bg-muted ${colorMap[color]}`}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface SearchResult {
  inventory: Array<{ id: number; imei: string; deviceId: string | null; brandName: string; modelName: string; status: string; ptaStatus: string; sellingPrice: number }>;
  customers: Array<{ id: number; name: string; phone: string | null; email: string | null; cnic: string | null }>;
  invoices: Array<{ id: number; invoiceNumber: string; status: string; total: number; date: string }>;
}

function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data } = useQuery({
    queryKey: ["global-search", query],
    queryFn: () => axiosInstance.get<SearchResult>(`/search?q=${encodeURIComponent(query)}`).then(r => r.data),
    enabled: query.length >= 2,
    staleTime: 10000,
  });

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const hasResults = data && (data.inventory.length > 0 || data.customers.length > 0 || data.invoices.length > 0);

  return (
    <div ref={ref} className="relative w-full max-w-lg">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Search IMEI, device ID, customer name, invoice…"
          className="pl-9 pr-8"
        />
        {query && (
          <button onClick={() => { setQuery(""); setOpen(false); }} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {open && query.length >= 2 && (
        <div className="absolute z-50 mt-1 w-full bg-card border rounded-lg shadow-xl max-h-[420px] overflow-y-auto">
          {!hasResults && (
            <div className="p-4 text-sm text-muted-foreground text-center">
              {query.length < 2 ? "Type at least 2 characters" : "No results found"}
            </div>
          )}

          {(data?.inventory?.length ?? 0) > 0 && (
            <div>
              <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-muted/50 border-b">Inventory</div>
              {data?.inventory.map(item => (
                <Link key={item.id} href="/inventory">
                  <div className="px-4 py-2.5 hover:bg-muted cursor-pointer border-b last:border-0" onClick={() => setOpen(false)}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{item.brandName} {item.modelName}</p>
                        <p className="text-xs font-mono text-muted-foreground">{imeiLabel(item.imei)}: {item.imei}{item.deviceId ? ` | ID: ${item.deviceId}` : ""}</p>
                      </div>
                      <div className="text-right">
                        <Badge variant={item.status === "in_stock" ? "default" : "secondary"} className="text-xs">{item.status}</Badge>
                        <p className="text-xs text-muted-foreground mt-1">Rs {item.sellingPrice.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {(data?.customers?.length ?? 0) > 0 && (
            <div>
              <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-muted/50 border-b">Customers</div>
              {data?.customers.map(c => (
                <Link key={c.id} href={`/customers`}>
                  <div className="px-4 py-2.5 hover:bg-muted cursor-pointer border-b last:border-0" onClick={() => setOpen(false)}>
                    <p className="text-sm font-medium">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{[c.phone, c.email].filter(Boolean).join(" · ")}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {(data?.invoices?.length ?? 0) > 0 && (
            <div>
              <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-muted/50 border-b">Invoices</div>
              {data?.invoices.map(inv => (
                <Link key={inv.id} href={`/invoices/${inv.id}`}>
                  <div className="px-4 py-2.5 hover:bg-muted cursor-pointer border-b last:border-0" onClick={() => setOpen(false)}>
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">{inv.invoiceNumber}</p>
                      <div className="text-right">
                        <Badge variant={inv.status === "paid" ? "default" : "secondary"} className="text-xs">{inv.status}</Badge>
                        <p className="text-xs text-muted-foreground mt-1">Rs {inv.total.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface AlertItem {
  id: number;
  type: "return" | "order";
  title: string;
  subtitle: string;
  time: string;
  href: string;
}

function AlertsPanel() {
  const { data: pendingReturns = [] } = useQuery<{ id: number; orderNumber: string; customerName: string; reason: string; createdAt: string }[]>({
    queryKey: ["dashboard-pending-returns"],
    queryFn: () => axiosInstance.get("/web-orders/returns?status=pending").then(r => r.data),
    refetchInterval: 30_000,
  });
  const { data: newOrders = [] } = useQuery<{ id: number; orderNumber: string; customerName: string; total: number; createdAt: string }[]>({
    queryKey: ["dashboard-new-orders"],
    queryFn: () => axiosInstance.get<{ orders: { id: number; orderNumber: string; customerName: string; total: number; createdAt: string }[] }>("/web-orders?status=new").then(r => r.data.orders),
    refetchInterval: 30_000,
  });

  const alerts: AlertItem[] = [
    ...pendingReturns.map(r => ({
      id: r.id,
      type: "return" as const,
      title: `Return: ${r.orderNumber}`,
      subtitle: `${r.customerName} · ${r.reason.replace(/_/g, " ")}`,
      time: new Date(r.createdAt).toLocaleDateString("en-PK", { timeZone: "Asia/Karachi", day: "2-digit", month: "short", year: "numeric" }),
      href: "/shop-orders",
    })),
    ...newOrders.map(o => ({
      id: o.id,
      type: "order" as const,
      title: `New Order: ${o.orderNumber}`,
      subtitle: `${o.customerName} · Rs ${o.total.toLocaleString()}`,
      time: new Date(o.createdAt).toLocaleDateString("en-PK", { timeZone: "Asia/Karachi", day: "2-digit", month: "short", year: "numeric" }),
      href: "/shop-orders",
    })),
  ].sort((a, b) => (a.time < b.time ? 1 : -1)).slice(0, 8);

  const total = pendingReturns.length + newOrders.length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-orange-500" />
            Action Required
            {total > 0 && (
              <span className="bg-orange-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">{total}</span>
            )}
          </span>
          <Link href="/shop-orders" className="text-xs text-muted-foreground hover:text-primary font-normal">View all →</Link>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-0 pt-0">
        {alerts.length === 0 ? (
          <div className="flex flex-col items-center py-6 text-muted-foreground">
            <ShieldCheck className="h-8 w-8 mb-2 opacity-30" />
            <p className="text-sm">All caught up — no pending items</p>
          </div>
        ) : (
          <div className="divide-y">
            {alerts.map(a => (
              <Link key={`${a.type}-${a.id}`} href={a.href}>
                <div className="flex items-start gap-3 px-4 py-3 hover:bg-muted/50 cursor-pointer transition-colors">
                  <div className={`mt-0.5 p-1.5 rounded-lg flex-shrink-0 ${a.type === "return" ? "bg-orange-100 text-orange-600" : "bg-blue-100 text-blue-600"}`}>
                    {a.type === "return" ? <RotateCcw className="h-3.5 w-3.5" /> : <ShoppingCart className="h-3.5 w-3.5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{a.title}</p>
                    <p className="text-xs text-muted-foreground truncate capitalize">{a.subtitle}</p>
                  </div>
                  <span className="text-xs text-muted-foreground flex-shrink-0 mt-0.5">{a.time}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { data: stats } = useGetDashboardStats({ query: { queryKey: ["dashboard-stats"] } });
  const { data: recentSales } = useGetDashboardRecentSales({ query: { queryKey: ["dashboard-recent-sales"] } });
  const { data: revenueData } = useGetDashboardRevenue(undefined, { query: { queryKey: ["dashboard-revenue"] } });
  const [lowStockLoading, setLowStockLoading] = useState(false);
  const { toast } = useToast();

  async function sendLowStockAlert() {
    setLowStockLoading(true);
    try {
      const r = await axiosInstance.post("/dashboard/alerts/low-stock");
      if (r.data.count === 0) {
        toast({ title: "No low-stock items", description: "All models have sufficient stock — nothing to alert." });
      } else {
        toast({ title: "Alert sent!", description: r.data.message });
      }
    } catch {
      toast({ title: "Failed", description: "Could not send alert — check email settings.", variant: "destructive" });
    } finally {
      setLowStockLoading(false);
    }
  }

  const { data: byBrand } = useQuery({
    queryKey: ["inventory-by-brand"],
    queryFn: () => axiosInstance.get<{ brand: string; count: number }[]>("/inventory/stats/by-brand").then(r => r.data),
  });
  const { data: byStatus } = useQuery({
    queryKey: ["inventory-by-status"],
    queryFn: () => axiosInstance.get<{ status: string; count: number }[]>("/inventory/stats/by-status").then(r => r.data),
  });
  const { data: byPta } = useQuery({
    queryKey: ["inventory-by-pta"],
    queryFn: () => axiosInstance.get<{ ptaStatus: string; count: number }[]>("/inventory/stats/by-pta").then(r => r.data),
  });

  const totalInventory = byStatus?.reduce((s, r) => s + r.count, 0) ?? 0;
  const inStock = byStatus?.find(r => r.status === "in_stock")?.count ?? 0;
  const sold = byStatus?.find(r => r.status === "sold")?.count ?? 0;
  const ptaUnpaid = byPta?.find(r => r.ptaStatus === "unpaid")?.count ?? 0;
  const ptaPaid = byPta?.find(r => r.ptaStatus === "paid")?.count ?? 0;

  const statusPieData = byStatus?.map(r => ({ name: r.status.replace(/_/g, " "), value: r.count })) ?? [];
  const ptaPieData = byPta?.map(r => ({ name: r.ptaStatus.replace(/_/g, " "), value: r.count })) ?? [];

  return (
    <div className="space-y-6">
      {/* Header + Search */}
      <div className="flex flex-col md:flex-row md:items-center gap-4 justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Geem CRM — Overview</p>
        </div>
        <GlobalSearch />
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Today's Sales" value={`Rs ${(stats?.totalSalesToday ?? 0).toLocaleString()}`} icon={DollarSign} color="green" />
        <StatCard title="Total Inventory" value={totalInventory.toLocaleString()} subtitle={`${inStock.toLocaleString()} in stock`} icon={Boxes} color="blue" />
        <StatCard title="Sold" value={sold.toLocaleString()} subtitle="All time" icon={ShoppingCart} />
        <StatCard title="PTA Unpaid" value={ptaUnpaid.toLocaleString()} subtitle={`${ptaPaid.toLocaleString()} paid`} icon={ShieldAlert} color="red" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Pending Orders" value={stats?.totalOrdersPending ?? 0} icon={Package} color="orange" />
        <StatCard title="Overdue Invoices" value={stats?.totalOverdueInvoices ?? 0} icon={AlertCircle} color="red" />
        <StatCard title="Total Customers" value={stats?.totalCustomers ?? 0} icon={TrendingUp} />
        <StatCard title="PTA Approved" value={byPta?.find(r => r.ptaStatus === "approved")?.count ?? 0} icon={ShieldCheck} color="green" />
      </div>

      {/* Alerts */}
      <AlertsPanel />

      {/* Revenue + Recent Sales */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="col-span-2">
          <CardHeader><CardTitle>Revenue Overview (Last 30 Days)</CardTitle></CardHeader>
          <CardContent>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueData ?? []} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => [`Rs ${v.toLocaleString()}`, "Revenue"]} />
                  <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorRevenue)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Recent Sales</CardTitle></CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Invoice</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead className="pr-4">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentSales?.length ? recentSales.map((sale) => (
                  <TableRow key={sale.id}>
                    <TableCell className="pl-4 font-medium text-sm">
                      <Link href={`/invoices/${sale.id}`}><span className="hover:underline cursor-pointer">{sale.invoiceNumber}</span></Link>
                    </TableCell>
                    <TableCell className="text-sm">Rs {sale.amount.toLocaleString()}</TableCell>
                    <TableCell className="pr-4">
                      <Badge variant={sale.status === "paid" ? "default" : "secondary"} className="text-xs">{sale.status}</Badge>
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-6 text-sm">No sales yet</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Quick Email Alerts */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Mail className="h-4 w-4 text-blue-600" />
            Quick Email Alerts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3 items-center">
            <Button variant="outline" onClick={sendLowStockAlert} disabled={lowStockLoading}>
              {lowStockLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <AlertCircle className="h-4 w-4 mr-2 text-orange-500" />}
              Send Low-Stock Alert to Admin
            </Button>
            <p className="text-xs text-muted-foreground">Emails a list of items with ≤2 units in stock to the admin email configured in Settings → Integrations.</p>
          </div>
        </CardContent>
      </Card>

      {/* Inventory Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Inventory by Brand
              <Link href="/inventory" className="text-xs text-muted-foreground hover:text-primary font-normal">View all →</Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byBrand ?? []} margin={{ top: 0, right: 10, left: 0, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="brand" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" interval={0} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} name="Devices" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-sm">By Status</CardTitle></CardHeader>
            <CardContent>
              <div className="h-[160px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={statusPieData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={2} dataKey="value">
                      {statusPieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => [v.toLocaleString(), "Count"]} />
                    <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: 10 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm">PTA Status</CardTitle></CardHeader>
            <CardContent>
              <div className="h-[160px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={ptaPieData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={2} dataKey="value">
                      {ptaPieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => [v.toLocaleString(), "Count"]} />
                    <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: 10 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
