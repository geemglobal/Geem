import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { axiosInstance } from "@/lib/axios";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Star, ExternalLink, Lock } from "lucide-react";

interface VaultEntry { id: number; name: string; url: string; loginUrl: string | null; ipPort: string | null; smsApnNotes: string | null; remarks: string | null; favorite: boolean; createdAt: string; }

const emptyForm = { name: "", url: "", loginUrl: "", ipPort: "", smsApnNotes: "", remarks: "", favorite: false };

export default function Vault() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editEntry, setEditEntry] = useState<VaultEntry | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState("");

  const { data: entries, isLoading } = useQuery({
    queryKey: ["vault"],
    queryFn: () => axiosInstance.get<VaultEntry[]>("/vault").then(r => r.data),
  });

  const saveMutation = useMutation({
    mutationFn: (payload: object) =>
      editEntry ? axiosInstance.patch(`/vault/${editEntry.id}`, payload).then(r => r.data) : axiosInstance.post("/vault", payload).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["vault"] }); setShowForm(false); setEditEntry(null); setForm(emptyForm); toast({ title: editEntry ? "Entry updated" : "Entry added" }); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => axiosInstance.delete(`/vault/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["vault"] }); toast({ title: "Entry deleted" }); },
  });

  const toggleFav = useMutation({
    mutationFn: ({ id, favorite }: { id: number; favorite: boolean }) => axiosInstance.patch(`/vault/${id}`, { favorite }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vault"] }),
  });

  function openEdit(e: VaultEntry) {
    setEditEntry(e);
    setForm({ name: e.name, url: e.url, loginUrl: e.loginUrl ?? "", ipPort: e.ipPort ?? "", smsApnNotes: e.smsApnNotes ?? "", remarks: e.remarks ?? "", favorite: e.favorite });
    setShowForm(true);
  }

  const filtered = entries?.filter(e => !search || e.name.toLowerCase().includes(search.toLowerCase()) || e.url.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold flex items-center gap-2"><Lock className="h-6 w-6" />Platform Vault</h1><p className="text-muted-foreground">Store platform credentials and notes securely</p></div>
        <Button onClick={() => { setEditEntry(null); setForm(emptyForm); setShowForm(true); }}><Plus className="h-4 w-4 mr-2" />Add Entry</Button>
      </div>

      <Input placeholder="Search vault..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-sm" />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {isLoading && <p className="col-span-3 text-center py-10 text-muted-foreground">Loading...</p>}
        {filtered?.map(entry => (
          <Card key={entry.id} className="hover:shadow-md transition-shadow">
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{entry.name}</p>
                  <a href={entry.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1 truncate">
                    {entry.url} <ExternalLink className="h-3 w-3 flex-shrink-0" />
                  </a>
                </div>
                <Button variant="ghost" size="sm" onClick={() => toggleFav.mutate({ id: entry.id, favorite: !entry.favorite })}>
                  <Star className={`h-4 w-4 ${entry.favorite ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`} />
                </Button>
              </div>
              {entry.loginUrl && <p className="text-xs text-muted-foreground">Login: <span className="font-mono">{entry.loginUrl}</span></p>}
              {entry.ipPort && <p className="text-xs text-muted-foreground">IP/Port: <span className="font-mono">{entry.ipPort}</span></p>}
              {entry.smsApnNotes && <p className="text-xs text-muted-foreground border-t pt-2">{entry.smsApnNotes}</p>}
              {entry.remarks && <p className="text-xs text-muted-foreground italic">{entry.remarks}</p>}
              <div className="flex gap-2 pt-1">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => openEdit(entry)}>Edit</Button>
                <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(entry.id)}>Delete</Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {!isLoading && !filtered?.length && (
          <div className="col-span-3 text-center py-12 text-muted-foreground">
            <Lock className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>{search ? "No matching entries" : "Your vault is empty. Add credentials to get started."}</p>
          </div>
        )}
      </div>

      <Dialog open={showForm} onOpenChange={v => { setShowForm(v); if (!v) setEditEntry(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editEntry ? "Edit Entry" : "New Vault Entry"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Platform Name *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. TCS Courier, PTA Portal" /></div>
            <div><Label>Portal / Website URL *</Label><Input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} placeholder="https://portal.tcs.com" /></div>
            <div><Label>Login URL</Label><Input value={form.loginUrl} onChange={e => setForm(f => ({ ...f, loginUrl: e.target.value }))} placeholder="https://portal.tcs.com/login" /></div>
            <div><Label>IP / Port</Label><Input value={form.ipPort} onChange={e => setForm(f => ({ ...f, ipPort: e.target.value }))} placeholder="192.168.1.1:8080" /></div>
            <div><Label>SMS / APN Notes</Label><Input value={form.smsApnNotes} onChange={e => setForm(f => ({ ...f, smsApnNotes: e.target.value }))} placeholder="Any SMS gateway or APN notes" /></div>
            <div><Label>Remarks</Label><Input value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} placeholder="Additional notes..." /></div>
            <div className="flex items-center gap-2"><Switch checked={form.favorite} onCheckedChange={v => setForm(f => ({ ...f, favorite: v }))} /><Label>Mark as Favorite</Label></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending}>{saveMutation.isPending ? "Saving..." : "Save Entry"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
