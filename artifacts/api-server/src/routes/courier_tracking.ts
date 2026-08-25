import { Router, type IRouter, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { db, couriersTable } from "@workspace/db";
import { logger } from "../lib/logger";

const router: IRouter = Router();
const TRACKING_TIMEOUT_MS = 15_000;

type TrackingEvent = {
  date: string;
  time: string | null;
  description: string;
};

type TrackingDetail = { label: string; value: string };

function decodeHtml(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'");
}

function cleanHtml(value: string): string {
  return decodeHtml(value.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function textFromBlock(value: string): string {
  return cleanHtml(value.replace(/<(script|style|noscript|svg)\b[^>]*>[\s\S]*?<\/\1>/gi, " "));
}

function firstMatch(html: string, expressions: RegExp[]): string | null {
  for (const expression of expressions) {
    const match = html.match(expression);
    if (match?.[1]) return textFromBlock(match[1]);
  }
  return null;
}

function extractField(html: string, label: string): string | null {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return firstMatch(html, [
    new RegExp(`<[^>]*>\\s*<b>\\s*${escaped}\\s*:?\\s*<\\/b>\\s*([\\s\\S]*?)(?=<[^>]*>\\s*<b>|<\\/tr>)`, "i"),
    new RegExp(`<[^>]*>\\s*${escaped}\\s*:?\\s*<\\/[^>]+>\\s*<[^>]+>\\s*([\\s\\S]*?)<\\/tr>`, "i"),
  ]);
}

function extractEvents(html: string): TrackingEvent[] {
  const blocks = html.match(/<div[^>]*class=["'][^"']*\btracking-item\b[^"']*["'][^>]*>[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/gi) ?? [];
  const events: TrackingEvent[] = [];

  for (const block of blocks) {
    const date = firstMatch(block, [
      /class=["'][^"']*\btracking-date\b[^"']*["'][^>]*>[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/i,
      /class=["'][^"']*\btracking-date\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
    ]);
    const content = firstMatch(block, [
      /class=["'][^"']*\btracking-content\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
    ]);
    if (!date || !content) continue;

    const timeMatch = date.match(/\(([^)]+)\)/);
    events.push({
      date: date.replace(/\([^)]*\)/g, "").trim(),
      time: timeMatch?.[1]?.trim() ?? null,
      description: content,
    });
  }

  return events.filter((event, index, all) =>
    all.findIndex(candidate =>
      candidate.date === event.date &&
      candidate.time === event.time &&
      candidate.description === event.description,
    ) === index,
  );
}

function extractDetails(html: string): TrackingDetail[] {
  const labels = [
    ["Origin", "Origin"],
    ["Destination", "Destination"],
    ["Shipper", "Shipper"],
    ["Consignee", "Consignee"],
    ["Reference No.", "Reference No."],
    ["Booking Date", "Booking Date"],
    ["Pieces", "Pieces"],
    ["Packet Weight", "Packet Weight"],
  ] as const;

  return labels
    .map(([label, source]) => ({ label: String(label), value: extractField(html, source) }))
    .filter((detail): detail is TrackingDetail => typeof detail.value === "string" && detail.value.length > 0);
}

function officialTrackingUrl(provider: string | null, template: string | null, cn: string): string | null {
  const encodedCn = encodeURIComponent(cn);
  if (provider === "leopard") {
    return `https://pk.leopardscourier.com/shipment_tracking_view?cn_number=${encodedCn}`;
  }
  if (!template) return null;
  return template.replace(/\{cn\}/gi, encodedCn);
}

function statusFromHtml(html: string, events: TrackingEvent[]): string | null {
  const delivered = firstMatch(html, [
    /class=["'][^"']*\btracking-status-delivered\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
  ]);
  if (delivered) return "Delivered";
  const latest = events[0]?.description;
  return latest ? latest.replace(/\s+in\s+.+$/i, "").trim() : null;
}

function parseTrackingPage(html: string, cn: string) {
  const text = textFromBlock(html);
  const notFound = /invalid\s*\/?\s*record|no shipment data found|shipment not found/i.test(text);
  const events = notFound ? [] : extractEvents(html);
  const details = notFound ? [] : extractDetails(html);

  return {
    cn,
    found: !notFound,
    status: notFound ? null : statusFromHtml(html, events),
    details,
    events,
    origin: notFound ? null : extractField(html, "Origin"),
    destination: notFound ? null : extractField(html, "Destination"),
    shipper: notFound ? null : extractField(html, "Shipper"),
    consignee: notFound ? null : extractField(html, "Consignee"),
    referenceNo: notFound ? null : extractField(html, "Reference No."),
    bookingDate: notFound ? null : extractField(html, "Booking Date"),
    pieces: notFound ? null : extractField(html, "Pieces"),
    packetWeight: notFound ? null : extractField(html, "Packet Weight"),
    signedFor: notFound ? null : firstMatch(html, [
      /Signed\s+for\s+by\s*:\s*<\/[^>]+>\s*([\s\S]*?)(?=<|Dated)/i,
      /Signed\s+for\s+by\s*:\s*([\s\S]*?)(?=<|Dated)/i,
    ]),
    deliveredTo: notFound ? null : firstMatch(html, [
      /Delivered\s+to\s+([^<]+?)(?:<\/|$)/i,
    ]),
    deliveredAt: notFound ? null : firstMatch(html, [
      /Dated\s*:\s*<\/[^>]+>\s*([\s\S]*?)(?=<)/i,
      /Dated\s*:\s*([\s\S]*?)(?=<)/i,
    ]),
  };
}

async function fetchLeopardTracking(cn: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TRACKING_TIMEOUT_MS);
  try {
    const lookup = await fetch("https://pk.leopardscourier.com/shipment_tracking-new", {
      method: "GET",
      headers: { "User-Agent": "Geem ERP shipment status checker/1.0" },
      signal: controller.signal,
    });
    if (!lookup.ok) throw new Error(`Leopards lookup page returned ${lookup.status}`);

    const cookies = lookup.headers.get("set-cookie") ?? "";
    const lookupResult = await fetch(
      `https://pk.leopardscourier.com/shipment_tracking-new?cn_number=${encodeURIComponent(cn)}`,
      {
        headers: {
          "User-Agent": "Geem ERP shipment status checker/1.0",
          ...(cookies ? { Cookie: cookies.split(",").map(cookie => cookie.split(";")[0]).join("; ") } : {}),
        },
        signal: controller.signal,
      },
    );
    if (!lookupResult.ok) throw new Error(`Leopards tracking lookup returned ${lookupResult.status}`);
    const lookupJson = await lookupResult.json() as { success?: boolean };
    if (!lookupJson.success) return null;

    const page = await fetch("https://pk.leopardscourier.com/shipment_tracking_view", {
      headers: {
        "User-Agent": "Geem ERP shipment status checker/1.0",
        ...(cookies ? { Cookie: cookies.split(",").map(cookie => cookie.split(";")[0]).join("; ") } : {}),
      },
      signal: controller.signal,
    });
    if (!page.ok) throw new Error(`Leopards tracking page returned ${page.status}`);
    return parseTrackingPage(await page.text(), cn);
  } finally {
    clearTimeout(timeout);
  }
}

async function getCourier(provider: string | null, id: number | null) {
  if (id) {
    const [courier] = await db.select({
      id: couriersTable.id,
      name: couriersTable.name,
      apiProvider: couriersTable.apiProvider,
      trackingUrl: couriersTable.trackingUrl,
    }).from(couriersTable).where(eq(couriersTable.id, id));
    return courier;
  }
  if (!provider) return undefined;
  const [courier] = await db.select({
    id: couriersTable.id,
    name: couriersTable.name,
    apiProvider: couriersTable.apiProvider,
    trackingUrl: couriersTable.trackingUrl,
  }).from(couriersTable).where(eq(couriersTable.apiProvider, provider));
  return courier;
}

async function track(req: Request, res: Response): Promise<void> {
  const rawId = typeof req.params?.id === "string" ? req.params.id : "";
  const id = rawId ? Number.parseInt(rawId, 10) : null;
  const provider = typeof req.query?.provider === "string" ? req.query.provider.trim().toLowerCase() : null;
  const cn = typeof req.query?.cn === "string" ? req.query.cn.trim() : "";

  if ((!id && !provider) || !cn || cn.length > 120) {
    res.status(400).json({ error: "A valid courier and CN are required" });
    return;
  }

  const courier = await getCourier(provider, Number.isInteger(id) ? id : null);
  if (!courier) {
    res.status(404).json({ error: "Courier not found" });
    return;
  }

  const sourceUrl = officialTrackingUrl(courier.apiProvider, courier.trackingUrl, cn);
  const base = {
    courier: courier.name,
    provider: courier.apiProvider,
    cn,
    sourceUrl,
  };

  if (courier.apiProvider !== "leopard") {
    res.json({
      ...base,
      found: false,
      supported: false,
      status: null,
      details: [],
      events: [],
      message: "Live lookup is not available for this courier yet.",
    });
    return;
  }

  try {
    const tracking = await fetchLeopardTracking(cn);
    res.json({
      ...base,
      ...(tracking ?? {
        cn,
        found: false,
        status: null,
        details: [],
        events: [],
        message: "The official courier website could not find this CN.",
      }),
      supported: true,
      message: tracking?.found
        ? "Live status fetched from Leopards Courier."
        : "The official courier website could not find this CN.",
    });
  } catch (error) {
    logger.warn({ err: error, courier: courier.apiProvider }, "Official courier tracking lookup failed");
    res.status(502).json({
      ...base,
      error: "The official courier tracking website is temporarily unavailable",
    });
  }
}

router.get("/couriers/:id/track", track);
router.get("/courier-tracking", track);

export default router;