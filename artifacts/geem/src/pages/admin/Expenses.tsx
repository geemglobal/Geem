import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { axiosInstance } from "@/lib/axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { PlusCircle, Pencil, Trash2, TrendingDown, Calendar, Tag, Receipt, Download } from "lucide-react";
import { format } from "date-fns";

interface ExpenseCategory { id: number; name: string; color: string; description: string | null; }
interface Expense {
  id: number; date: string; categoryId: number | null; categoryName: string | null;
  amount: number; description: string; reference: string | null;
  paymentMethod: string; vendor: string | null; notes: string | null;
}

const METHODS = [
  { value: "cash", label: "Cash" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "cheque", label: "Cheque" },
  { value: "card", label: "Card" },
  { value: "online", label: "Online" },
];

const METHOD_COLORS: Record<string, string> = {
  cash: "bg-green-100 text-green-800",
  bank_transfer: "bg-blue-100 text-blue-800",
  cheque: "bg-purple-100 text-purple-800",
  card: "bg-orange-100 text-orange-800",
  online: "bg-cyan-100 text-cyan-800",
};

function fmtPKR(n: number) {
  return "Rs " + n.toLocaleString("en-PK", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export default function Expenses() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [filterCategory, setFilterCategory] = useState("all");
  const [filterMethod, setFilterMethod] = useState("all");
  const [filterMonth, setFilterMonth] = useState(format(new Date(), "yyyy-MM"));
  const [showAll, setShowAll] = useState(false);

  const [dlgOpen, setDlgOpen] = useState(false);
  const [catDlgOpen, setCatDlgOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState({
    date: format(new Date(), "yyyy-MM-dd"), categoryId: "", amount: "",
    description: "", reference: "", paymentMethod: "cash", vendor: "", notes: "",
  });
  const [catForm, setCatForm] = useState({ name: "", description: "", color: "#6b7280" });

  const { data: cats = [] } = useQuery<ExpenseCategory[]>({
    queryKey: ["expense-categories"],
    queryFn: () => axiosInstance.get("/expense-categories").then(r => r.data),
  });

  const from = showAll ? undefined : `${filterMonth}-01`;
  const to   = showAll ? undefined : format(new Date(
    parseInt(filterMonth.split("-")[0]), parseInt(filterMonth.split("-")[1]), 0
  ), "yyyy-MM-dd");

  const { data: expData, isLoading } = useQuery<{ expenses: Expense[]; total: number; monthlyTotals: { month: string; total: string }[] }>({
    queryKey: ["expenses", filterCategory, filterMethod, filterMonth, showAll],
    queryFn: () => {
      const params = new URLSearchParams({ limit: "500" });
      if (filterCategory !== "all") params.set("categoryId", filterCategory);
      if (filterMethod !== "all") params.set("paymentMethod", filterMethod);
      if (!showAll && from) params.set("dateFrom", from + "T00:00:00");
      if (!showAll && to)   params.set("dateTo",   to   + "T23:59:59");
      return axiosInstance.get(`/expenses?${params}`).then(r => r.data);
    },
  });

  const expenses = expData?.expenses ?? [];
  const totalShown = expData?.total ?? 0;

  // Summary
  const now = new Date();
  const startOfMonth = `${format(now, "yyyy-MM")}-01T00:00:00`;
  const endOfMonth   = format(new Date(now.getFullYear(), now.getMonth() + 1, 0), "yyyy-MM-dd") + "T23:59:59";
  const startOfYear  = `${now.getFullYear()}-01-01T00:00:00`;

  const { data: monthData } = useQuery<{ expenses: Expense[]; total: number }>({
    queryKey: ["expenses-month"],
    queryFn: () => axiosInstance.get(`/expenses?dateFrom=${startOfMonth}&dateTo=${endOfMonth}&limit=1`).then(r => r.data),
  });
  const { data: yearData } = useQuery<{ expenses: Expense[]; total: number }>({
    queryKey: ["expenses-year"],
    queryFn: () => axiosInstance.get(`/expenses?dateFrom=${startOfYear}&limit=1`).then(r => r.data),
  });

  const saveMut = useMutation({
    mutationFn: async (data: typeof form) => {
      const payload = {
        ...data,
        amount: parseFloat(data.amount),
        categoryId: data.categoryId ? parseInt(data.categoryId) : null,
        date: new Date(data.date).toISOString(),
      };
      if (editing) return axiosInstance.patch(`/expenses/${editing.id}`, payload);
      return axiosInstance.post("/expenses", payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["expenses-month"] });
      qc.invalidateQueries({ queryKey: ["expenses-year"] });
      setDlgOpen(false);
      setEditing(null);
      toast({ title: editing ? "Expense updated" : "Expense recorded" });
    },
    onError: () => toast({ title: "Error saving expense", variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => axiosInstance.delete(`/expenses/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["expenses-month"] });
      qc.invalidateQueries({ queryKey: ["expenses-year"] });
      setDeleteId(null);
      toast({ title: "Expense deleted" });
    },
  });

  const saveCatMut = useMutation({
    mutationFn: () => axiosInstance.post("/expense-categories", catForm),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expense-categories"] });
      setCatDlgOpen(false);
      setCatForm({ name: "", description: "", color: "#6b7280" });
      toast({ title: "Category added" });
    },
  });

  function openAdd() {
    setEditing(null);
    setForm({ date: format(new Date(), "yyyy-MM-dd"), categoryId: "", amount: "", description: "", reference: "", paymentMethod: "cash", vendor: "", notes: "" });
    setDlgOpen(true);
  }
  function openEdit(e: Expense) {
    setEditing(e);
    setForm({
      date: format(new Date(e.date), "yyyy-MM-dd"),
      categoryId: e.categoryId ? String(e.categoryId) : "",
      amount: String(e.amount),
      description: e.description,
      reference: e.reference ?? "",
      paymentMethod: e.paymentMethod,
      vendor: e.vendor ?? "",
      notes: e.notes ?? "",
    });
    setDlgOpen(true);
  }

  function downloadCSV() {
    const rows = [["Date","Category","Description","Vendor","Payment Method","Reference","Amount"]];
    for (const e of expenses) {
      rows.push([
        format(new Date(e.date), "dd-MMM-yyyy"),
        e.categoryName ?? "",
        e.description,
        e.vendor ?? "",
        e.paymentMethod,
        e.reference ?? "",
        e.amount.toString(),
      ]);
    }
    const csv = rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `expenses-${filterMonth}.csv`;
    a.click();
  }

  const byCat = cats.map(c => ({
    ...c,
    total: expenses.filter(e => e.categoryId === c.id).reduce((s, e) => s + e.amount, 0),
  })).filter(c => c.total > 0).sort((a, b) => b.total - a.total);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Expense Management</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Track operational and project expenses</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={downloadCSV}><Download className="h-4 w-4 mr-1.5" />Export CSV</Button>
          <Button variant="outline" size="sm" onClick={() => setCatDlgOpen(true)}><Tag className="h-4 w-4 mr-1.5" />Categories</Button>
          <Button size="sm" onClick={openAdd}><PlusCircle className="h-4 w-4 mr-1.5" />Add Expense</Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2"><Calendar className="h-3.5 w-3.5" />This Month</div>
          <div className="text-2xl font-bold text-destructive">{fmtPKR(monthData?.total ?? 0)}</div>
          <div className="text-xs text-muted-foreground mt-1">{format(now, "MMMM yyyy")}</div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2"><TrendingDown className="h-3.5 w-3.5" />This Year</div>
          <div className="text-2xl font-bold text-destructive">{fmtPKR(yearData?.total ?? 0)}</div>
          <div className="text-xs text-muted-foreground mt-1">{now.getFullYear()}</div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2"><Receipt className="h-3.5 w-3.5" />Shown Period</div>
          <div className="text-2xl font-bold text-destructive">{fmtPKR(totalShown)}</div>
          <div className="text-xs text-muted-foreground mt-1">{expenses.length} expenses</div>
        </div>
      </div>

      {/* By-category mini chart */}
      {byCat.length > 0 && (
        <div className="rounded-xl border bg-card p-4">
          <div className="text-sm font-medium mb-3">Breakdown by Category</div>
          <div className="space-y-2">
            {byCat.slice(0, 6).map(c => {
              const pct = totalShown > 0 ? Math.round((c.total / totalShown) * 100) : 0;
              return (
                <div key={c.id} className="flex items-center gap-3 text-sm">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: c.color ?? "#6b7280" }} />
                  <span className="w-44 truncate text-muted-foreground">{c.name}</span>
                  <div className="flex-1 bg-muted rounded-full h-1.5">
                    <div className="h-1.5 rounded-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-20 text-right font-medium">{fmtPKR(c.total)}</span>
                  <span className="w-10 text-right text-muted-foreground">{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">Month</Label>
          <Input type="month" value={filterMonth} onChange={e => { setFilterMonth(e.target.value); setShowAll(false); }} className="w-40 h-8 text-sm" />
        </div>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-44 h-8 text-sm"><SelectValue placeholder="All Categories" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {cats.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterMethod} onValueChange={setFilterMethod}>
          <SelectTrigger className="w-40 h-8 text-sm"><SelectValue placeholder="All Methods" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Methods</SelectItem>
            {METHODS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="ghost" size="sm" onClick={() => setShowAll(v => !v)} className="h-8 text-sm">
          {showAll ? "Filter by Month" : "Show All Time"}
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Category</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Description</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Vendor</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Method</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Reference</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Amount</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading && (
                <tr><td colSpan={8} className="text-center py-12 text-muted-foreground">Loading…</td></tr>
              )}
              {!isLoading && expenses.length === 0 && (
                <tr><td colSpan={8} className="text-center py-12 text-muted-foreground">No expenses found for this period.</td></tr>
              )}
              {expenses.map(e => (
                <tr key={e.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{format(new Date(e.date), "dd MMM yyyy")}</td>
                  <td className="px-4 py-3">
                    {e.categoryName
                      ? <span className="inline-flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cats.find(c => c.id === e.categoryId)?.color ?? "#6b7280" }} />
                          {e.categoryName}
                        </span>
                      : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-3 max-w-[200px] truncate">{e.description}</td>
                  <td className="px-4 py-3 text-muted-foreground">{e.vendor ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${METHOD_COLORS[e.paymentMethod] ?? "bg-gray-100 text-gray-700"}`}>
                      {METHODS.find(m => m.value === e.paymentMethod)?.label ?? e.paymentMethod}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{e.reference ?? "—"}</td>
                  <td className="px-4 py-3 text-right font-semibold text-destructive">{fmtPKR(e.amount)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(e)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteId(e.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            {expenses.length > 0 && (
              <tfoot className="border-t bg-muted/20">
                <tr>
                  <td colSpan={6} className="px-4 py-3 text-sm font-semibold text-muted-foreground">Total</td>
                  <td className="px-4 py-3 text-right font-bold text-destructive">{fmtPKR(totalShown)}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dlgOpen} onOpenChange={setDlgOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Edit Expense" : "Record Expense"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3 mt-2">
            <div className="col-span-2">
              <Label className="text-xs">Description *</Label>
              <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="e.g. Office rent payment" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Date *</Label>
              <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Amount (PKR) *</Label>
              <Input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Category</Label>
              <Select value={form.categoryId || "none"} onValueChange={v => setForm(f => ({ ...f, categoryId: v === "none" ? "" : v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No category</SelectItem>
                  {cats.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Payment Method</Label>
              <Select value={form.paymentMethod} onValueChange={v => setForm(f => ({ ...f, paymentMethod: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {METHODS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Vendor / Payee</Label>
              <Input value={form.vendor} onChange={e => setForm(f => ({ ...f, vendor: e.target.value }))} placeholder="Vendor name" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Reference / Receipt #</Label>
              <Input value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))} placeholder="Optional" className="mt-1" />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Notes</Label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Additional notes…" rows={2} className="mt-1" />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setDlgOpen(false)}>Cancel</Button>
            <Button onClick={() => saveMut.mutate(form)} disabled={saveMut.isPending || !form.description || !form.amount || !form.date}>
              {saveMut.isPending ? "Saving…" : editing ? "Update" : "Save Expense"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Category dialog */}
      <Dialog open={catDlgOpen} onOpenChange={setCatDlgOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Expense Categories</DialogTitle></DialogHeader>
          <div className="space-y-2 max-h-52 overflow-y-auto">
            {cats.map(c => (
              <div key={c.id} className="flex items-center gap-2 text-sm py-1.5 border-b last:border-0">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c.color ?? "#6b7280" }} />
                <span className="flex-1">{c.name}</span>
                <span className="text-xs text-muted-foreground truncate max-w-[120px]">{c.description ?? ""}</span>
              </div>
            ))}
          </div>
          <div className="border-t pt-3 mt-1">
            <div className="text-xs font-medium mb-2">Add New Category</div>
            <div className="grid grid-cols-2 gap-2">
              <Input value={catForm.name} onChange={e => setCatForm(f => ({ ...f, name: e.target.value }))} placeholder="Category name" />
              <Input value={catForm.description ?? ""} onChange={e => setCatForm(f => ({ ...f, description: e.target.value }))} placeholder="Description (optional)" />
            </div>
            <Button className="mt-2 w-full" size="sm" onClick={() => saveCatMut.mutate()} disabled={!catForm.name || saveCatMut.isPending}>Add Category</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Delete Expense?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">This action cannot be undone.</p>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteId && deleteMut.mutate(deleteId)} disabled={deleteMut.isPending}>Delete</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
