import { Router, type IRouter, type Request, type Response } from "express";
import { desc, gte, ilike, or, sql, count, countDistinct } from "drizzle-orm";
import { z } from "zod/v4";
import { db, visitorLogsTable, webOrdersTable } from "@workspace/db";
import { subDays } from "date-fns";
import { getUserIdFromToken } from "../lib/auth";

/* ─── SSE visitor event bus ──────────────────────────────────────────────── */
const sseClients = new Map<string, Response>();

export interface VisitorEvent {
  page: string;
  city?: string | null;
  country?: string | null;
  device?: string | null;
  browser?: string | null;
  os?: string | null;
  referrer?: string | null;
  sessionId: string;
  timestamp: string;
}

function broadcastVisitorEvent(event: VisitorEvent) {
  const data = `data: ${JSON.stringify(event)}\n\n`;
  for (const [id, res] of sseClients) {
    try { res.write(data); }
    catch { sseClients.delete(id); }
  }
}

const router: IRouter = Router();

const TrackBody = z.object({
  sessionId: z.string(),
  page: z.string(),
  referrer: z.string().nullable().optional(),
  userAgent: z.string().optional(),
  device: z.string().nullable().optional(),
  os: z.string().nullable().optional(),
  browser: z.string().nullable().optional(),
  lat: z.number().nullable().optional(),
  lng: z.number().nullable().optional(),
  gpsAccuracy: z.number().nullable().optional(),
  // Fingerprint & hardware
  screenResolution: z.string().optional(),
  viewport: z.string().optional(),
  pixelRatio: z.string().optional(),
  colorDepth: z.string().optional(),
  touchPoints: z.string().optional(),
  platform: z.string().optional(),
  deviceMemory: z.string().optional(),
  cpuCores: z.string().optional(),
  deviceModel: z.string().optional(),
  deviceBrand: z.string().optional(),
  canvasFp: z.string().optional(),
  webglRenderer: z.string().optional(),
  webglVendor: z.string().optional(),
  // Environment
  timezone: z.string().optional(),
  language: z.string().optional(),
  languages: z.string().optional(),
  connectionType: z.string().optional(),
  batteryLevel: z.string().optional(),
  // UTM
  utmSource: z.string().optional(),
  utmMedium: z.string().optional(),
  utmCampaign: z.string().optional(),
  utmContent: z.string().optional(),
  utmTerm: z.string().optional(),
});

async function geolocateIp(ip: string): Promise<{ country: string | null; countryCode: string | null; region: string | null; city: string | null }> {
  try {
    if (!ip || ip === "127.0.0.1" || ip.startsWith("192.168.") || ip.startsWith("10.") || ip.startsWith("172.")) {
      return { country: "Local", countryCode: null, region: null, city: "localhost" };
    }
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,countryCode,regionName,city`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return { country: null, countryCode: null, region: null, city: null };
    const data = await res.json() as { status: string; country: string; countryCode: string; regionName: string; city: string };
    if (data.status !== "success") return { country: null, countryCode: null, region: null, city: null };
    return { country: data.country, countryCode: data.countryCode, region: data.regionName, city: data.city };
  } catch {
    return { country: null, countryCode: null, region: null, city: null };
  }
}

function getIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    const ips = String(forwarded).split(",").map(s => s.trim());
    return ips[0] ?? req.ip ?? "";
  }
  return req.ip ?? "";
}

function nullIfEmpty(s: string | undefined): string | null {
  return s && s.trim() ? s.trim() : null;
}

// Public endpoint — no auth
router.post("/shop/track", async (req: Request, res: Response): Promise<void> => {
  const parsed = TrackBody.safeParse(req.body);
  if (!parsed.success) { res.sendStatus(204); return; }

  const d = parsed.data;
  const ip = getIp(req);

  geolocateIp(ip).then(async (geo) => {
    try {
      await db.insert(visitorLogsTable).values({
        sessionId: d.sessionId,
        page: d.page,
        referrer: d.referrer ?? null,
        ip,
        country: geo.country,
        countryCode: geo.countryCode,
        region: geo.region,
        city: geo.city,
        lat: d.lat != null ? String(d.lat) : null,
        lng: d.lng != null ? String(d.lng) : null,
        gpsAccuracy: d.gpsAccuracy ?? null,
        device: d.device ?? null,
        os: d.os ?? null,
        browser: d.browser ?? null,
        userAgent: d.userAgent ?? null,
        screenResolution: nullIfEmpty(d.screenResolution),
        viewport: nullIfEmpty(d.viewport),
        pixelRatio: nullIfEmpty(d.pixelRatio),
        colorDepth: nullIfEmpty(d.colorDepth),
        touchPoints: nullIfEmpty(d.touchPoints),
        platform: nullIfEmpty(d.platform),
        deviceMemory: nullIfEmpty(d.deviceMemory),
        cpuCores: nullIfEmpty(d.cpuCores),
        deviceModel: nullIfEmpty(d.deviceModel),
        deviceBrand: nullIfEmpty(d.deviceBrand),
        canvasFp: nullIfEmpty(d.canvasFp),
        webglRenderer: nullIfEmpty(d.webglRenderer),
        webglVendor: nullIfEmpty(d.webglVendor),
        timezone: nullIfEmpty(d.timezone),
        language: nullIfEmpty(d.language),
        languages: nullIfEmpty(d.languages),
        connectionType: nullIfEmpty(d.connectionType),
        batteryLevel: nullIfEmpty(d.batteryLevel),
        utmSource: nullIfEmpty(d.utmSource),
        utmMedium: nullIfEmpty(d.utmMedium),
        utmCampaign: nullIfEmpty(d.utmCampaign),
        utmContent: nullIfEmpty(d.utmContent),
        utmTerm: nullIfEmpty(d.utmTerm),
      });
      broadcastVisitorEvent({
        page: d.page,
        city: geo.city ?? null,
        country: geo.country ?? null,
        device: d.device ?? null,
        browser: d.browser ?? null,
        os: d.os ?? null,
        referrer: d.referrer ?? null,
        sessionId: d.sessionId,
        timestamp: new Date().toISOString(),
      });
    } catch { /* ignore insert errors */ }
  }).catch(() => {});

  res.sendStatus(204);
});

// Admin: live visitor SSE stream — GET /visitors/stream?token=<bearer>
router.get("/visitors/stream", async (req: Request, res: Response): Promise<void> => {
  const token = (req.query.token as string | undefined) ?? "";
  if (!token) { res.sendStatus(401); return; }
  const userId = await getUserIdFromToken(token).catch(() => null);
  if (!userId) { res.sendStatus(401); return; }

  const clientId = `${userId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // disable nginx buffering
  res.flushHeaders();

  // Send a heartbeat every 20s to keep the connection alive through proxies
  res.write(": heartbeat\n\n");
  const hb = setInterval(() => {
    try { res.write(": heartbeat\n\n"); } catch { clearInterval(hb); }
  }, 20_000);

  sseClients.set(clientId, res);

  req.on("close", () => {
    clearInterval(hb);
    sseClients.delete(clientId);
  });
});

// Admin: recent visitor logs (last 24 h, up to 50)
router.get("/visitors/recent", async (req: Request, res: Response): Promise<void> => {
  const since = subDays(new Date(), 1);
  const rows = await db.select().from(visitorLogsTable)
    .where(gte(visitorLogsTable.createdAt, since))
    .orderBy(desc(visitorLogsTable.createdAt)).limit(50);
  res.json(rows.map(r => ({ ...r, lat: r.lat ?? null, lng: r.lng ?? null, createdAt: r.createdAt.toISOString() })));
});

/* ─── Traffic source helpers ─────────────────────────────────────────────── */
function parseTrafficSource(referrer: string | null, utmSource: string | null): string {
  if (utmSource) {
    if (/google/i.test(utmSource)) return "Google Ads";
    if (/facebook|fb/i.test(utmSource)) return "Facebook Ads";
    if (/instagram/i.test(utmSource)) return "Instagram Ads";
    return utmSource.charAt(0).toUpperCase() + utmSource.slice(1);
  }
  if (!referrer || referrer.trim() === "") return "Direct";
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, "").toLowerCase();
    if (/google\./i.test(host)) return "Google";
    if (/bing\./i.test(host)) return "Bing";
    if (/facebook\.|fb\.com/i.test(host)) return "Facebook";
    if (/wl\.co|wa\.me|whatsapp/i.test(host)) return "WhatsApp";
    if (/instagram\./i.test(host)) return "Instagram";
    if (/twitter\.|t\.co|x\.com/i.test(host)) return "Twitter / X";
    if (/youtube\./i.test(host)) return "YouTube";
    if (/tiktok\./i.test(host)) return "TikTok";
    if (/linkedin\./i.test(host)) return "LinkedIn";
    if (/geem\.pk|erp\.geem\.pk|sim\.geem\.pk/i.test(host)) return "Internal";
    if (/replit\./i.test(host)) return "Replit (Dev)";
    return host || "Other";
  } catch { return "Other"; }
}

function extractKeyword(referrer: string | null, utmTerm: string | null): string | null {
  if (utmTerm && utmTerm.trim()) return utmTerm.trim();
  if (!referrer) return null;
  try {
    const url = new URL(referrer);
    return url.searchParams.get("q") ?? url.searchParams.get("query") ?? url.searchParams.get("search") ?? null;
  } catch { return null; }
}

// Admin: stats
router.get("/visitors/stats", async (req: Request, res: Response): Promise<void> => {
  const days = parseInt(String(req.query.days ?? "7"), 10);
  const since = subDays(new Date(), days);
  const where = gte(visitorLogsTable.createdAt, since);

  const [{ sessions }] = await db.select({ sessions: countDistinct(visitorLogsTable.sessionId) }).from(visitorLogsTable).where(where);
  const [{ views }] = await db.select({ views: count() }).from(visitorLogsTable).where(where);
  const [{ ips }] = await db.select({ ips: countDistinct(visitorLogsTable.ip) }).from(visitorLogsTable).where(where);
  const [{ gpsCount }] = await db.select({ gpsCount: count() }).from(visitorLogsTable).where(sql`${visitorLogsTable.lat} is not null and ${visitorLogsTable.createdAt} >= ${since}`);

  const topPages = await db.select({ page: visitorLogsTable.page, count: count() })
    .from(visitorLogsTable).where(where).groupBy(visitorLogsTable.page).orderBy(desc(count())).limit(10);
  const topCountries = await db.select({ country: visitorLogsTable.country, count: count() })
    .from(visitorLogsTable).where(where).groupBy(visitorLogsTable.country).orderBy(desc(count())).limit(10);
  const topCities = await db.select({ city: visitorLogsTable.city, count: count() })
    .from(visitorLogsTable).where(where).groupBy(visitorLogsTable.city).orderBy(desc(count())).limit(10);
  const byDevice = await db.select({ device: visitorLogsTable.device, count: count() })
    .from(visitorLogsTable).where(where).groupBy(visitorLogsTable.device).orderBy(desc(count())).limit(5);
  const byBrowser = await db.select({ browser: visitorLogsTable.browser, count: count() })
    .from(visitorLogsTable).where(where).groupBy(visitorLogsTable.browser).orderBy(desc(count())).limit(5);
  const byOs = await db.select({ os: visitorLogsTable.os, count: count() })
    .from(visitorLogsTable).where(where).groupBy(visitorLogsTable.os).orderBy(desc(count())).limit(5);
  const topTimezones = await db.select({ timezone: visitorLogsTable.timezone, count: count() })
    .from(visitorLogsTable).where(where).groupBy(visitorLogsTable.timezone).orderBy(desc(count())).limit(5);
  const topDeviceModels = await db.select({ model: visitorLogsTable.deviceModel, count: count() })
    .from(visitorLogsTable).where(sql`${visitorLogsTable.deviceModel} is not null and ${visitorLogsTable.createdAt} >= ${since}`)
    .groupBy(visitorLogsTable.deviceModel).orderBy(desc(count())).limit(10);

  const recentLogs = await db.select().from(visitorLogsTable).where(where).orderBy(desc(visitorLogsTable.createdAt)).limit(100);

  // Traffic sources — fetch referrer + utmSource rows, parse server-side
  const referrerRows = await db
    .select({ referrer: visitorLogsTable.referrer, utmSource: visitorLogsTable.utmSource, utmTerm: visitorLogsTable.utmTerm })
    .from(visitorLogsTable).where(where);

  // Build traffic source counts
  const sourceMap = new Map<string, number>();
  const keywordMap = new Map<string, number>();
  const referrerDomainMap = new Map<string, number>();

  for (const row of referrerRows) {
    // Traffic source
    const source = parseTrafficSource(row.referrer, row.utmSource);
    sourceMap.set(source, (sourceMap.get(source) ?? 0) + 1);

    // Keywords
    const kw = extractKeyword(row.referrer, row.utmTerm);
    if (kw) keywordMap.set(kw, (keywordMap.get(kw) ?? 0) + 1);

    // Referrer domain
    if (row.referrer) {
      try {
        const host = new URL(row.referrer).hostname.replace(/^www\./, "");
        referrerDomainMap.set(host, (referrerDomainMap.get(host) ?? 0) + 1);
      } catch { /* skip malformed */ }
    }
  }

  const trafficSources = [...sourceMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([source, count]) => ({ source, count }));

  const topKeywords = [...keywordMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([keyword, count]) => ({ keyword, count }));

  const topReferrerDomains = [...referrerDomainMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([domain, count]) => ({ domain, count }));

  res.json({
    totalSessions: sessions,
    totalPageviews: views,
    uniqueIPs: ips,
    withGPS: gpsCount,
    topPages,
    topCountries,
    topCities,
    byDevice,
    byBrowser,
    byOs,
    topTimezones,
    topDeviceModels,
    trafficSources,
    topKeywords,
    topReferrerDomains,
    recentLogs: recentLogs.map(l => ({ ...l, lat: l.lat ?? null, lng: l.lng ?? null, createdAt: l.createdAt.toISOString() })),
  });
});

// Public: update GPS for an already-logged session row
router.post("/shop/track-gps", async (req: Request, res: Response): Promise<void> => {
  const { sessionId, lat, lng, accuracy } = req.body as { sessionId?: string; lat?: number; lng?: number; accuracy?: number };
  if (!sessionId || lat == null || lng == null) { res.sendStatus(204); return; }
  try {
    // Update the most recent log row for this session that has no GPS yet
    await db.execute(
      sql`UPDATE visitor_logs SET lat = ${String(lat)}, lng = ${String(lng)}, gps_accuracy = ${Math.round(accuracy ?? 0)}
          WHERE id = (
            SELECT id FROM visitor_logs WHERE session_id = ${sessionId}
            ORDER BY created_at DESC LIMIT 1
          ) AND lat IS NULL`
    );
  } catch { /* ignore */ }
  res.sendStatus(204);
});

// Admin: visitor profiles (grouped by device fingerprint)
router.get("/visitors/profiles", async (req: Request, res: Response): Promise<void> => {
  const days = parseInt(String(req.query.days ?? "30"), 10);
  const since = subDays(new Date(), days);

  // All logs in window that have a fingerprint
  const logs = await db.select().from(visitorLogsTable)
    .where(sql`${visitorLogsTable.createdAt} >= ${since} AND ${visitorLogsTable.canvasFp} IS NOT NULL`)
    .orderBy(desc(visitorLogsTable.createdAt));

  // Group by canvasFp
  const profileMap = new Map<string, {
    fp: string; device: string | null; os: string | null; browser: string | null;
    deviceModel: string | null; deviceBrand: string | null; webglRenderer: string | null;
    screenResolution: string | null; deviceMemory: string | null; cpuCores: string | null;
    batteryLevel: string | null; connectionType: string | null;
    ip: string | null; country: string | null; city: string | null; region: string | null;
    lat: string | null; lng: string | null; timezone: string | null; language: string | null;
    platform: string | null;
    pages: string[]; sessionIds: Set<string>; firstSeen: string; lastSeen: string;
  }>();

  for (const log of logs) {
    const fp = log.canvasFp!;
    if (!profileMap.has(fp)) {
      profileMap.set(fp, {
        fp, device: log.device, os: log.os, browser: log.browser,
        deviceModel: log.deviceModel, deviceBrand: log.deviceBrand,
        webglRenderer: log.webglRenderer, screenResolution: log.screenResolution,
        deviceMemory: log.deviceMemory, cpuCores: log.cpuCores,
        batteryLevel: log.batteryLevel, connectionType: log.connectionType,
        ip: log.ip, country: log.country, city: log.city, region: log.region,
        lat: log.lat ? String(log.lat) : null, lng: log.lng ? String(log.lng) : null,
        timezone: log.timezone, language: log.language, platform: log.platform,
        pages: [], sessionIds: new Set(), firstSeen: log.createdAt.toISOString(), lastSeen: log.createdAt.toISOString(),
      });
    }
    const p = profileMap.get(fp)!;
    if (!p.pages.includes(log.page)) p.pages.push(log.page);
    p.sessionIds.add(log.sessionId);
    if (log.createdAt.toISOString() < p.firstSeen) p.firstSeen = log.createdAt.toISOString();
    if (log.createdAt.toISOString() > p.lastSeen)  p.lastSeen  = log.createdAt.toISOString();
    // Prefer richer data (later logs may have GPS / model)
    if (!p.deviceModel && log.deviceModel) p.deviceModel = log.deviceModel;
    if (!p.lat && log.lat) { p.lat = String(log.lat); p.lng = String(log.lng); }
  }

  // Match with web_orders by visitorFp
  const orders = await db.select({
    visitorFp: webOrdersTable.visitorFp,
    orderNumber: webOrdersTable.orderNumber,
    customerName: webOrdersTable.customerName,
    customerMobile: webOrdersTable.customerMobile,
    customerEmail: webOrdersTable.customerEmail,
    customerCity: webOrdersTable.customerCity,
    customerAddress: webOrdersTable.customerAddress,
    total: webOrdersTable.total,
    status: webOrdersTable.status,
    createdAt: webOrdersTable.createdAt,
  }).from(webOrdersTable)
    .where(sql`${webOrdersTable.visitorFp} IS NOT NULL`)
    .orderBy(desc(webOrdersTable.createdAt));

  // Build a map: fp → orders
  const ordersByFp = new Map<string, typeof orders>();
  for (const o of orders) {
    if (!o.visitorFp) continue;
    const list = ordersByFp.get(o.visitorFp) ?? [];
    list.push(o);
    ordersByFp.set(o.visitorFp, list);
  }

  const profiles = Array.from(profileMap.values()).map(p => ({
    fp: p.fp,
    device: p.device, os: p.os, browser: p.browser,
    deviceModel: p.deviceModel, deviceBrand: p.deviceBrand,
    webglRenderer: p.webglRenderer, screenResolution: p.screenResolution,
    deviceMemory: p.deviceMemory, cpuCores: p.cpuCores,
    batteryLevel: p.batteryLevel, connectionType: p.connectionType,
    ip: p.ip, country: p.country, city: p.city, region: p.region,
    lat: p.lat, lng: p.lng, timezone: p.timezone, language: p.language, platform: p.platform,
    pageCount: p.pages.length,
    sessionCount: p.sessionIds.size,
    pages: p.pages,
    productPages: p.pages.filter(pg => pg.startsWith("/shop/product/")),
    firstSeen: p.firstSeen,
    lastSeen: p.lastSeen,
    orders: (ordersByFp.get(p.fp) ?? []).map(o => ({
      orderNumber: o.orderNumber,
      customerName: o.customerName,
      customerMobile: o.customerMobile,
      customerEmail: o.customerEmail,
      customerCity: o.customerCity,
      customerAddress: o.customerAddress,
      total: parseFloat(String(o.total)),
      status: o.status,
      createdAt: o.createdAt.toISOString(),
    })),
  }));

  // Sort: profiles with orders first, then by lastSeen desc
  profiles.sort((a, b) => {
    if (a.orders.length !== b.orders.length) return b.orders.length - a.orders.length;
    return b.lastSeen.localeCompare(a.lastSeen);
  });

  res.json({ profiles, total: profiles.length });
});

// Admin: live sessions (last N minutes, grouped by session)
router.get("/visitors/live", async (req: Request, res: Response): Promise<void> => {
  const minutes = Math.min(60, Math.max(1, parseInt(String(req.query.minutes ?? "15"), 10)));
  const since = new Date(Date.now() - minutes * 60 * 1000);

  const rows = await db.select().from(visitorLogsTable)
    .where(gte(visitorLogsTable.createdAt, since))
    .orderBy(desc(visitorLogsTable.createdAt));

  // Group by sessionId
  type Session = {
    sessionId: string; ip: string | null;
    country: string | null; city: string | null; region: string | null;
    lat: string | null; lng: string | null; gpsAccuracy: number | null;
    device: string | null; os: string | null; browser: string | null;
    deviceModel: string | null; deviceBrand: string | null;
    webglRenderer: string | null; screenResolution: string | null;
    deviceMemory: string | null; cpuCores: string | null;
    batteryLevel: string | null; connectionType: string | null;
    canvasFp: string | null; timezone: string | null; language: string | null;
    pages: { page: string; time: string }[];
    firstSeen: string; lastSeen: string;
    utmSource: string | null;
  };

  const sessionMap = new Map<string, Session>();
  for (const row of rows) {
    if (!sessionMap.has(row.sessionId)) {
      sessionMap.set(row.sessionId, {
        sessionId: row.sessionId,
        ip: row.ip, country: row.country, city: row.city, region: row.region,
        lat: row.lat ? String(row.lat) : null,
        lng: row.lng ? String(row.lng) : null,
        gpsAccuracy: row.gpsAccuracy ?? null,
        device: row.device, os: row.os, browser: row.browser,
        deviceModel: row.deviceModel, deviceBrand: row.deviceBrand,
        webglRenderer: row.webglRenderer, screenResolution: row.screenResolution,
        deviceMemory: row.deviceMemory, cpuCores: row.cpuCores,
        batteryLevel: row.batteryLevel, connectionType: row.connectionType,
        canvasFp: row.canvasFp, timezone: row.timezone, language: row.language,
        pages: [], firstSeen: row.createdAt.toISOString(), lastSeen: row.createdAt.toISOString(),
        utmSource: row.utmSource ?? null,
      });
    }
    const s = sessionMap.get(row.sessionId)!;
    s.pages.push({ page: row.page, time: row.createdAt.toISOString() });
    if (row.createdAt.toISOString() < s.firstSeen) s.firstSeen = row.createdAt.toISOString();
    if (row.createdAt.toISOString() > s.lastSeen)  s.lastSeen  = row.createdAt.toISOString();
    // Prefer richer GPS / device data
    if (!s.lat && row.lat) { s.lat = String(row.lat); s.lng = row.lng ? String(row.lng) : null; s.gpsAccuracy = row.gpsAccuracy ?? null; }
    if (!s.deviceModel && row.deviceModel) s.deviceModel = row.deviceModel;
  }

  // Sort by lastSeen desc (most recent first)
  const sessions = Array.from(sessionMap.values())
    .sort((a, b) => b.lastSeen.localeCompare(a.lastSeen))
    .map(s => ({
      ...s,
      // pages sorted oldest→newest
      pages: s.pages.sort((a, b) => a.time.localeCompare(b.time)),
      durationMs: new Date(s.lastSeen).getTime() - new Date(s.firstSeen).getTime(),
    }));

  res.json({ sessions, total: sessions.length, since: since.toISOString() });
});

// Admin: paginated logs
router.get("/visitors", async (req: Request, res: Response): Promise<void> => {
  const days = parseInt(String(req.query.days ?? "7"), 10);
  const search = String(req.query.search ?? "").trim();
  const since = subDays(new Date(), days);

  const baseWhere = gte(visitorLogsTable.createdAt, since);
  const searchWhere = search ? or(
    ilike(visitorLogsTable.ip, `%${search}%`),
    ilike(visitorLogsTable.page, `%${search}%`),
    ilike(visitorLogsTable.city, `%${search}%`),
    ilike(visitorLogsTable.country, `%${search}%`),
    ilike(visitorLogsTable.browser, `%${search}%`),
    ilike(visitorLogsTable.deviceModel, `%${search}%`),
    ilike(visitorLogsTable.os, `%${search}%`),
  ) : undefined;

  const where = searchWhere ? sql`${baseWhere} AND ${searchWhere}` : baseWhere;
  const [{ total }] = await db.select({ total: count() }).from(visitorLogsTable).where(where);
  const logs = await db.select().from(visitorLogsTable).where(where).orderBy(desc(visitorLogsTable.createdAt)).limit(200);

  res.json({
    logs: logs.map(l => ({ ...l, lat: l.lat ?? null, lng: l.lng ?? null, createdAt: l.createdAt.toISOString() })),
    total,
  });
});

export default router;
