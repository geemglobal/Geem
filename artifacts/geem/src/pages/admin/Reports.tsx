import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { axiosInstance } from "@/lib/axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { TrendingUp, Package, Users, DollarSign, BookOpen } from "lucide-react";

const REPORT_TYPES = [
  { key: "sales", label: "Sales Report", icon: TrendingUp },
  { key: "stock", label: "Stock Report", icon: Package },
  { key: "profit-loss", label: "Profit & Loss", icon: DollarSign },
  { key: "customer-dues", label: "Customer Dues", icon: Users },
  { key: "accounting", label: "Accounting", icon: BookOpen },
];

const PIE_COLORS = ["#22c55e", "#3b82f6", "#f59e0b", "#ef4444"];

export default function Reports() {
  const [active, setActive] = useState("sales");
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 1);
    return d.toISOString().split("T")[0];
  });
  const [dateTo, setDateTo] = useState(new Date().toISOString().split("T")[0]);

  const { data: salesData } = useQuery({
    queryKey: ["report-sales", dateFrom, dateTo],
    queryFn: () => axiosInstance.get<{ totalAmount: number; totalInvoices: number; averageInvoiceValue: number; items: Array<{ id: number; invoiceNumber: string; customerName: string; amount: number; status: string; date: string }> }>(`/reports/sales?from=${dateFrom}&to=${dateTo}`).then(r => r.data),
    enabled: active === "sales",
  });

  const { data: stockData } = useQuery({
    queryKey: ["report-stock"],
    queryFn: () => axiosInstance.get<{ totalItems: number; byStatus: Record<string, number>; items: unknown[] }>("/reports/stock").then(r => r.data),
    enabled: active === "stock",
  });

  const { data: plData } = useQuery({
    queryKey: ["report-pl", dateFrom, dateTo],
    queryFn: () => axiosInstance.get<{ revenue: number; cogs: number; grossProfit: number; expenses: number; courierCharges: number; netProfit: number; chartData: unknown[] }>(`/reports/profit-loss?from=${dateFrom}&to=${dateTo}`).then(r => r.data),
    enabled: active === "profit-loss",
  });

  const { data: duesData } = useQuery({
    queryKey: ["report-dues"],
    queryFn: () => axiosInstance.get<Array<{ customerId: number; customerName: string; customerMobile: string; totalInvoiced: number; totalPaid: number; balanceDue: number }>>("/reports/customer-dues").then(r => r.data),
    enabled: active === "customer-dues",
  });

  const { data: accData } = useQuery({
    queryKey: ["report-accounting"],
    queryFn: () => axiosInstance.get<{
      totalRevenue: number; codPendingAmount: number; codPendingCount: number;
      receivables: number; walletLiability: number; inventoryValue: number;
      inventoryCount: number; cogs: number; grossProfit: number;
      paymentsByMethod: Array<{ method: string; total: number; count: number }>;
    }>("/reports/accounting-summary").then(r => r.data),
    enabled: active === "accounting",
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Reports</h1>
        <p className="text-muted-foreground">Business intelligence and analytics</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {REPORT_TYPES.map(rt => (
          <Button key={rt.key} variant={active === rt.key ? "default" : "outline"} onClick={() => setActive(rt.key)}>
            <rt.icon className="h-4 w-4 mr-2" />{rt.label}
          </Button>
        ))}
      </div>

      {(active === "sales" || active === "profit-loss") && (
        <div className="flex gap-4 items-end">
          <div><Label className="text-xs">From</Label><Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-40" /></div>
          <div><Label className="text-xs">To</Label><Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-40" /></div>
        </div>
      )}

      {active === "sales" && salesData && (
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Total Revenue</p><p className="text-2xl font-bold">Rs {salesData.totalAmount.toLocaleString()}</p></CardContent></Card>
            <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Total Invoices</p><p className="text-2xl font-bold">{salesData.totalInvoices}</p></CardContent></Card>
            <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Avg Invoice Value</p><p className="text-2xl font-bold">Rs {salesData.averageInvoiceValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p></CardContent></Card>
          </div>
          <Card>
            <CardHeader><CardTitle>Recent Invoices</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Invoice #</TableHead><TableHead>Customer</TableHead><TableHead>Date</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {salesData.items.map(i => (
                    <TableRow key={i.id}>
                      <TableCell className="font-mono">{i.invoiceNumber}</TableCell>
                      <TableCell>{i.customerName}</TableCell>
                      <TableCell>{i.date}</TableCell>
                      <TableCell className="text-right font-bold">Rs {i.amount.toLocaleString()}</TableCell>
                      <TableCell><Badge variant={i.status === "paid" ? "default" : "secondary"}>{i.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {active === "stock" && stockData && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle>Stock by Status</CardTitle></CardHeader>
              <CardContent>
                <div className="h-60">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={Object.entries(stockData.byStatus).map(([k, v]) => ({ name: k, value: v }))} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                        {Object.keys(stockData.byStatus).map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            <div className="space-y-3">
              <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Total Items</p><p className="text-3xl font-bold">{stockData.totalItems}</p></CardContent></Card>
              {Object.entries(stockData.byStatus).map(([status, count]) => (
                <Card key={status}><CardContent className="pt-3 pb-3 flex justify-between"><span className="capitalize text-muted-foreground">{status.replace("_", " ")}</span><span className="font-bold">{count}</span></CardContent></Card>
              ))}
            </div>
          </div>
        </div>
      )}

      {active === "profit-loss" && plData && (
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Revenue</p><p className="text-2xl font-bold text-green-600">Rs {plData.revenue.toLocaleString()}</p></CardContent></Card>
            <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Gross Profit</p><p className="text-2xl font-bold">Rs {plData.grossProfit.toLocaleString()}</p></CardContent></Card>
            <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Net Profit</p><p className={`text-2xl font-bold ${plData.netProfit >= 0 ? "text-green-600" : "text-destructive"}`}>Rs {plData.netProfit.toLocaleString()}</p></CardContent></Card>
          </div>
          <Card>
            <CardHeader><CardTitle>P&L Summary</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                {[
                  { label: "Revenue", value: plData.revenue, positive: true },
                  { label: "Cost of Goods Sold", value: -plData.cogs, positive: false },
                  { label: "Gross Profit", value: plData.grossProfit, positive: plData.grossProfit >= 0, bold: true },
                  { label: "Expenses", value: -plData.expenses, positive: false },
                  { label: "Courier Charges", value: -plData.courierCharges, positive: false },
                  { label: "Net Profit", value: plData.netProfit, positive: plData.netProfit >= 0, bold: true },
                ].map(row => (
                  <div key={row.label} className={`flex justify-between py-2 border-b last:border-0 ${row.bold ? "font-bold text-base" : ""}`}>
                    <span className={row.bold ? "" : "text-muted-foreground"}>{row.label}</span>
                    <span className={row.positive ? "text-green-600" : "text-destructive"}>Rs {Math.abs(row.value).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {active === "customer-dues" && duesData && (
        <Card>
          <CardHeader><CardTitle>Customer Outstanding Balances</CardTitle></CardHeader>
          <CardContent>
            {!duesData.length ? (
              <p className="text-center py-8 text-muted-foreground">All customer accounts are settled.</p>
            ) : (
              <Table>
                <TableHeader><TableRow><TableHead>Customer</TableHead><TableHead>Mobile</TableHead><TableHead className="text-right">Balance Due</TableHead></TableRow></TableHeader>
                <TableBody>
                  {duesData.map(c => (
                    <TableRow key={c.customerId}>
                      <TableCell className="font-medium">{c.customerName}</TableCell>
                      <TableCell>{c.customerMobile}</TableCell>
                      <TableCell className={`text-right font-bold ${c.balanceDue > 0 ? "text-destructive" : "text-green-600"}`}>Rs {c.balanceDue.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {active === "accounting" && accData && (
        <div className="space-y-6">
          {/* Top KPI row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="border-green-200 bg-green-50">
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">Total Revenue Collected</p>
                <p className="text-2xl font-bold text-green-700">Rs {accData.totalRevenue.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">COD Pending Collection</p>
                <p className="text-2xl font-bold text-amber-700">Rs {accData.codPendingAmount.toLocaleString()}</p>
                <p className="text-xs text-amber-600 mt-0.5">{accData.codPendingCount} order{accData.codPendingCount !== 1 ? "s" : ""}</p>
              </CardContent>
            </Card>
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">Inventory Value (in stock)</p>
                <p className="text-2xl font-bold text-blue-700">Rs {accData.inventoryValue.toLocaleString()}</p>
                <p className="text-xs text-blue-600 mt-0.5">{accData.inventoryCount} items</p>
              </CardContent>
            </Card>
            <Card className="border-slate-200 bg-slate-50">
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">Wallet Liability</p>
                <p className="text-2xl font-bold text-slate-700">Rs {accData.walletLiability.toLocaleString()}</p>
              </CardContent>
            </Card>
          </div>

          {/* P&L summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle>Gross P&amp;L</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  {[
                    { label: "Revenue (paid invoices)", value: accData.totalRevenue, color: "text-green-600" },
                    { label: "COGS (landed cost of sold items)", value: -accData.cogs, color: "text-destructive" },
                    { label: "Gross Profit", value: accData.grossProfit, color: accData.grossProfit >= 0 ? "text-green-600" : "text-destructive", bold: true },
                    { label: "COD Pending (unremitted)", value: accData.codPendingAmount, color: "text-amber-600" },
                    { label: "Receivables (partial/overdue)", value: accData.receivables, color: "text-blue-600" },
                  ].map(row => (
                    <div key={row.label} className={`flex justify-between py-1.5 border-b last:border-0 ${row.bold ? "font-bold text-base" : ""}`}>
                      <span className={row.bold ? "" : "text-muted-foreground"}>{row.label}</span>
                      <span className={row.color}>Rs {Math.abs(row.value).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Revenue by Payment Method</CardTitle></CardHeader>
              <CardContent>
                {accData.paymentsByMethod.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">No payments recorded yet.</p>
                ) : (
                  <Table>
                    <TableHeader><TableRow><TableHead>Method</TableHead><TableHead className="text-center">Transactions</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {accData.paymentsByMethod.sort((a, b) => b.total - a.total).map(p => (
                        <TableRow key={p.method}>
                          <TableCell className="font-medium capitalize">{p.method}</TableCell>
                          <TableCell className="text-center">{p.count}</TableCell>
                          <TableCell className="text-right font-bold text-green-600">Rs {p.total.toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {active === "accounting" && !accData && (
        <p className="text-center text-muted-foreground py-8">Loading accounting summary…</p>
      )}
    </div>
  );
}
