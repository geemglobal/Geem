import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { axiosInstance } from "@/lib/axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Cpu, Check, Clock, Trash2 } from "lucide-react";

interface ImeiRow {
  id: number; prefix13: string; imei15: string; serialNumber: number;
  isUsed: boolean; assignedInventoryItemId: number | null; usedAt: string | null; createdAt: string;
}

export default function ImeiManagement() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showGenerate, setShowGenerate] = useState(false);
  const [prefix13, setPrefix13] = useState("");
  const [quantity, setQuantity] = useState("10");
  const [filterUsed, setFilterUsed] = useState<string>("all");
  const [filterPrefix, setFilterPrefix] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["imei-pool", filterUsed, filterPrefix],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filterUsed !== "all") params.set("used", filterUsed);
      if (filterPrefix) params.set("prefix", filterPrefix);
      params.set("limit", "200");
      return axiosInstance.get<{ total: number; rows: ImeiRow[] }>(`/imei-pool?${params}`).then(r => r.data);
    },
  });

  const generateMutation = useMutation({
    mutationFn: (payload: { prefix12: string; quantity: number }) =>
      axiosInstance.post("/imei-pool/generate", payload).then(r => r.data),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["imei-pool"] });
      setShowGenerate(false);
      toast({ title: `Generated ${data.generated} IMEIs successfully`, description: data.rows?.[0]?.imei15 ? `First: ${data.rows[0].imei15}` : undefined });
    },
    onError: (e: any) => toast({ title: e?.response?.data?.error ?? "Generation failed", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => axiosInstance.delete(`/imei-pool/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["imei-pool"] }); toast({ title: "Deleted" }); },
    onError: (e: any) => toast({ title: e?.response?.data?.error ?? "Delete failed", variant: "destructive" }),
  });

  const freeCount = data?.rows.filter(r => !r.isUsed).length ?? 0;
  const usedCount = data?.rows.filter(r => r.isUsed).length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Cpu className="h-6 w-6" />IMEI Management</h1>
          <p className="text-muted-foreground">Generate and manage IMEI pool for device replacement</p>
        </div>
        <Button onClick={() => setShowGenerate(true)}><Plus className="h-4 w-4 mr-2" />Generate IMEIs</Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Total in Pool</p><p className="text-2xl font-bold">{data?.total ?? 0}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Free / Available</p><p className="text-2xl font-bold text-green-600">{freeCount}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Used / Assigned</p><p className="text-2xl font-bold text-muted-foreground">{usedCount}</p></CardContent></Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-3 mb-4 flex-wrap">
            <Input placeholder="Filter by prefix (13 digits)" value={filterPrefix} onChange={e => setFilterPrefix(e.target.value)} className="max-w-xs" />
            <div className="flex gap-1">
              {[["all", "All"], ["false", "Free"], ["true", "Used"]].map(([v, l]) => (
                <Button key={v} size="sm" variant={filterUsed === v ? "default" : "outline"} onClick={() => setFilterUsed(v)}>{l}</Button>
              ))}
            </div>
          </div>

          {isLoading ? <p className="text-center py-8 text-muted-foreground">Loading...</p> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>IMEI (15 digits)</TableHead>
                  <TableHead>Prefix (13)</TableHead>
                  <TableHead>Serial #</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.rows.map(row => (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono font-medium">{row.imei15}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{row.prefix13}</TableCell>
                    <TableCell>{String(row.serialNumber).padStart(2, "0")}</TableCell>
                    <TableCell>
                      {row.isUsed
                        ? <Badge variant="secondary" className="gap-1"><Check className="h-3 w-3" />Used{row.assignedInventoryItemId ? ` (INV#${row.assignedInventoryItemId})` : ""}</Badge>
                        : <Badge variant="outline" className="gap-1 text-green-600 border-green-300"><Clock className="h-3 w-3" />Free</Badge>
                      }
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(row.createdAt).toLocaleDateString("en-PK", { timeZone: "Asia/Karachi", day: "2-digit", month: "short", year: "numeric" })}</TableCell>
                    <TableCell className="text-right">
                      {!row.isUsed && (
                        <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(row.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {!data?.rows.length && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No IMEIs in pool yet. Generate some above.</TableCell></TableRow>}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={showGenerate} onOpenChange={setShowGenerate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Generate IMEI Batch</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>First 12 Digits of IMEI *</Label>
              <Input
                value={prefix13}
                onChange={e => setPrefix13(e.target.value.replace(/\D/g, "").slice(0, 12))}
                placeholder="e.g. 353803008495"
                className="font-mono"
                maxLength={12}
              />
              <p className="text-xs text-muted-foreground mt-1">Enter TAC (8 digits) + first 4 SNR digits. The 13th–14th digits (serial 01–99) and 15th digit (Luhn check) are auto-generated.</p>
            </div>
            <div>
              <Label>Quantity (1–99) *</Label>
              <Input
                type="number" min={1} max={99}
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">Each IMEI gets a unique 2-digit serial (01, 02, 03…) with Luhn check digit.</p>
            </div>
            {prefix13.length === 12 && (
              <div className="bg-muted rounded-lg p-3 text-sm space-y-1">
                <p className="font-medium">Preview (first 3):</p>
                {[1,2,3].slice(0, parseInt(quantity) || 1).map(n => {
                  const digits14 = prefix13 + String(n).padStart(2, "0");
                  const arr = digits14.split("").map(Number);
                  let sum = 0;
                  for (let i = 0; i < arr.length; i++) { let d = arr[i]; if ((arr.length - i) % 2 !== 0) { d *= 2; if (d > 9) d -= 9; } sum += d; }
                  const check = (10 - (sum % 10)) % 10;
                  return <p key={n} className="font-mono text-xs">{digits14 + check} (serial {String(n).padStart(2,"0")})</p>;
                })}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGenerate(false)}>Cancel</Button>
            <Button
              onClick={() => generateMutation.mutate({ prefix12: prefix13, quantity: parseInt(quantity) })}
              disabled={prefix13.length !== 12 || generateMutation.isPending}
            >
              {generateMutation.isPending ? "Generating..." : "Generate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
