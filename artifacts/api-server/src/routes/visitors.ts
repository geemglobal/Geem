import { Router, type IRouter, type Request, type Response } from "express";
import { desc, gte, ilike, or, sql, count, countDistinct } from "drizzle-orm";
import { z } from "zod/v4";
import { db, visitorLogsTable, webOrdersTable } from "@workspace/db";
import { subDays } from "date-fns";

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
    } catch { /* ignore insert errors */ }
  }).catch(() => {});

  res.sendStatus(204);
});

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
