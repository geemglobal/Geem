import { pgTable, serial, text, timestamp, numeric, integer } from "drizzle-orm/pg-core";

export const visitorLogsTable = pgTable("visitor_logs", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  page: text("page").notNull(),
  referrer: text("referrer"),
  ip: text("ip"),
  country: text("country"),
  countryCode: text("country_code"),
  region: text("region"),
  city: text("city"),
  lat: numeric("lat", { precision: 10, scale: 6 }),
  lng: numeric("lng", { precision: 10, scale: 6 }),
  gpsAccuracy: integer("gps_accuracy"),
  device: text("device"),
  os: text("os"),
  browser: text("browser"),
  userAgent: text("user_agent"),
  // Device fingerprint & hardware
  screenResolution: text("screen_resolution"),
  viewport: text("viewport"),
  pixelRatio: text("pixel_ratio"),
  colorDepth: text("color_depth"),
  touchPoints: text("touch_points"),
  platform: text("platform"),
  deviceMemory: text("device_memory"),
  cpuCores: text("cpu_cores"),
  // Device identity (UA Client Hints — Android Chrome gives exact model)
  deviceModel: text("device_model"),
  deviceBrand: text("device_brand"),
  // Unique device fingerprint
  canvasFp: text("canvas_fp"),
  webglRenderer: text("webgl_renderer"),
  webglVendor: text("webgl_vendor"),
  // User environment
  timezone: text("timezone"),
  language: text("language"),
  languages: text("languages"),
  // Network & battery
  connectionType: text("connection_type"),
  batteryLevel: text("battery_level"),
  // Traffic source
  utmSource: text("utm_source"),
  utmMedium: text("utm_medium"),
  utmCampaign: text("utm_campaign"),
  utmContent: text("utm_content"),
  utmTerm: text("utm_term"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
