import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { axiosInstance } from "@/lib/axios";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Search, RefreshCw, ShieldCheck, MapPin, Monitor, Smartphone, Tablet, Globe } from "lucide-react";

interface ActivityLog {
  id: number;
  userId: number | null;
  userEmail: string | null;
  action: string;
  entity: string | null;
  entityId: string | null;
  details: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  status: "success" | "failed";
  latitude: string | null;
  longitude: string | null;
  locationName: string | null;
  browser: string | null;
  os: string | null;
  deviceType: string | null;
  createdAt: string;
}

const ACTION_COLOR: Record<string, string> = {
  login:        "bg-blue-100 text-blue-700",
  logout:       "bg-gray-100 text-gray-600",
  login_failed: "bg-red-100 text-red-700",
  create:       "bg-green-100 text-green-700",
  update:       "bg-yellow-100 text-yellow-700",
  delete:       "bg-red-100 text-red-700",
  import:       "bg-purple-100 text-purple-700",
  sale:         "bg-emerald-100 text-emerald-700",
  payment:      "bg-teal-100 text-teal-700",
};

function ActionBadge({ action }: { action: string }) {
  const cls = ACTION_COLOR[action.toLowerCase()] ?? "bg-slate-100 text-slate-700";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
      {action}
    </span>
  );
}

function DeviceIcon({ type }: { type: string | null }) {
  if (type === "mobile")  return <Smartphone className="h-3.5 w-3.5 text-muted-foreground" />;
  if (type === "tablet")  return <Tablet className="h-3.5 w-3.5 text-muted-foreground" />;
  if (type === "desktop") return <Monitor className="h-3.5 w-3.5 text-muted-foreground" />;
  return <Globe className="h-3.5 w-3.5 text-muted-foreground" />;
}

export default function ActivityLog() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState<"all" | "login" | "failed" | "changes">("all");
  const PAGE = 100;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["activity", search, filter, page],
    queryFn: () => {
      const q = filter === "login"   ? "login" :
                filter === "failed"  ? "failed" :
                filter === "changes" ? "create" :
                search;
      return axiosInstance
        .get<{ logs: ActivityLog[] }>(`/activity?search=${encodeURIComponent(q)}&limit=${PAGE}&offset=${page * PAGE}`)
        .then(r => r.data);
    },
  });

  const logs = data?.logs ?? [];

  const loginCount  = logs.filter(l => l.action === "login").length;
  const failedCount = logs.filter(l => l.status === "failed").length;
  const uniqueIPs   = new Set(logs.map(l => l.ipAddress).filter(Boolean)).size;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-6 w-6 text-muted-foreground" />
        <div>
          <h1 className="text-2xl font-bold">Login History &amp; Activity Log</h1>
          <p className="text-muted-foreground text-sm">Every login with GPS location, device info, and all data changes.</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => { setFilter("all"); setPage(0); }}>
          <CardContent className="pt-4 pb-4">
            <div className="text-2xl font-bold">{logs.length}</div>
            <div className="text-xs text-muted-foreground">Total Events</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => { setFilter("login"); setPage(0); }}>
          <CardContent className="pt-4 pb-4">
            <div className="text-2xl font-bold text-blue-600">{loginCount}</div>
            <div className="text-xs text-muted-foreground">Logins</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => { setFilter("failed"); setPage(0); }}>
          <CardContent className="pt-4 pb-4">
            <div className="text-2xl font-bold text-red-500">{failedCount}</div>
            <div className="text-xs text-muted-foreground">Failed Attempts</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="text-2xl font-bold text-purple-600">{uniqueIPs}</div>
            <div className="text-xs text-muted-foreground">Unique IPs</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[180px] max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Search user, action, location…"
                value={search}
                onChange={e => { setSearch(e.target.value); setFilter("all"); setPage(0); }}
              />
            </div>
            <div className="flex gap-1.5">
              {(["all", "login", "failed", "changes"] as const).map(f => (
                <Button
                  key={f}
                  size="sm"
                  variant={filter === f ? "default" : "outline"}
                  onClick={() => { setFilter(f); setSearch(""); setPage(0); }}
                  className="text-xs capitalize"
                >
                  {f}
                </Button>
              ))}
            </div>
            <Button variant="outline" size="icon" onClick={() => refetch()} className="ml-auto">
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
            <CardTitle className="text-sm text-muted-foreground">{logs.length} entries</CardTitle>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap">Time</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">User</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Action</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Device</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Location</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">IP</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Details</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={8} className="text-center py-10 text-muted-foreground">Loading…</td></tr>
                ) : logs.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-10 text-muted-foreground">No activity found</td></tr>
                ) : logs.map(log => (
                  <tr key={log.id} className="border-b hover:bg-muted/20 transition-colors">

                    {/* Time */}
                    <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString("en-PK", { timeZone: "Asia/Karachi", dateStyle: "short", timeStyle: "short" })}
                    </td>

                    {/* User */}
                    <td className="px-4 py-2.5 font-medium text-sm">
                      {log.userEmail ?? <span className="text-muted-foreground italic">—</span>}
                    </td>

                    {/* Action */}
                    <td className="px-4 py-2.5">
                      <ActionBadge action={log.action} />
                      {log.entity && (
                        <span className="ml-1.5 text-xs text-muted-foreground">
                          {log.entity}{log.entityId ? ` #${log.entityId}` : ""}
                        </span>
                      )}
                    </td>

                    {/* Device */}
                    <td className="px-4 py-2.5">
                      {(log.browser || log.os || log.deviceType) ? (
                        <div className="flex items-center gap-1.5">
                          <DeviceIcon type={log.deviceType} />
                          <div>
                            <div className="text-xs font-medium">{log.browser ?? "—"}</div>
                            <div className="text-xs text-muted-foreground">{log.os ?? "—"}</div>
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>

                    {/* Location */}
                    <td className="px-4 py-2.5">
                      {log.latitude && log.longitude ? (
                        <a
                          href={`https://www.google.com/maps?q=${log.latitude},${log.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline"
                          title={`${log.latitude}, ${log.longitude}`}
                        >
                          <MapPin className="h-3 w-3 shrink-0" />
                          {log.locationName ?? `${parseFloat(log.latitude).toFixed(3)}, ${parseFloat(log.longitude).toFixed(3)}`}
                        </a>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>

                    {/* IP */}
                    <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground whitespace-nowrap">
                      {log.ipAddress ?? "—"}
                    </td>

                    {/* Details */}
                    <td className="px-4 py-2.5 text-xs text-muted-foreground max-w-[180px] truncate" title={log.details ?? ""}>
                      {log.details ?? "—"}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-2.5">
                      <Badge
                        variant={log.status === "failed" ? "destructive" : "secondary"}
                        className="text-xs"
                      >
                        {log.status}
                      </Badge>
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {(page > 0 || logs.length === PAGE) && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">Page {page + 1}</span>
              <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={logs.length < PAGE}>
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
