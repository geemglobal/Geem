import { useEffect, useRef } from "react";
import { useLocation } from "wouter";

function getOrCreateSessionId(): string {
  let sid = sessionStorage.getItem("geem_sid");
  if (!sid) {
    sid = crypto.randomUUID();
    sessionStorage.setItem("geem_sid", sid);
  }
  return sid;
}

function parseUA(): { device: string; os: string; browser: string } {
  const ua = navigator.userAgent;
  const device = /Mobile|Android|iPhone|iPad/.test(ua) ? (/iPad/.test(ua) ? "tablet" : "mobile") : "desktop";
  const os =
    /Windows NT 10/.test(ua) ? "Windows 10" :
    /Windows NT 11/.test(ua) ? "Windows 11" :
    /Windows/.test(ua) ? "Windows" :
    /Mac OS X/.test(ua) ? "macOS" :
    /Android/.test(ua) ? "Android" :
    /iPhone|iPad/.test(ua) ? "iOS" :
    /Linux/.test(ua) ? "Linux" : "Unknown";
  const browser =
    /Edg\//.test(ua) ? "Edge" :
    /OPR\/|Opera/.test(ua) ? "Opera" :
    /SamsungBrowser/.test(ua) ? "Samsung" :
    /Chrome/.test(ua) ? "Chrome" :
    /Firefox/.test(ua) ? "Firefox" :
    /Safari/.test(ua) ? "Safari" : "Other";
  return { device, os, browser };
}

function canvasFp(): string {
  try {
    const c = document.createElement("canvas");
    c.width = 220; c.height = 30;
    const ctx = c.getContext("2d");
    if (!ctx) return "";
    ctx.textBaseline = "top";
    ctx.font = "14px Arial";
    ctx.fillStyle = "#f60";
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = "#069";
    ctx.fillText("Geem.pk\u2603", 2, 15);
    ctx.fillStyle = "rgba(102,204,0,0.7)";
    ctx.fillText("Geem.pk\u2603", 4, 17);
    const data = c.toDataURL();
    let h = 0;
    for (let i = 0; i < data.length; i++) h = ((h << 5) - h + data.charCodeAt(i)) | 0;
    return String(Math.abs(h));
  } catch { return ""; }
}

function webglInfo(): { renderer: string; vendor: string } {
  try {
    const c = document.createElement("canvas");
    const gl = (c.getContext("webgl") || c.getContext("experimental-webgl")) as WebGLRenderingContext | null;
    if (!gl) return { renderer: "", vendor: "" };
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    if (!ext) return { renderer: "", vendor: "" };
    return {
      renderer: (gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) as string) || "",
      vendor: (gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) as string) || "",
    };
  } catch { return { renderer: "", vendor: "" }; }
}

interface FingerprintData {
  screenResolution: string;
  viewport: string;
  pixelRatio: string;
  colorDepth: string;
  touchPoints: string;
  platform: string;
  deviceMemory: string;
  cpuCores: string;
  deviceModel: string;
  deviceBrand: string;
  canvasFp: string;
  webglRenderer: string;
  webglVendor: string;
  timezone: string;
  language: string;
  languages: string;
  connectionType: string;
  batteryLevel: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmContent: string;
  utmTerm: string;
}

async function collectFingerprint(): Promise<FingerprintData> {
  // UA Client Hints — gives exact device model on Android Chrome silently
  let deviceModel = "";
  let deviceBrand = "";
  try {
    type UAData = {
      getHighEntropyValues: (hints: string[]) => Promise<{
        model?: string;
        brands?: Array<{ brand: string; version: string }>;
      }>;
    };
    if ("userAgentData" in navigator) {
      const uad = (navigator as unknown as { userAgentData: UAData }).userAgentData;
      const data = await uad.getHighEntropyValues(["model", "brands"]);
      deviceModel = data.model ?? "";
      const brand = (data.brands ?? []).find(b => !b.brand.includes("Not") && !b.brand.includes("Chromium"));
      deviceBrand = brand?.brand ?? "";
    }
  } catch { /* not supported */ }

  // Try to extract device model from Android UA if Client Hints failed
  if (!deviceModel) {
    const ua = navigator.userAgent;
    const m = ua.match(/\(Linux; Android [^;]+; ([^)]+)\)/);
    if (m) deviceModel = m[1].trim();
  }

  // Battery — works in Chrome
  let batteryLevel = "";
  try {
    type BatteryManager = { level: number; charging: boolean };
    if ("getBattery" in navigator) {
      const bat = await (navigator as unknown as { getBattery: () => Promise<BatteryManager> }).getBattery();
      batteryLevel = `${Math.round(bat.level * 100)}%${bat.charging ? " ⚡" : ""}`;
    }
  } catch { /* not supported */ }

  // Network Information API
  let connectionType = "";
  try {
    type NetworkInfo = { effectiveType?: string; type?: string };
    const conn = (navigator as unknown as { connection?: NetworkInfo }).connection;
    if (conn) connectionType = conn.effectiveType ?? conn.type ?? "";
  } catch { /* not supported */ }

  const { renderer, vendor } = webglInfo();
  const params = new URLSearchParams(window.location.search);

  return {
    screenResolution: `${screen.width}x${screen.height}`,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    pixelRatio: String(window.devicePixelRatio || ""),
    colorDepth: String(screen.colorDepth || ""),
    touchPoints: String(navigator.maxTouchPoints || 0),
    platform: navigator.platform || "",
    deviceMemory: "deviceMemory" in navigator ? String((navigator as unknown as { deviceMemory: number }).deviceMemory) : "",
    cpuCores: String(navigator.hardwareConcurrency || ""),
    deviceModel,
    deviceBrand,
    canvasFp: canvasFp(),
    webglRenderer: renderer,
    webglVendor: vendor,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    language: navigator.language || "",
    languages: navigator.languages?.join(", ") || "",
    connectionType,
    batteryLevel,
    utmSource: params.get("utm_source") ?? "",
    utmMedium: params.get("utm_medium") ?? "",
    utmCampaign: params.get("utm_campaign") ?? "",
    utmContent: params.get("utm_content") ?? "",
    utmTerm: params.get("utm_term") ?? "",
  };
}

const GPS_KEY = "geem_gps_v2";
const GPS_TTL_MS = 30 * 60 * 1000; // 30 minutes

function getCachedGps(): { lat: number; lng: number; accuracy: number } | null {
  try {
    const raw = localStorage.getItem(GPS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { lat: number; lng: number; accuracy: number; ts: number };
    if (Date.now() - parsed.ts > GPS_TTL_MS) return null;
    return { lat: parsed.lat, lng: parsed.lng, accuracy: parsed.accuracy };
  } catch { return null; }
}

function saveCachedGps(lat: number, lng: number, accuracy: number) {
  try {
    localStorage.setItem(GPS_KEY, JSON.stringify({ lat, lng, accuracy, ts: Date.now() }));
  } catch { /* ignore */ }
}

async function sendTrackingData(page: string, gpsCoords?: { lat: number; lng: number; accuracy: number }) {
  try {
    const { device, os, browser } = parseUA();
    const fp = await collectFingerprint();
    // Persist canvasFp in sessionStorage AND localStorage so Checkout can attach it to orders
    if (fp.canvasFp) {
      sessionStorage.setItem("geem_canvas_fp", fp.canvasFp);
      localStorage.setItem("geem_canvas_fp", fp.canvasFp);
    }
    await fetch("/api/shop/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: getOrCreateSessionId(),
        page,
        referrer: document.referrer || null,
        userAgent: navigator.userAgent,
        device, os, browser,
        lat: gpsCoords?.lat ?? null,
        lng: gpsCoords?.lng ?? null,
        gpsAccuracy: gpsCoords ? Math.round(gpsCoords.accuracy) : null,
        ...fp,
      }),
    });
  } catch { /* non-critical */ }
}

// Send GPS patch AFTER the main tracking row is already inserted
async function patchGps(lat: number, lng: number, accuracy: number) {
  try {
    await fetch("/api/shop/track-gps", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: getOrCreateSessionId(), lat, lng, accuracy }),
    });
  } catch { /* non-critical */ }
}

// Always try GPS — if permission already granted it succeeds silently,
// if denied the error callback fires silently. No sessionStorage gate.
function requestGpsAndPatch(onSuccess?: (coords: { lat: number; lng: number; accuracy: number }) => void) {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
      saveCachedGps(coords.lat, coords.lng, coords.accuracy);
      onSuccess?.(coords);
    },
    () => { /* denied or unavailable — fine */ },
    { timeout: 15000, maximumAge: 300000, enableHighAccuracy: false },
  );
}

export function ShopTracker() {
  const [location] = useLocation();
  const firstPage = useRef(true);

  useEffect(() => {
    // 1. Send tracking immediately with cached GPS (or none)
    const cached = getCachedGps();
    void sendTrackingData(location, cached ?? undefined);

    // 2. On first page load, also request fresh GPS in background.
    //    When it resolves, patch the just-inserted log row with real coords.
    if (firstPage.current) {
      firstPage.current = false;
      if (!cached) {
        // No cached coords — request GPS and patch the backend when done
        requestGpsAndPatch((coords) => {
          void patchGps(coords.lat, coords.lng, coords.accuracy);
        });
      } else {
        // Have cached coords — silently refresh in background for next visit
        requestGpsAndPatch();
      }
    }
  }, [location]);

  return null;
}
