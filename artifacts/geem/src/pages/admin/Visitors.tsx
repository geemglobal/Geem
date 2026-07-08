import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { axiosInstance } from "@/lib/axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Monitor, Smartphone, Tablet, Globe, MapPin, Eye, Users, Cpu, Wifi, Battery, Fingerprint, ShoppingBag, User, Clock, ExternalLink, Package } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

interface VisitorLog {
  id: number; sessionId: string; page: string; referrer: string | null;
  ip: string | null; country: string | null; city: string | null; region: string | null;
  lat: string | null; lng: string | null; gpsAccuracy: number | null;
  device: string | null; os: string | null; browser: string | null; userAgent: string | null;
  screenResolution: string | null; viewport: string | null; pixelRatio: string | null;
  colorDepth: string | null; touchPoints: string | null; platform: string | null;
  deviceMemory: string | null; cpuCores: string | null;
  deviceModel: string | null; deviceBrand: string | null;
  canvasFp: string | null; webglRenderer: string | null; webglVendor: string | null;
  timezone: string | null; language: string | null; languages: string | null;
  connectionType: string | null; batteryLevel: string | null;
  utmSource: string | null; utmMedium: string | null; utmCampaign: string | null;
  utmContent: string | null; utmTerm: string | null;
  createdAt: string;
}

interface VisitorStats {
  totalSessions: number; totalPageviews: number; uniqueIPs: number; withGPS: number;
  topPages: { page: string; count: number }[];
  topCountries: { country: string; count: number }[];
  topCities: { city: string; count: number }[];
  byDevice: { device: string; count: number }[];
  byBrowser: { browser: string; count: number }[];
  byOs: { os: string; count: number }[];
  topTimezones: { timezone: string; count: number }[];
  topDeviceModels: { model: string; count: number }[];
  recentLogs: VisitorLog[];
}

interface VisitorOrder {
  orderNumber: string; customerName: string; customerMobile: string;
  customerEmail: string | null; customerCity: string; customerAddress: string;
  total: number; status: string; createdAt: string;
}

interface VisitorProfile {
  fp: string;
  device: string | null; os: string | null; browser: string | null;
  deviceModel: string | null; deviceBrand: string | null;
  webglRenderer: string | null; screenResolution: string | null;
  deviceMemory: string | null; cpuCores: string | null;
  batteryLevel: string | null; connectionType: string | null;
  ip: string | null; country: string | null; city: string | null; region: string | null;
  lat: string | null; lng: string | null; timezone: string | null;
  language: string | null; platform: string | null;
  pageCount: number; sessionCount: number;
  pages: string[]; productPages: string[];
  firstSeen: string; lastSeen: string;
  orders: VisitorOrder[];
}

const PIE_COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

function DeviceIcon({ device }: { device: string | null }) {
  if (device === "mobile") return <Smartphone className="h-3.5 w-3.5" />;
  if (device === "tablet") return <Tablet className="h-3.5 w-3.5" />;
  return <Monitor className="h-3.5 w-3.5" />;
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex gap-2 text-xs">
      <span className="text-muted-foreground w-32 shrink-0">{label}</span>
      <span className="font-mono break-all">{value}</span>
    </div>
  );
}

function slugToTitle(slug: string): string {
  return slug.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function productUrl(page: string): string {
  return `https://geem.pk${page}`;
}

function statusColor(status: string) {
  const map: Record<string, string> = {
    new: "bg-blue-100 text-blue-700",
    confirmed: "bg-indigo-100 text-indigo-700",
    shipped: "bg-amber-100 text-amber-700",
    delivered: "bg-green-100 text-green-700",
    cancelled: "bg-red-100 text-red-700",
  };
  return map[status] ?? "bg-muted text-muted-foreground";
}

function ProfileCard({ profile, onClick }: { profile: VisitorProfile; onClick: () => void }) {
  const hasOrder = profile.orders.length > 0;
  const customer = profile.orders[0];
  const deviceLabel = profile.deviceModel || profile.deviceBrand || (profile.device === "mobile" ? "Mobile" : profile.device === "tablet" ? "Tablet" : "Desktop");

  return (
    <div
      onClick={onClick}
      className={`rounded-xl border p-4 cursor-pointer hover:shadow-md transition-shadow space-y-3 ${hasOrder ? "border-green-300 bg-green-50/30" : "border-border bg-card"}`}
    >
      {/* Top row: device + customer match */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`p-1.5 rounded-lg ${hasOrder ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>
            <DeviceIcon device={profile.device} />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">{deviceLabel}</p>
            <p className="text-xs text-muted-foreground">{profile.os} · {profile.browser}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {hasOrder && (
            <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-green-200">
              <ShoppingBag className="h-3 w-3" /> {profile.orders.length} order{profile.orders.length > 1 ? "s" : ""}
            </span>
          )}
          <span className="text-[10px] text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">FP·{profile.fp.slice(-6)}</span>
        </div>
      </div>

      {/* Customer identity (if matched) */}
      {customer && (
        <div className="rounded-lg bg-green-100/50 border border-green-200 px-3 py-2 space-y-0.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-green-800">
            <User className="h-3.5 w-3.5" /> {customer.customerName}
          </div>
          <div className="text-xs text-green-700">📱 {customer.customerMobile}</div>
          <div className="text-xs text-green-700">📍 {customer.customerCity} — {customer.customerAddress}</div>
          {customer.customerEmail && <div className="text-xs text-green-700">✉️ {customer.customerEmail}</div>}
        </div>
      )}

      {/* Product interests */}
      {profile.productPages.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Product Interest</p>
          <div className="flex flex-wrap gap-1">
            {profile.productPages.slice(0, 4).map(pg => {
              const slug = pg.replace("/shop/product/", "");
              return (
                <a
                  key={pg}
                  href={productUrl(pg)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  className="inline-flex items-center gap-1 text-[10px] bg-primary/8 border border-primary/20 text-primary rounded px-1.5 py-0.5 hover:bg-primary/15 transition-colors"
                >
                  <Package className="h-2.5 w-2.5" />
                  {slugToTitle(slug).slice(0, 22)}{slugToTitle(slug).length > 22 ? "…" : ""}
                  <ExternalLink className="h-2.5 w-2.5 opacity-60" />
                </a>
              );
            })}
            {profile.productPages.length > 4 && (
              <span className="text-[10px] text-muted-foreground px-1.5 py-0.5">+{profile.productPages.length - 4} more</span>
            )}
          </div>
        </div>
      )}

      {/* Stats row */}
      <div className="flex items-center gap-3 text-[10px] text-muted-foreground pt-0.5 border-t border-border">
        <span className="flex items-center gap-0.5"><Eye className="h-3 w-3" /> {profile.pageCount} pages</span>
        <span className="flex items-center gap-0.5"><Clock className="h-3 w-3" /> {profile.sessionCount} sessions</span>
        {(profile.city || profile.country) && (
          <span className="flex items-center gap-0.5"><Globe className="h-3 w-3" /> {[profile.city, profile.country].filter(Boolean).join(", ")}</span>
        )}
        <span className="ml-auto">{new Date(profile.lastSeen).toLocaleDateString("en-PK", { timeZone: "Asia/Karachi" })}</span>
      </div>
    </div>
  );
}

function ProfileDetail({ profile, onClose }: { profile: VisitorProfile; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <Fingerprint className="h-4 w-4" />
            Visitor Profile — FP·{profile.fp.slice(-8)}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-5 text-sm">

          {/* Orders / Customer */}
          {profile.orders.length > 0 && (
            <section>
              <p className="font-semibold text-xs uppercase tracking-wide text-green-700 mb-2 flex items-center gap-1.5">
                <ShoppingBag className="h-3.5 w-3.5" /> Matched Customer & Orders
              </p>
              <div className="space-y-3">
                {profile.orders.map(o => (
                  <div key={o.orderNumber} className="rounded-lg border border-green-200 bg-green-50 px-3 py-2.5 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-green-800">#{o.orderNumber}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusColor(o.status)}`}>{o.status}</span>
                    </div>
                    <p className="font-semibold text-sm">{o.customerName}</p>
                    <p className="text-xs text-muted-foreground">📱 {o.customerMobile}</p>
                    {o.customerEmail && <p className="text-xs text-muted-foreground">✉️ {o.customerEmail}</p>}
                    <p className="text-xs text-muted-foreground">📍 {o.customerCity} — {o.customerAddress}</p>
                    <p className="text-xs font-medium text-green-800">Rs {o.total.toLocaleString()} · {new Date(o.createdAt).toLocaleString("en-PK", { timeZone: "Asia/Karachi" })}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Product pages visited */}
          {profile.productPages.length > 0 && (
            <section>
              <p className="font-semibold text-xs uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
                <Package className="h-3.5 w-3.5" /> Products Viewed ({profile.productPages.length})
              </p>
              <div className="space-y-1.5">
                {profile.productPages.map(pg => {
                  const slug = pg.replace("/shop/product/", "");
                  return (
                    <a
                      key={pg}
                      href={productUrl(pg)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 hover:bg-primary/10 transition-colors"
                    >
                      <Package className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                      <span className="text-sm font-medium text-primary flex-1">{slugToTitle(slug)}</span>
                      <ExternalLink className="h-3 w-3 text-primary/60 flex-shrink-0" />
                    </a>
                  );
                })}
              </div>
            </section>
          )}

          {/* All pages */}
          <section>
            <p className="font-semibold text-xs uppercase tracking-wide text-muted-foreground mb-2">
              All Pages Visited ({profile.pages.length}) · {profile.sessionCount} sessions
            </p>
            <div className="space-y-0.5 max-h-40 overflow-y-auto">
              {profile.pages.map(pg => (
                <div key={pg} className="flex items-center gap-2 text-xs">
                  <span className="font-mono text-muted-foreground flex-1 truncate">{pg}</span>
                  <a href={`https://geem.pk${pg}`} target="_blank" rel="noopener noreferrer"
                    className="text-primary hover:underline flex-shrink-0">
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              ))}
            </div>
          </section>

          {/* Device */}
          <section>
            <p className="font-semibold text-xs uppercase tracking-wide text-muted-foreground mb-2">Device</p>
            <div className="space-y-1">
              <Row label="Type" value={profile.device} />
              <Row label="Model" value={profile.deviceModel} />
              <Row label="Brand" value={profile.deviceBrand} />
              <Row label="OS" value={profile.os} />
              <Row label="Browser" value={profile.browser} />
              <Row label="Platform" value={profile.platform} />
              <Row label="Screen" value={profile.screenResolution} />
              <Row label="RAM" value={profile.deviceMemory ? `${profile.deviceMemory} GB` : null} />
              <Row label="CPU Cores" value={profile.cpuCores} />
              <Row label="GPU" value={profile.webglRenderer} />
              <Row label="Battery" value={profile.batteryLevel} />
              <Row label="Connection" value={profile.connectionType} />
            </div>
          </section>

          {/* Location */}
          <section>
            <p className="font-semibold text-xs uppercase tracking-wide text-muted-foreground mb-2">Location</p>
            <div className="space-y-1">
              <Row label="IP" value={profile.ip} />
              <Row label="Location" value={[profile.city, profile.region, profile.country].filter(Boolean).join(", ")} />
              <Row label="Timezone" value={profile.timezone} />
              <Row label="Language" value={profile.language} />
              {profile.lat && profile.lng && (
                <div className="flex gap-2 text-xs">
                  <span className="text-muted-foreground w-32 shrink-0">GPS</span>
                  <a href={`https://maps.google.com/?q=${profile.lat},${profile.lng}`} target="_blank" rel="noopener noreferrer"
                    className="text-primary hover:underline font-mono">
                    {parseFloat(profile.lat).toFixed(5)}, {parseFloat(profile.lng).toFixed(5)}
                  </a>
                </div>
              )}
            </div>
          </section>

          {/* Fingerprint */}
          <section>
            <p className="font-semibold text-xs uppercase tracking-wide text-muted-foreground mb-2">Fingerprint</p>
            <div className="space-y-1">
              <Row label="Canvas FP" value={profile.fp} />
              <Row label="First seen" value={new Date(profile.firstSeen).toLocaleString("en-PK", { timeZone: "Asia/Karachi" })} />
              <Row label="Last seen" value={new Date(profile.lastSeen).toLocaleString("en-PK", { timeZone: "Asia/Karachi" })} />
            </div>
          </section>

        </div>
      </DialogContent>
    </Dialog>
  );
}

function VisitorDetail({ log, onClose }: { log: VisitorLog; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">Visitor Detail — {new Date(log.createdAt).toLocaleString("en-PK", { timeZone: "Asia/Karachi" })}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <section>
            <p className="font-semibold text-xs uppercase tracking-wide text-muted-foreground mb-2">Network</p>
            <div className="space-y-1">
              <Row label="IP" value={log.ip} />
              <Row label="Country" value={[log.city, log.region, log.country].filter(Boolean).join(", ")} />
              <Row label="GPS" value={log.lat && log.lng ? `${parseFloat(log.lat).toFixed(5)}, ${parseFloat(log.lng).toFixed(5)} (±${log.gpsAccuracy}m)` : null} />
              <Row label="Connection" value={log.connectionType} />
            </div>
          </section>
          <section>
            <p className="font-semibold text-xs uppercase tracking-wide text-muted-foreground mb-2">Device</p>
            <div className="space-y-1">
              <Row label="Type" value={log.device} />
              <Row label="Model" value={log.deviceModel} />
              <Row label="Brand" value={log.deviceBrand} />
              <Row label="OS" value={log.os} />
              <Row label="Browser" value={log.browser} />
              <Row label="Platform" value={log.platform} />
            </div>
          </section>
          <section>
            <p className="font-semibold text-xs uppercase tracking-wide text-muted-foreground mb-2">Hardware</p>
            <div className="space-y-1">
              <Row label="Screen" value={log.screenResolution} />
              <Row label="Viewport" value={log.viewport} />
              <Row label="Pixel Ratio" value={log.pixelRatio ? `${log.pixelRatio}x` : null} />
              <Row label="Color Depth" value={log.colorDepth ? `${log.colorDepth}-bit` : null} />
              <Row label="Touch Points" value={log.touchPoints} />
              <Row label="RAM" value={log.deviceMemory ? `${log.deviceMemory} GB` : null} />
              <Row label="CPU Cores" value={log.cpuCores} />
              <Row label="Battery" value={log.batteryLevel} />
              <Row label="GPU" value={log.webglRenderer} />
              <Row label="GPU Vendor" value={log.webglVendor} />
            </div>
          </section>
          <section>
            <p className="font-semibold text-xs uppercase tracking-wide text-muted-foreground mb-2">Fingerprint</p>
            <div className="space-y-1">
              <Row label="Canvas FP" value={log.canvasFp} />
              <Row label="Session ID" value={log.sessionId} />
            </div>
          </section>
          {(log.utmSource || log.utmMedium || log.utmCampaign) && (
            <section>
              <p className="font-semibold text-xs uppercase tracking-wide text-muted-foreground mb-2">UTM / Traffic Source</p>
              <div className="space-y-1">
                <Row label="Source" value={log.utmSource} />
                <Row label="Medium" value={log.utmMedium} />
                <Row label="Campaign" value={log.utmCampaign} />
                <Row label="Content" value={log.utmContent} />
                <Row label="Term" value={log.utmTerm} />
                <Row label="Referrer" value={log.referrer} />
              </div>
            </section>
          )}
          <section>
            <p className="font-semibold text-xs uppercase tracking-wide text-muted-foreground mb-2">Page</p>
            <div className="space-y-1">
              <Row label="Path" value={log.page} />
              <Row label="Referrer" value={log.referrer} />
            </div>
          </section>
          <section>
            <p className="font-semibold text-xs uppercase tracking-wide text-muted-foreground mb-2">User Agent</p>
            <p className="text-xs font-mono text-muted-foreground break-all bg-muted rounded p-2">{log.userAgent ?? "—"}</p>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Visitors() {
  const [days, setDays] = useState("7");
  const [profileDays, setProfileDays] = useState("30");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<VisitorLog | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<VisitorProfile | null>(null);
  const [tab, setTab] = useState<"profiles" | "analytics" | "log">("profiles");
  const [profileSearch, setProfileSearch] = useState("");

  const { data: stats, isLoading } = useQuery({
    queryKey: ["visitor-stats", days],
    queryFn: () => axiosInstance.get<VisitorStats>(`/visitors/stats?days=${days}`).then(r => r.data),
    refetchInterval: 30000,
  });

  const { data: logs } = useQuery({
    queryKey: ["visitor-logs", days, search],
    queryFn: () => axiosInstance.get<{ logs: VisitorLog[]; total: number }>(`/visitors?days=${days}&search=${search}`).then(r => r.data),
    enabled: tab === "log",
  });

  const { data: profilesData, isLoading: profilesLoading } = useQuery({
    queryKey: ["visitor-profiles", profileDays],
    queryFn: () => axiosInstance.get<{ profiles: VisitorProfile[]; total: number }>(`/visitors/profiles?days=${profileDays}`).then(r => r.data),
    refetchInterval: 60000,
  });

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading visitor data...</div>;

  const allLogs = logs?.logs ?? stats?.recentLogs ?? [];
  const profiles = profilesData?.profiles ?? [];
  const filteredProfiles = profileSearch
    ? profiles.filter(p =>
        p.orders.some(o => o.customerName.toLowerCase().includes(profileSearch.toLowerCase()) || o.customerMobile.includes(profileSearch) || o.customerCity.toLowerCase().includes(profileSearch.toLowerCase())) ||
        (p.deviceModel ?? "").toLowerCase().includes(profileSearch.toLowerCase()) ||
        (p.ip ?? "").includes(profileSearch) ||
        p.productPages.some(pg => pg.includes(profileSearch.toLowerCase()))
      )
    : profiles;

  const withOrders = profiles.filter(p => p.orders.length > 0).length;
  const withProducts = profiles.filter(p => p.productPages.length > 0).length;

  return (
    <div className="space-y-5">
      {selected && <VisitorDetail log={selected} onClose={() => setSelected(null)} />}
      {selectedProfile && <ProfileDetail profile={selectedProfile} onClose={() => setSelectedProfile(null)} />}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Visitor Intelligence</h1>
          <p className="text-muted-foreground text-sm">Device fingerprints, product interests, and customer identity matching</p>
        </div>
        <div className="flex items-center gap-2">
          {tab !== "profiles" && (
            <Select value={days} onValueChange={setDays}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Today</SelectItem>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-border">
        {([
          { id: "profiles", label: "Visitor Profiles", icon: Users },
          { id: "analytics", label: "Analytics", icon: Eye },
          { id: "log", label: "Raw Log", icon: Fingerprint },
        ] as const).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === t.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
            {t.id === "profiles" && profiles.length > 0 && (
              <span className="ml-1 text-[10px] bg-primary text-primary-foreground rounded-full px-1.5 py-0.5">{profiles.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── PROFILES TAB ─────────────────────────────────────────────────────── */}
      {tab === "profiles" && (
        <div className="space-y-5">
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Unique Devices", value: profiles.length, icon: Fingerprint, color: "text-blue-600" },
              { label: "With Orders", value: withOrders, icon: ShoppingBag, color: "text-green-600" },
              { label: "Viewing Products", value: withProducts, icon: Package, color: "text-orange-600" },
              { label: "Total Orders", value: profiles.reduce((s, p) => s + p.orders.length, 0), icon: ShoppingBag, color: "text-purple-600" },
            ].map(({ label, value, icon: Icon, color }) => (
              <Card key={label}><CardContent className="pt-5 pb-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase font-medium tracking-wide">{label}</p>
                    <p className="text-2xl font-bold mt-1">{value.toLocaleString()}</p>
                  </div>
                  <div className={`p-2 rounded-lg bg-muted ${color}`}><Icon className="h-4 w-4" /></div>
                </div>
              </CardContent></Card>
            ))}
          </div>

          {/* Controls */}
          <div className="flex items-center gap-3 flex-wrap">
            <Select value={profileDays} onValueChange={setProfileDays}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="60">Last 60 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder="Search name, mobile, city, product, IP..."
              value={profileSearch}
              onChange={e => setProfileSearch(e.target.value)}
              className="max-w-xs"
            />
            <span className="text-sm text-muted-foreground">{filteredProfiles.length} profiles</span>
          </div>

          {/* Profile grid */}
          {profilesLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading profiles...</div>
          ) : filteredProfiles.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No visitor profiles yet — they appear as visitors browse the shop</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredProfiles.map(profile => (
                <ProfileCard key={profile.fp} profile={profile} onClick={() => setSelectedProfile(profile)} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── ANALYTICS TAB ────────────────────────────────────────────────────── */}
      {tab === "analytics" && (
        <div className="space-y-6">
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Sessions", value: stats?.totalSessions, icon: Users, color: "text-blue-600" },
              { label: "Pageviews", value: stats?.totalPageviews, icon: Eye, color: "text-green-600" },
              { label: "Unique IPs", value: stats?.uniqueIPs, icon: Globe, color: "text-orange-600" },
              { label: "With GPS", value: stats?.withGPS, icon: MapPin, color: "text-purple-600" },
            ].map(({ label, value, icon: Icon, color }) => (
              <Card key={label}><CardContent className="pt-5 pb-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase font-medium tracking-wide">{label}</p>
                    <p className="text-2xl font-bold mt-1">{(value ?? 0).toLocaleString()}</p>
                  </div>
                  <div className={`p-2 rounded-lg bg-muted ${color}`}><Icon className="h-4 w-4" /></div>
                </div>
              </CardContent></Card>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader><CardTitle>Top Pages</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats?.topPages ?? []} margin={{ top: 0, right: 10, left: 0, bottom: 30 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="page" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" interval={0} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="count" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} name="Views" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Device Type</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={stats?.byDevice ?? []} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="count" nameKey="device">
                        {(stats?.byDevice ?? []).map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => [v.toLocaleString(), "Sessions"]} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap gap-2 justify-center mt-1">
                  {(stats?.byDevice ?? []).map((d, i) => (
                    <div key={d.device} className="flex items-center gap-1 text-xs">
                      <div className="h-2 w-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span>{d.device ?? "unknown"}: {d.count}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Globe className="h-4 w-4" />Countries</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-1.5">
                  {(stats?.topCountries ?? []).slice(0, 8).map(c => (
                    <div key={c.country} className="flex items-center justify-between text-sm">
                      <span>{c.country ?? "Unknown"}</span><span className="font-medium">{c.count}</span>
                    </div>
                  ))}
                  {!stats?.topCountries?.length && <p className="text-sm text-muted-foreground text-center py-4">No data yet</p>}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Monitor className="h-4 w-4" />Browser / OS</CardTitle></CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground uppercase font-medium mb-1">Browser</p>
                <div className="space-y-1 mb-3">
                  {(stats?.byBrowser ?? []).map(b => (
                    <div key={b.browser} className="flex justify-between text-sm">
                      <span>{b.browser ?? "Other"}</span><span className="font-medium">{b.count}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground uppercase font-medium mb-1">OS</p>
                <div className="space-y-1">
                  {(stats?.byOs ?? []).map(o => (
                    <div key={o.os} className="flex justify-between text-sm">
                      <span>{o.os ?? "Unknown"}</span><span className="font-medium">{o.count}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Cpu className="h-4 w-4" />Device Models</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-1.5">
                  {(stats?.topDeviceModels ?? []).map(m => (
                    <div key={m.model} className="flex justify-between text-sm">
                      <span className="truncate mr-2">{m.model ?? "Unknown"}</span><span className="font-medium shrink-0">{m.count}</span>
                    </div>
                  ))}
                  {!stats?.topDeviceModels?.length && <p className="text-sm text-muted-foreground text-center py-4">Device models appear for Android Chrome visitors</p>}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle>Top Cities</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-1.5">
                  {(stats?.topCities ?? []).slice(0, 8).map(c => (
                    <div key={c.city} className="flex justify-between text-sm">
                      <span>{c.city ?? "Unknown"}</span><span className="font-medium">{c.count}</span>
                    </div>
                  ))}
                  {!stats?.topCities?.length && <p className="text-sm text-muted-foreground text-center py-4">No data yet</p>}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Wifi className="h-4 w-4" />Timezones</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-1.5">
                  {(stats?.topTimezones ?? []).map(t => (
                    <div key={t.timezone} className="flex justify-between text-sm">
                      <span>{t.timezone ?? "Unknown"}</span><span className="font-medium">{t.count}</span>
                    </div>
                  ))}
                  {!stats?.topTimezones?.length && <p className="text-sm text-muted-foreground text-center py-4">No data yet</p>}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ── RAW LOG TAB ──────────────────────────────────────────────────────── */}
      {tab === "log" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <CardTitle className="flex items-center gap-2">
                <Fingerprint className="h-4 w-4" /> Visitor Log
                <Badge variant="secondary">{logs?.total ?? allLogs.length}</Badge>
              </CardTitle>
              <Input placeholder="Filter by IP, page, city, model..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs" />
            </div>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Time</TableHead>
                  <TableHead>Page</TableHead>
                  <TableHead>IP / Location</TableHead>
                  <TableHead>Device / Model</TableHead>
                  <TableHead>Browser / OS</TableHead>
                  <TableHead>Hardware</TableHead>
                  <TableHead>GPS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allLogs.map(log => (
                  <TableRow key={log.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelected(log)}>
                    <TableCell className="pl-6 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString("en-PK", { timeZone: "Asia/Karachi", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </TableCell>
                    <TableCell className="text-xs max-w-[140px]">
                      <p className="font-mono text-muted-foreground truncate">{log.page}</p>
                      {log.page.startsWith("/shop/product/") && (
                        <a href={productUrl(log.page)} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                          className="text-primary hover:underline text-[10px] flex items-center gap-0.5">
                          <ExternalLink className="h-2.5 w-2.5" /> {slugToTitle(log.page.replace("/shop/product/", "")).slice(0, 20)}
                        </a>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-xs">
                        <p className="font-mono text-muted-foreground">{log.ip ?? "—"}</p>
                        {(log.city || log.country) && <p>{[log.city, log.country].filter(Boolean).join(", ")}</p>}
                        {log.timezone && <p className="text-muted-foreground">{log.timezone}</p>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-start gap-1.5 text-xs">
                        <DeviceIcon device={log.device} />
                        <div>
                          <p>{log.deviceModel || log.device || "—"}</p>
                          {log.deviceBrand && <p className="text-muted-foreground">{log.deviceBrand}</p>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">
                      <p>{log.browser ?? "—"}</p>
                      <p className="text-muted-foreground">{log.os ?? ""}</p>
                      {log.language && <p className="text-muted-foreground">{log.language}</p>}
                    </TableCell>
                    <TableCell className="text-xs">
                      {log.screenResolution && <p>{log.screenResolution}</p>}
                      <div className="flex gap-2 text-muted-foreground flex-wrap">
                        {log.deviceMemory && <span className="flex items-center gap-0.5"><Cpu className="h-3 w-3" />{log.deviceMemory}GB</span>}
                        {log.batteryLevel && <span className="flex items-center gap-0.5"><Battery className="h-3 w-3" />{log.batteryLevel}</span>}
                        {log.connectionType && <span className="flex items-center gap-0.5"><Wifi className="h-3 w-3" />{log.connectionType}</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      {log.lat && log.lng ? (
                        <a href={`https://maps.google.com/?q=${log.lat},${log.lng}`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
                          <Badge variant="outline" className="text-xs cursor-pointer hover:bg-muted">
                            <MapPin className="h-3 w-3 mr-1" />{parseFloat(log.lat).toFixed(3)}, {parseFloat(log.lng).toFixed(3)}
                          </Badge>
                        </a>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                  </TableRow>
                ))}
                {!allLogs.length && (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No visitor data yet</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
