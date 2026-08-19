import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, couriersTable } from "@workspace/db";
import { logger } from "../lib/logger";

const router: IRouter = Router();
const TRACKING_TIMEOUT_MS = 10_000;

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

function extractDetails(html: string): TrackingDetail[] {
  const details: TrackingDetail[] = [];
  const rows = html.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi) ?? [];

  for (const row of rows) {
    const cells = (row.match(/<t[hd]\b[^>]*>[\s\S]*?<\/t[hd]>/gi) ?? [])
      .map(cleanHtml)
      .filter(Boolean);
    if (cells.length >= 2) {
      details.push({ label: cells[0].replace(/:$/, ""), value: cells.slice(1).join(" — ") });
    }
  }

  return details.filter((detail, index, all) =>
    all.findIndex(candidate => candidate.label === detail.label && candidate.value === detail.value) === index,
  ).slice(0, 30);
}

function visibleText(html: string): string {
  return cleanHtml(
    html
      .replace(/<(script|style|noscript|svg)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
      .replace(/<\/(p|div|li|tr|td|th|h[1-6])>/gi, "\n"),
  );
}

function officialTrackingUrl(provider: string | null, template: string | null, cn: string): string | null {
  const encodedCn = encodeURIComponent(cn);
  if (provider === "leopard") {
    return `https://pk.leopardscourier.com/shipment_tracking_view?cn_number=${encodedCn}`;
  }
  if (!template) return null;
  return template.replace(/\{cn\}/gi, encodedCn);
}

function formatStatus(value: string): string {
  return value.replace(/[-_]+/g, " ").replace(/\b\w/g, character => character.toUpperCase());
}

function getStatus(details: TrackingDetail[], text: string, html: string): string | null {
  const row = details.find(detail => /status|current state|shipment state/i.test(detail.label));
  if (row) return row.value;

  const classMatch = html.match(/<[^>]+\bclass=["'][^"']*\btracking-status-([a-z-]+)/i);
  if (classMatch?.[1]) return formatStatus(classMatch[1]);

  const statusMatch = text.match(/\b(delivered|out for delivery|in transit|dispatched|booked|returned|cancelled|pending)\b/i);
  return statusMatch?.[1] ? formatStatus(statusMatch[1]) : null;
}

router.get("/couriers/:id/track", async (req, res): Promise<void> => {
  const id = Number.parseInt(String(req.params.id), 10);
  const cn = typeof req.query.cn === "string" ? req.query.cn.trim() : "";

  if (!Number.isInteger(id) || !cn || cn.length > 120) {
    res.status(400).json({ error: "A valid courier and CN are required" });
    return;
  }

  const [courier] = await db
    .select({
      name: couriersTable.name,
      apiProvider: couriersTable.apiProvider,
      trackingUrl: couriersTable.trackingUrl,
    })
    .from(couriersTable)
    .where(eq(couriersTable.id, id));

  if (!courier) {
    res.status(404).json({ error: "Courier not found" });
    return;
  }

  const sourceUrl = officialTrackingUrl(courier.apiProvider, courier.trackingUrl, cn);

  // Leopards exposes the same public page used by its tracking form. Fetch only
  // that page and return a small structured summary; never forward the HTML.
  if (courier.apiProvider !== "leopard" || !sourceUrl) {
    res.json({
      courier: courier.name,
      provider: courier.apiProvider,
      cn,
      found: false,
      supported: false,
      status: null,
      details: [],
      message: "Live lookup is not available for this courier yet.",
      sourceUrl,
    });
    return;
  }

  try {
    const response = await fetch(sourceUrl, {
      headers: { "User-Agent": "Geem ERP shipment status checker/1.0" },
      signal: AbortSignal.timeout(TRACKING_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`Official site returned ${response.status}`);

    const html = await response.text();
    const text = visibleText(html);
    const notFound = /invalid\s*\/?\s*record\s*not found|no shipment data|not found/i.test(text);
    const details = extractDetails(html);

    res.json({
      courier: courier.name,
      provider: courier.apiProvider,
      cn,
      found: !notFound,
      supported: true,
      status: notFound ? null : getStatus(details, text, html),
      details,
      message: notFound
        ? "The official courier website could not find this CN."
        : "Live status fetched from the official courier website.",
      sourceUrl,
    });
  } catch (error) {
    logger.warn({ err: error, courier: courier.apiProvider }, "Official courier tracking lookup failed");
    res.status(502).json({
      error: "The official courier tracking website is temporarily unavailable",
      sourceUrl,
    });
  }
});

export default router;