import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { axiosInstance } from "@/lib/axios";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { Plus, FileText, AlertCircle, Mail, Loader2, Download } from "lucide-react";

interface Invoice {
  id: number;
  invoiceNumber: string;
  status: string;
  date: string;
  dueDate: string | null;
  customerId: number;
  customerName: string;
  subtotal: number;
  discount: number;
  tax: number;
  shipping: number;
  total: number;
  paid: number;
  balanceDue: number;
  currency: string;
  currencySymbol: string;
  notes: string | null;
  items: Array<{ id: number; description: string; qty: number; price: number; amount: number; imei: string | null; taxRate: number }>;
  payments: Array<{ id: number; date: string; method: string; amount: number }>;
  createdAt: string;
}

const statusColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  paid: "default", partial: "secondary", draft: "outline", overdue: "destructive", cancelled: "secondary",
};

export default function Invoices() {
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [emailingId, setEmailingId] = useState<number | null>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  async function emailInvoice(inv: Invoice) {
    setEmailingId(inv.id);
    try {
      const r = await axiosInstance.post(`/invoices/${inv.id}/email`);
      toast({ title: "Invoice emailed", description: `Sent to ${r.data.sentTo}` });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Failed to send email";
      toast({ title: "Email failed", description: msg, variant: "destructive" });
    } finally {
      setEmailingId(null);
    }
  }

  const { data, isLoading } = useQuery({
    queryKey: ["invoices", status, page],
    queryFn: () => axiosInstance.get<{ invoices: Invoice[]; total: number; summary: Record<string, number> }>(`/invoices?status=${status}&page=${page}`).then(r => r.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => axiosInstance.delete(`/invoices/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["invoices"] }); toast({ title: "Invoice deleted" }); },
  });

  const invoices = data?.invoices ?? [];
  const summary = data?.summary ?? {};

  const filtered = search ? invoices.filter(i => i.invoiceNumber.toLowerCase().includes(search.toLowerCase()) || i.customerName.toLowerCase().includes(search.toLowerCase())) : invoices;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Invoices</h1>
          <p className="text-muted-foreground">Manage sales invoices</p>
        </div>
        <div className="flex gap-2">
          <Link href="/pos"><Button variant="outline"><FileText className="h-4 w-4 mr-2" />Open POS</Button></Link>
          <Link href="/invoices/new"><Button><Plus className="h-4 w-4 mr-2" />New Invoice</Button></Link>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {["draft", "partial", "paid", "overdue"].map(s => (
          <Card key={s} className={`cursor-pointer border-2 transition-all ${status === s ? "border-primary" : "border-transparent"}`} onClick={() => setStatus(status === s ? "" : s)}>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground capitalize font-medium">{s}</p>
              <p className="text-xl font-bold mt-1">
                {s === "overdue" ? `PKR ${(summary.overdue ?? 0).toLocaleString()}` : s === "paid" ? `PKR ${(summary.paid ?? 0).toLocaleString()}` : "—"}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-3 mb-4">
            <Input placeholder="Search invoice # or customer..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-sm" />
          </div>
          {isLoading ? <p className="text-center py-10 text-muted-foreground">Loading...</p> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Paid</TableHead>
                  <TableHead>Balance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(inv => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-mono font-medium">{inv.invoiceNumber}</TableCell>
                    <TableCell>{inv.customerName}</TableCell>
                    <TableCell>{inv.date}</TableCell>
                    <TableCell>{inv.currencySymbol} {inv.total.toLocaleString()}</TableCell>
                    <TableCell>{inv.currencySymbol} {inv.paid.toLocaleString()}</TableCell>
                    <TableCell className={inv.balanceDue > 0 ? "font-semibold text-destructive" : ""}>{inv.currencySymbol} {inv.balanceDue.toLocaleString()}</TableCell>
                    <TableCell><Badge variant={statusColors[inv.status] ?? "outline"}>{inv.status}</Badge></TableCell>
                    <TableCell className="text-right space-x-1">
                      <Link href={`/invoices/${inv.id}`}><Button variant="outline" size="sm">View</Button></Link>
                      <Button
                        variant="outline" size="sm"
                        onClick={() => window.open(`/api/invoices/${inv.id}/print`, "_blank")}
                        title="Download PDF"
                      ><Download className="h-3.5 w-3.5" /></Button>
                      <Button
                        variant="outline" size="sm"
                        onClick={() => emailInvoice(inv)}
                        disabled={emailingId === inv.id}
                        title={inv.customerName + " — email invoice"}
                      >
                        {emailingId === inv.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(inv.id)}>Del</Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!filtered.length && <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No invoices found</TableCell></TableRow>}
              </TableBody>
            </Table>
          )}
          {(data?.total ?? 0) > 50 && (
            <div className="flex justify-center gap-2 mt-4">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Prev</Button>
              <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
