import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { axiosInstance } from "@/lib/axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, PlusCircle, TrendingUp, TrendingDown, Scale } from "lucide-react";
import { format } from "date-fns";

interface Customer {
  id: number; name: string; mobile: string; type: string;
  city: string | null; email: string | null; ledgerBalance: number;
}
interface LedgerEntry {
  id: number; date: string; type: string; description: string;
  reference: string | null; debit: number; credit: number; balance: number;
}
interface LedgerResponse {
  entries: LedgerEntry[]; totalDebit: number; totalCredit: number; balance: number;
}

const ENTRY_TYPES = [
  { value: "invoice",   label: "Invoice / Sale" },
  { value: "payment",   label: "Payment Received" },
  { value: "advance",   label: "Advance Payment" },
  { value: "return",    label: "Return / Credit" },
  { value: "discount",  label: "Discount" },
  { value: "adjustment",label: "Manual Adjustment" },
  { value: "other",     label: "Other" },
];

const TYPE_COLORS: Record<string, string> = {
  invoice:    "bg-orange-100 text-orange-800",
  payment:    "bg-green-100 text-green-800",
  advance:    "bg-blue-100 text-blue-800",
  return:     "bg-purple-100 text-purple-800",
  discount:   "bg-cyan-100 text-cyan-800",
  adjustment: "bg-gray-100 text-gray-700",
  other:      "bg-gray-100 text-gray-700",
};

function fmtPKR(n: number) {
  return "Rs " + Math.abs(n).toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function CustomerLedger() {
  const [, params] = useRoute("/customers/:id/ledger");
  const [, setLocation] = useLocation();
  const customerId = params?.id ? parseInt(params.id) : 0;
  const qc = useQueryClient();
  const { toast } = useToast();

  const [dlgOpen, setDlgOpen] = useState(false);
  const [form, setForm] = useState({
    date: format(new Date(), "yyyy-MM-dd"),
    type: "payment",
    description: "",
    reference: "",
    debit: "",
    credit: "",
  });

  const { data: customer } = useQuery<Customer>({
    queryKey: ["customer", customerId],
    queryFn: () => axiosInstance.get(`/customers/${customerId}`).then(r => r.data),
    enabled: !!customerId,
  });

  const { data: ledger, isLoading } = useQuery<LedgerResponse>({
    queryKey: ["ledger", customerId],
    queryFn: () => axiosInstance.get(`/customers/${customerId}/ledger`).then(r => r.data),
    enabled: !!customerId,
  });

  const addMut = useMutation({
    mutationFn: () => axiosInstance.post(`/customers/${customerId}/ledger`, {
      ...form,
      date: new Date(form.date).toISOString(),
      debit:  form.debit  ? parseFloat(form.debit)  : 0,
      credit: form.credit ? parseFloat(form.credit) : 0,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ledger", customerId] });
      qc.invalidateQueries({ queryKey: ["customer", customerId] });
      qc.invalidateQueries({ queryKey: ["customers"] });
      setDlgOpen(false);
      setForm({ date: format(new Date(), "yyyy-MM-dd"), type: "payment", description: "", reference: "", debit: "", credit: "" });
      toast({ title: "Ledger entry added" });
    },
    onError: () => toast({ title: "Error adding entry", variant: "destructive" }),
  });

  const entries = ledger?.entries ?? [];
  const totalDebit  = ledger?.totalDebit  ?? 0;
  const totalCredit = ledger?.totalCredit ?? 0;
  const balance     = ledger?.balance     ?? 0;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/customers")} className="h-8 w-8">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Customer Ledger</h1>
          {customer && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {customer.name} · {customer.mobile}
              {customer.city && ` · ${customer.city}`}
            </p>
          )}
        </div>
        <Button size="sm" onClick={() => setDlgOpen(true)}><PlusCircle className="h-4 w-4 mr-1.5" />Add Entry</Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2"><TrendingDown className="h-3.5 w-3.5 text-red-500" />Total Debit (Owed)</div>
          <div className="text-2xl font-bold text-red-600">{fmtPKR(totalDebit)}</div>
          <div className="text-xs text-muted-foreground mt-1">Invoices & charges</div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2"><TrendingUp className="h-3.5 w-3.5 text-green-500" />Total Credit (Paid)</div>
          <div className="text-2xl font-bold text-green-600">{fmtPKR(totalCredit)}</div>
          <div className="text-xs text-muted-foreground mt-1">Payments received</div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2"><Scale className="h-3.5 w-3.5" />Outstanding Balance</div>
          <div className={`text-2xl font-bold ${balance > 0 ? "text-orange-600" : balance < 0 ? "text-green-600" : "text-muted-foreground"}`}>
            {balance === 0 ? "Settled" : (balance > 0 ? "Dr " : "Cr ") + fmtPKR(balance)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">{balance > 0 ? "Customer owes" : balance < 0 ? "Overpaid / advance" : "No outstanding"}</div>
        </div>
      </div>

      {/* Ledger table */}
      <div className="rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Type</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Description</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Reference</th>
                <th className="text-right px-4 py-3 font-medium text-red-600">Debit</th>
                <th className="text-right px-4 py-3 font-medium text-green-600">Credit</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading && (
                <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">Loading…</td></tr>
              )}
              {!isLoading && entries.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-muted-foreground">
                    No ledger entries yet. Add an invoice or payment entry to start.
                  </td>
                </tr>
              )}
              {entries.map(e => (
                <tr key={e.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{format(new Date(e.date), "dd MMM yyyy")}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[e.type] ?? "bg-gray-100 text-gray-700"}`}>
                      {ENTRY_TYPES.find(t => t.value === e.type)?.label ?? e.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 max-w-[200px]">{e.description}</td>
                  <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{e.reference ?? "—"}</td>
                  <td className="px-4 py-3 text-right font-mono">
                    {e.debit > 0 ? <span className="text-red-600">{fmtPKR(e.debit)}</span> : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {e.credit > 0 ? <span className="text-green-600">{fmtPKR(e.credit)}</span> : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-medium">
                    <span className={e.balance > 0 ? "text-orange-600" : e.balance < 0 ? "text-green-600" : "text-muted-foreground"}>
                      {e.balance === 0 ? "0.00" : (e.balance > 0 ? "" : "-") + fmtPKR(e.balance)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            {entries.length > 0 && (
              <tfoot className="border-t bg-muted/20">
                <tr>
                  <td colSpan={4} className="px-4 py-3 font-semibold text-sm text-muted-foreground">Totals</td>
                  <td className="px-4 py-3 text-right font-bold text-red-600 font-mono">{fmtPKR(totalDebit)}</td>
                  <td className="px-4 py-3 text-right font-bold text-green-600 font-mono">{fmtPKR(totalCredit)}</td>
                  <td className="px-4 py-3 text-right font-bold font-mono">
                    <span className={balance > 0 ? "text-orange-600" : balance < 0 ? "text-green-600" : "text-muted-foreground"}>
                      {balance === 0 ? "Settled" : (balance > 0 ? "Dr " : "Cr ") + fmtPKR(balance)}
                    </span>
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Add Entry Dialog */}
      <Dialog open={dlgOpen} onOpenChange={setDlgOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Ledger Entry</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Date *</Label>
                <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Type *</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ENTRY_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs">Description *</Label>
              <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="e.g. Payment received via bank transfer" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Reference</Label>
              <Input value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))} placeholder="Invoice #, receipt #, etc." className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-red-600">Debit (charge)</Label>
                <Input type="number" value={form.debit} onChange={e => setForm(f => ({ ...f, debit: e.target.value, credit: "" }))} placeholder="0.00" className="mt-1" />
              </div>
              <div>
                <Label className="text-xs text-green-600">Credit (payment)</Label>
                <Input type="number" value={form.credit} onChange={e => setForm(f => ({ ...f, credit: e.target.value, debit: "" }))} placeholder="0.00" className="mt-1" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Enter either Debit OR Credit — not both.</p>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setDlgOpen(false)}>Cancel</Button>
            <Button onClick={() => addMut.mutate()} disabled={addMut.isPending || !form.description || !form.type || (!form.debit && !form.credit)}>
              {addMut.isPending ? "Saving…" : "Add Entry"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
