import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { axiosInstance } from "@/lib/axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  Wallet, Users, TrendingUp, TrendingDown, Plus, ExternalLink,
  ArrowUpCircle, ArrowDownCircle, RefreshCw, Search,
} from "lucide-react";
import { formatPakDateTime } from "@/lib/format";

interface WalletCustomer {
  id: number;
  name: string;
  mobile: string;
  walletBalance: number;
}

interface WalletTx {
  id: number;
  customerId: number;
  customerName: string;
  type: "credit" | "debit";
  amount: number;
  balanceAfter: number;
  description: string;
  reference: string | null;
  createdAt: string;
}

interface Overview {
  totalLiability: number;
  customersWithBalance: number;
  creditThisMonth: number;
  debitThisMonth: number;
  customers: WalletCustomer[];
  recentTransactions: WalletTx[];
}

function StatCard({
  title, value, icon, color, sub,
}: { title: string; value: string; icon: React.ReactNode; color: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground mb-1">{title}</p>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <div className={`p-2 rounded-lg bg-muted`}>{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function WalletManagement() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [tab, setTab] = useState<"customers" | "history">("customers");
  const [txFilter, setTxFilter] = useState<"all" | "credit" | "debit">("all");
  const [txSearch, setTxSearch] = useState("");

  // Credit dialog
  const [creditTarget, setCreditTarget] = useState<WalletCustomer | null>(null);
  const [creditAmount, setCreditAmount] = useState("");
  const [creditDesc, setCreditDesc] = useState("");
  const [creditRef, setCreditRef] = useState("");

  const { data, isLoading, refetch } = useQuery<Overview>({
    queryKey: ["wallet-overview"],
    queryFn: () => axiosInstance.get<Overview>("/wallet/overview").then(r => r.data),
    staleTime: 30_000,
  });

  const creditMutation = useMutation({
    mutationFn: ({ id, amount, description, reference }: { id: number; amount: number; description: string; reference: string }) =>
      axiosInstance.post(`/customers/${id}/wallet/credit`, { amount, description, reference: reference || undefined }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wallet-overview"] });
      qc.invalidateQueries({ queryKey: ["customers"] });
      toast({ title: "Wallet credited successfully" });
      setCreditTarget(null);
      setCreditAmount("");
      setCreditDesc("");
      setCreditRef("");
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Failed to credit wallet";
      toast({ title: msg, variant: "destructive" });
    },
  });

  const filteredTxs = (data?.recentTransactions ?? []).filter(t => {
    const matchType = txFilter === "all" || t.type === txFilter;
    const matchSearch = !txSearch || t.customerName.toLowerCase().includes(txSearch.toLowerCase()) ||
      t.description.toLowerCase().includes(txSearch.toLowerCase()) ||
      (t.reference ?? "").toLowerCase().includes(txSearch.toLowerCase());
    return matchType && matchSearch;
  });

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Wallet Management</h1>
          <p className="text-sm text-muted-foreground">Customer wallet balances &amp; transaction history</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-1.5 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Wallet Liability"
          value={`Rs ${(data?.totalLiability ?? 0).toLocaleString()}`}
          icon={<Wallet className="h-5 w-5 text-orange-500" />}
          color={(data?.totalLiability ?? 0) > 0 ? "text-orange-600" : "text-foreground"}
          sub="Owed to customers"
        />
        <StatCard
          title="Customers with Balance"
          value={String(data?.customersWithBalance ?? 0)}
          icon={<Users className="h-5 w-5 text-blue-500" />}
          color="text-blue-600"
          sub="Active wallet holders"
        />
        <StatCard
          title="Credits This Month"
          value={`Rs ${(data?.creditThisMonth ?? 0).toLocaleString()}`}
          icon={<TrendingUp className="h-5 w-5 text-green-500" />}
          color="text-green-600"
          sub="Return refunds added"
        />
        <StatCard
          title="Debits This Month"
          value={`Rs ${(data?.debitThisMonth ?? 0).toLocaleString()}`}
          icon={<TrendingDown className="h-5 w-5 text-red-500" />}
          color="text-red-600"
          sub="Used at checkout"
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {(["customers", "history"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "customers" ? `Customers with Balance (${data?.customers.length ?? 0})` : "Transaction History"}
          </button>
        ))}
      </div>

      {/* Tab: Customers with Balance */}
      {tab === "customers" && (
        <Card>
          <CardContent className="pt-0">
            {isLoading ? (
              <p className="text-center py-12 text-muted-foreground">Loading…</p>
            ) : !data?.customers.length ? (
              <div className="text-center py-16 text-muted-foreground">
                <Wallet className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No customers have a wallet balance</p>
                <p className="text-xs mt-1">Credit a customer's wallet from their detail page or below.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Mobile</TableHead>
                    <TableHead>Wallet Balance</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.customers.map(c => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">
                        <button
                          onClick={() => navigate(`/customers/${c.id}`)}
                          className="hover:underline text-left flex items-center gap-1 group"
                        >
                          {c.name}
                          <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{c.mobile}</TableCell>
                      <TableCell>
                        <span className="text-lg font-bold text-green-700">
                          Rs {c.walletBalance.toLocaleString()}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => setCreditTarget(c)}>
                            <Plus className="h-3.5 w-3.5 mr-1" /> Credit
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => navigate(`/customers/${c.id}`)}>
                            View
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab: Transaction History */}
      {tab === "history" && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search customer, description, reference…"
                  value={txSearch}
                  onChange={e => setTxSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex gap-1">
                {(["all", "credit", "debit"] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setTxFilter(f)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      txFilter === f
                        ? f === "credit"
                          ? "bg-green-100 text-green-800"
                          : f === "debit"
                          ? "bg-red-100 text-red-800"
                          : "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {isLoading ? (
              <p className="text-center py-12 text-muted-foreground">Loading…</p>
            ) : filteredTxs.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <p>No transactions found</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Balance After</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Reference</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTxs.map(tx => (
                    <TableRow key={tx.id}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatPakDateTime(tx.createdAt, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })}
                      </TableCell>
                      <TableCell>
                        <button
                          onClick={() => navigate(`/customers/${tx.customerId}`)}
                          className="hover:underline text-left flex items-center gap-1 group font-medium"
                        >
                          {tx.customerName}
                          <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      </TableCell>
                      <TableCell>
                        {tx.type === "credit" ? (
                          <span className="inline-flex items-center gap-1 text-green-700 font-medium text-sm">
                            <ArrowUpCircle className="h-3.5 w-3.5" /> Credit
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-red-600 font-medium text-sm">
                            <ArrowDownCircle className="h-3.5 w-3.5" /> Debit
                          </span>
                        )}
                      </TableCell>
                      <TableCell className={`font-semibold ${tx.type === "credit" ? "text-green-700" : "text-red-600"}`}>
                        {tx.type === "credit" ? "+" : "−"}Rs {tx.amount.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        Rs {tx.balanceAfter.toLocaleString()}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm">{tx.description}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {tx.reference ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Credit Dialog */}
      <Dialog open={!!creditTarget} onOpenChange={open => { if (!open) setCreditTarget(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Credit Wallet — {creditTarget?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <p className="text-sm text-muted-foreground mb-3">
                Current balance: <span className="font-semibold text-green-700">Rs {(creditTarget?.walletBalance ?? 0).toLocaleString()}</span>
              </p>
            </div>
            <div>
              <Label className="text-xs">Amount (Rs) *</Label>
              <Input
                type="number"
                min="1"
                value={creditAmount}
                onChange={e => setCreditAmount(e.target.value)}
                placeholder="0"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Reason / Description *</Label>
              <Input
                value={creditDesc}
                onChange={e => setCreditDesc(e.target.value)}
                placeholder="e.g. Return refund for parcel #1234"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Reference No. (optional)</Label>
              <Input
                value={creditRef}
                onChange={e => setCreditRef(e.target.value)}
                placeholder="Invoice / order / return number"
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreditTarget(null)}>Cancel</Button>
            <Button
              onClick={() => {
                if (!creditTarget || !creditAmount || !creditDesc) return;
                creditMutation.mutate({
                  id: creditTarget.id,
                  amount: parseFloat(creditAmount),
                  description: creditDesc,
                  reference: creditRef,
                });
              }}
              disabled={!creditAmount || !creditDesc || creditMutation.isPending}
            >
              {creditMutation.isPending ? "Crediting…" : "Add Credit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
