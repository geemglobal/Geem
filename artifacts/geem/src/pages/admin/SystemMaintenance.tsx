import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { axiosInstance } from "@/lib/axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  Download, Upload, RotateCcw, Database, Package,
  CheckCircle2, AlertTriangle, Terminal, Server, HardDrive,
  Clock, Shield, RefreshCw, X, FileArchive, Trash2,
} from "lucide-react";

interface SystemInfo {
  tables: string[];
  rowCounts: Record<string, number>;
  workspace: string;
  nodeVersion: string;
  uptime: number;
  memoryMb: number;
}

interface RestoreResult {
  ok: boolean;
  restoredTables: number;
  restoredRows: number;
  errors: string[];
  manifest: { createdAt: string; app: string; version: string };
}

interface UpdateResult {
  ok: boolean;
  manifest: { version: string; description: string; requiresMigration?: boolean };
  extracted: string[];
  skipped: string[];
  migrationOutput: string;
  buildOutput: string;
}

function formatUptime(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function FileDropZone({
  label, accept, icon: Icon, onFile, disabled,
}: {
  label: string; accept: string; icon: React.ElementType;
  onFile: (file: File) => void; disabled?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  return (
    <div
      className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
        dragging ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300 hover:bg-gray-50/50"
      } ${disabled ? "opacity-50 pointer-events-none" : ""}`}
      onClick={() => ref.current?.click()}
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => {
        e.preventDefault(); setDragging(false);
        const f = e.dataTransfer.files[0];
        if (f) onFile(f);
      }}
    >
      <input ref={ref} type="file" accept={accept} className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }}
      />
      <Icon className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="text-xs text-muted-foreground/60 mt-1">Click to browse or drag & drop</p>
      <p className="text-xs text-muted-foreground/50 mt-0.5">ZIP files only</p>
    </div>
  );
}

export default function SystemMaintenance() {
  const { toast } = useToast();
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [updateFile, setUpdateFile] = useState<File | null>(null);
  const [restoreResult, setRestoreResult] = useState<RestoreResult | null>(null);
  const [updateResult, setUpdateResult] = useState<UpdateResult | null>(null);
  const [restoreConfirm, setRestoreConfirm] = useState(false);
  const [restartConfirm, setRestartConfirm] = useState(false);
  const [backupLoading, setBackupLoading] = useState(false);
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  const [clearStep, setClearStep] = useState(0);

  const { data: info, isLoading: infoLoading, refetch: refetchInfo } = useQuery({
    queryKey: ["system-info"],
    queryFn: () => axiosInstance.get<SystemInfo>("/system/info").then(r => r.data),
  });

  const totalRows = info ? Object.values(info.rowCounts).filter(v => v >= 0).reduce((s, v) => s + v, 0) : 0;

  async function downloadBackup() {
    setBackupLoading(true);
    try {
      const token = localStorage.getItem("geem_token");
      const resp = await fetch("/api/system/backup", { headers: { Authorization: `Bearer ${token}` } });
      if (!resp.ok) throw new Error("Backup failed");
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const date = new Date().toISOString().split("T")[0];
      a.href = url;
      a.download = `geem-backup-${date}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      setLastBackup(new Date().toLocaleString("en-PK", { timeZone: "Asia/Karachi" }));
      toast({ title: "Backup downloaded successfully" });
    } catch {
      toast({ title: "Backup failed", variant: "destructive" });
    } finally {
      setBackupLoading(false);
    }
  }

  const restoreMutation = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("backup", file);
      const token = localStorage.getItem("geem_token");
      const resp = await fetch("/api/system/restore", {
        method: "POST", body: form,
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await resp.json() as RestoreResult | { error: string };
      if (!resp.ok) throw new Error("error" in data ? data.error : "Restore failed");
      return data as RestoreResult;
    },
    onSuccess: (data) => {
      setRestoreResult(data);
      setRestoreFile(null);
      setRestoreConfirm(false);
      refetchInfo();
      toast({ title: `Restored ${data.restoredTables} tables, ${data.restoredRows} rows` });
    },
    onError: (err) => { toast({ title: `Restore failed: ${err.message}`, variant: "destructive" }); },
  });

  const updateMutation = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("update", file);
      const token = localStorage.getItem("geem_token");
      const resp = await fetch("/api/system/update", {
        method: "POST", body: form,
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await resp.json() as UpdateResult | { error: string };
      if (!resp.ok) throw new Error("error" in data ? data.error : "Update failed");
      return data as UpdateResult;
    },
    onSuccess: (data) => {
      setUpdateResult(data);
      setUpdateFile(null);
      toast({ title: `Update applied — v${data.manifest.version}. Server restarting…` });
    },
    onError: (err) => { toast({ title: `Update failed: ${err.message}`, variant: "destructive" }); },
  });

  const restartMutation = useMutation({
    mutationFn: () => axiosInstance.post("/system/restart").then(r => r.data),
    onSuccess: () => { toast({ title: "Server is restarting…" }); setRestartConfirm(false); },
  });

  const clearInventoryMutation = useMutation({
    mutationFn: () => axiosInstance.post<{ ok: boolean; deleted: number }>("/system/clear-inventory").then(r => r.data),
    onSuccess: (data) => {
      refetchInfo();
      setClearStep(0);
      toast({ title: `Inventory cleared — ${data.deleted} items deleted` });
    },
    onError: () => toast({ title: "Failed to clear inventory", variant: "destructive" }),
  });

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Server className="h-6 w-6" />System Maintenance</h1>
        <p className="text-muted-foreground">Backup your data, restore from a backup, or apply software updates.</p>
      </div>

      {/* Server Status */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { icon: Database, label: "Tables", value: info ? `${info.tables.length}` : "—", sub: info ? `${totalRows.toLocaleString()} rows` : "" },
          { icon: HardDrive, label: "Memory", value: info ? `${info.memoryMb} MB` : "—", sub: "Heap used" },
          { icon: Clock, label: "Uptime", value: info ? formatUptime(info.uptime) : "—", sub: "Server running" },
          { icon: Shield, label: "Node", value: info?.nodeVersion ?? "—", sub: "Runtime" },
        ].map(({ icon: Icon, label, value, sub }) => (
          <Card key={label}><CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1"><Icon className="h-4 w-4 text-muted-foreground" /><p className="text-xs text-muted-foreground">{label}</p></div>
            <p className="text-xl font-bold">{value}</p>
            <p className="text-xs text-muted-foreground">{sub}</p>
          </CardContent></Card>
        ))}
      </div>

      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => refetchInfo()} disabled={infoLoading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${infoLoading ? "animate-spin" : ""}`} />Refresh Status
        </Button>
      </div>

      <Separator />

      {/* ── Backup ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Download className="h-5 w-5 text-green-600" />Data Backup</CardTitle>
          <p className="text-sm text-muted-foreground">
            Downloads a ZIP file containing all your business data — customers, invoices, inventory, orders, and more — as JSON files.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {info && (
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Included in backup ({info.tables.length} tables)</p>
              <div className="flex flex-wrap gap-1.5">
                {info.tables.map(t => (
                  <span key={t} className="text-xs bg-white border rounded px-2 py-0.5 font-mono text-muted-foreground">
                    {t} <span className="text-foreground/60">({info.rowCounts[t] ?? 0})</span>
                  </span>
                ))}
              </div>
            </div>
          )}
          {lastBackup && (
            <p className="text-xs text-green-600 flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" />Last backup: {lastBackup}</p>
          )}
          <Button onClick={downloadBackup} disabled={backupLoading} className="bg-green-700 hover:bg-green-800">
            {backupLoading
              ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Creating backup…</>
              : <><Download className="h-4 w-4 mr-2" />Download Backup ZIP</>}
          </Button>
        </CardContent>
      </Card>

      <Separator />

      {/* ── Restore ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Upload className="h-5 w-5 text-orange-600" />Restore from Backup</CardTitle>
          <p className="text-sm text-muted-foreground">
            Upload a backup ZIP created by this system. <strong className="text-orange-600">This will overwrite all current data.</strong>
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {restoreResult && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm font-semibold text-green-800 flex items-center gap-2"><CheckCircle2 className="h-4 w-4" />Restore complete</p>
              <p className="text-sm text-green-700 mt-1">{restoreResult.restoredTables} tables, {restoreResult.restoredRows.toLocaleString()} rows restored</p>
              {restoreResult.errors.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs font-semibold text-orange-700 mb-1">Warnings ({restoreResult.errors.length}):</p>
                  {restoreResult.errors.map((e, i) => <p key={i} className="text-xs font-mono text-orange-700">{e}</p>)}
                </div>
              )}
              <Button variant="ghost" size="sm" className="mt-2 h-6 text-xs text-muted-foreground" onClick={() => setRestoreResult(null)}>Dismiss</Button>
            </div>
          )}

          {!restoreFile ? (
            <FileDropZone label="Drop a Geem backup ZIP here" accept=".zip" icon={FileArchive} onFile={setRestoreFile} />
          ) : (
            <div className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-3">
                <FileArchive className="h-8 w-8 text-orange-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{restoreFile.name}</p>
                  <p className="text-xs text-muted-foreground">{(restoreFile.size / 1024).toFixed(1)} KB</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => { setRestoreFile(null); setRestoreConfirm(false); }}><X className="h-4 w-4" /></Button>
              </div>
              {!restoreConfirm ? (
                <Button variant="destructive" onClick={() => setRestoreConfirm(true)}>
                  <AlertTriangle className="h-4 w-4 mr-2" />Restore — this will overwrite all data
                </Button>
              ) : (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-3">
                  <p className="text-sm font-semibold text-red-800">⚠️ Are you absolutely sure?</p>
                  <p className="text-sm text-red-700">All current data will be permanently replaced with data from <strong>{restoreFile.name}</strong>. This cannot be undone.</p>
                  <div className="flex gap-2">
                    <Button variant="destructive" onClick={() => restoreMutation.mutate(restoreFile)} disabled={restoreMutation.isPending}>
                      {restoreMutation.isPending ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Restoring…</> : "Yes, restore now"}
                    </Button>
                    <Button variant="outline" onClick={() => setRestoreConfirm(false)}>Cancel</Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* ── Software Update ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Package className="h-5 w-5 text-blue-600" />Software Update</CardTitle>
          <p className="text-sm text-muted-foreground">
            Apply new features by uploading an update ZIP. Only code files are changed — <strong className="text-green-700">your data is never touched</strong>.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Data safety guarantee */}
          <div className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-lg p-4">
            <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-green-800">Your data is 100% safe during updates</p>
              <p className="text-sm text-green-700 mt-0.5">
                Software updates only add new pages, routes, and code. They <strong>never</strong> delete, overwrite,
                or modify your customers, invoices, inventory, or any other business data. If a new feature
                needs new database columns, they are <strong>added alongside</strong> existing data — nothing is removed.
              </p>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
            <p className="font-semibold mb-1">Update package format:</p>
            <p className="font-mono text-xs mt-1 leading-relaxed">
              📦 update.zip<br />
              &nbsp;&nbsp;├── update-manifest.json &nbsp;<span className="text-blue-500">(required)</span><br />
              &nbsp;&nbsp;├── artifacts/geem/src/pages/admin/…tsx<br />
              &nbsp;&nbsp;├── artifacts/api-server/src/routes/…ts<br />
              &nbsp;&nbsp;└── lib/db/src/schema/…ts
            </p>
            <p className="text-xs mt-2 text-blue-600/80">The <code>update-manifest.json</code> must contain: <code>version</code>, <code>description</code>, <code>requiresBuild</code>, <code>requiresRestart</code>, <code>requiresMigration</code>.</p>
          </div>

          {updateResult && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm font-semibold text-green-800 flex items-center gap-2"><CheckCircle2 className="h-4 w-4" />Update applied — v{updateResult.manifest.version}</p>
              <p className="text-sm text-green-700 mt-0.5">{updateResult.manifest.description}</p>
              <div className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                <p>✅ {updateResult.extracted.length} code file{updateResult.extracted.length !== 1 ? "s" : ""} updated — data untouched</p>
                {updateResult.manifest.requiresMigration && <p>✅ Database schema updated (new columns/tables added, no data removed)</p>}
              </div>
              {(updateResult.buildOutput || updateResult.migrationOutput) && (
                <details className="mt-2">
                  <summary className="text-xs cursor-pointer text-muted-foreground">Build / migration log</summary>
                  <pre className="text-xs font-mono bg-gray-900 text-green-400 rounded p-3 mt-2 overflow-x-auto max-h-40 overflow-y-auto">
                    {[updateResult.migrationOutput, updateResult.buildOutput].filter(Boolean).join("\n\n")}
                  </pre>
                </details>
              )}
              <Button variant="ghost" size="sm" className="mt-2 h-6 text-xs text-muted-foreground" onClick={() => setUpdateResult(null)}>Dismiss</Button>
            </div>
          )}

          {updateMutation.isError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm font-semibold text-red-800 flex items-center gap-2"><AlertTriangle className="h-4 w-4" />Update failed</p>
              <p className="text-xs font-mono text-red-700 mt-1 whitespace-pre-wrap">{updateMutation.error?.message}</p>
            </div>
          )}

          {!updateFile ? (
            <FileDropZone label="Drop an update ZIP package here" accept=".zip" icon={Package} onFile={setUpdateFile} />
          ) : (
            <div className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-3">
                <Package className="h-8 w-8 text-blue-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{updateFile.name}</p>
                  <p className="text-xs text-muted-foreground">{(updateFile.size / 1024).toFixed(1)} KB</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setUpdateFile(null)}><X className="h-4 w-4" /></Button>
              </div>
              <Button onClick={() => updateMutation.mutate(updateFile)} disabled={updateMutation.isPending}>
                {updateMutation.isPending
                  ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Applying update…</>
                  : <><Terminal className="h-4 w-4 mr-2" />Apply Update</>}
              </Button>
              <p className="text-xs text-muted-foreground">The server will rebuild and restart after the update is applied.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* ── Restart Server ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><RotateCcw className="h-5 w-5 text-purple-600" />Restart Server</CardTitle>
          <p className="text-sm text-muted-foreground">Gracefully restart the API server. The Replit workflow will bring it back online automatically within seconds.</p>
        </CardHeader>
        <CardContent>
          {!restartConfirm ? (
            <Button variant="outline" className="border-purple-300 text-purple-700 hover:bg-purple-50" onClick={() => setRestartConfirm(true)}>
              <RotateCcw className="h-4 w-4 mr-2" />Restart API Server
            </Button>
          ) : (
            <div className="flex items-center gap-3 bg-purple-50 border border-purple-200 rounded-lg px-4 py-3">
              <p className="text-sm text-purple-800 font-medium">The API will be unavailable for a few seconds.</p>
              <Button size="sm" className="bg-purple-700 hover:bg-purple-800" onClick={() => restartMutation.mutate()} disabled={restartMutation.isPending}>
                {restartMutation.isPending ? "Restarting…" : "Confirm Restart"}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setRestartConfirm(false)}>Cancel</Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* ── Danger Zone ── */}
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-700"><AlertTriangle className="h-5 w-5" />Danger Zone</CardTitle>
          <p className="text-sm text-muted-foreground">Irreversible actions. Take a backup first.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="border border-red-200 rounded-lg p-4 bg-red-50/40 space-y-3">
            <div>
              <p className="text-sm font-semibold text-red-800 flex items-center gap-2"><Trash2 className="h-4 w-4" />Delete All Inventory</p>
              <p className="text-xs text-red-700 mt-0.5">Permanently deletes every item in the inventory. Invoices and sales history are not affected.</p>
            </div>

            {clearStep === 0 && (
              <Button variant="outline" className="border-red-300 text-red-700 hover:bg-red-100" onClick={() => setClearStep(1)}>
                <Trash2 className="h-4 w-4 mr-2" />Delete All Inventory
              </Button>
            )}

            {clearStep === 1 && (
              <div className="bg-red-100 border border-red-300 rounded-lg p-3 space-y-3">
                <p className="text-sm font-semibold text-red-800">⚠️ Are you sure? This will remove all inventory items.</p>
                <div className="flex gap-2">
                  <Button variant="destructive" size="sm" onClick={() => setClearStep(2)}>
                    Yes, delete all inventory
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setClearStep(0)}>Cancel</Button>
                </div>
              </div>
            )}

            {clearStep === 2 && (
              <div className="bg-red-200 border border-red-400 rounded-lg p-3 space-y-3">
                <p className="text-sm font-bold text-red-900">🚨 Final warning — this cannot be undone!</p>
                <p className="text-xs text-red-800">All inventory records will be permanently deleted from the database.</p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="bg-red-800 hover:bg-red-900 text-white"
                    onClick={() => clearInventoryMutation.mutate()}
                    disabled={clearInventoryMutation.isPending}
                  >
                    {clearInventoryMutation.isPending
                      ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Deleting…</>
                      : "Yes, permanently delete all inventory"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setClearStep(0)}>Cancel</Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
