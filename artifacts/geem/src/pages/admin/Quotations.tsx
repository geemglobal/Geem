import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { axiosInstance } from "@/lib/axios";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Link, useLocation } from "wouter";
import { Plus, FileText } from "lucide-react";

interface Quotation {
  id: number;
  quotationNumber: string;
  status: string;
  date: string;
  expiryDate: string | null;
  customerName: string;
  customerId: number;
  total: number;
  currency: string;
  currencySymbol: string;
  items: Array<{ id: number; description: string; qty: number; price: number; amount: number }>;
}

const statusColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  accepted: "default", draft: "outline", rejected: "destructive", expired: "secondary",
};

export default function Quotations() {
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [, navigate] = useLocation();

  const { data, isLoading } = useQuery({
    queryKey: ["quotations", status],
    queryFn: () => axiosInstance.get<Quotation[]>(`/quotations?status=${status}`).then(r => r.data),
  });

  const quotations = data ?? [];

  const filtered = search
    ? quotations.filter(q =>
        q.quotationNumber.toLowerCase().includes(search.toLowerCase()) ||
        q.customerName.toLowerCase().includes(search.toLowerCase())
      )
    : quotations;

  const counts = quotations.reduce((acc, q) => {
    acc[q.status] = (acc[q.status] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Quotations</h1>
          <p className="text-muted-foreground">Create and manage price quotations for customers</p>
        </div>
        <Link href="/quotations/new">
          <Button><Plus className="h-4 w-4 mr-2" />New Quotation</Button>
        </Link>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {["draft", "accepted", "rejected", "expired"].map(s => (
          <Card
            key={s}
            className={`cursor-pointer border-2 transition-all ${status === s ? "border-primary" : "border-transparent"}`}
            onClick={() => setStatus(status === s ? "" : s)}
          >
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground capitalize font-medium">{s}</p>
              <p className="text-xl font-bold mt-1">{counts[s] ?? 0}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="Search by quotation number or customer…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="max-w-xs"
        />
        {status && (
          <Button variant="ghost" size="sm" onClick={() => setStatus("")}>Clear filter</Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quotation #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Expiry</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading…</TableCell>
                </TableRow>
              )}
              {!isLoading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-16 text-muted-foreground">
                    <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">No quotations yet</p>
                    <p className="text-sm mt-1">Create your first quotation to get started</p>
                    <Link href="/quotations/new">
                      <Button className="mt-4" size="sm"><Plus className="h-4 w-4 mr-1" />New Quotation</Button>
                    </Link>
                  </TableCell>
                </TableRow>
              )}
              {filtered.map(q => (
                <TableRow
                  key={q.id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => navigate(`/quotations/${q.id}`)}
                >
                  <TableCell className="font-mono font-semibold">{q.quotationNumber}</TableCell>
                  <TableCell>{q.customerName}</TableCell>
                  <TableCell>{q.date}</TableCell>
                  <TableCell>{q.expiryDate ?? "—"}</TableCell>
                  <TableCell>{q.items?.length ?? 0}</TableCell>
                  <TableCell>
                    <Badge variant={statusColors[q.status] ?? "outline"} className="capitalize">
                      {q.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {q.currencySymbol} {q.total.toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
