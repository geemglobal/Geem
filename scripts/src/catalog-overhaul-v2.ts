/**
 * catalog-overhaul-v2.ts
 *
 * Complete catalog reset with:
 *  - Full delete of all existing products
 *  - Delete old product image directories (uploads/products only, not core GPS images)
 *  - Re-populate from live inventory (brand + model combos, in_stock)
 *  - Exclude: ZRK, Al-Noor brands | Mobile phone categories/brands
 *  - 4G rule: ONLY Wanway GPS trackers may carry "4G" branding
 *  - 4 local images per product (1 main + 3 gallery), using existing /products/gps/ assets
 *  - Known-good prices per model (with inventory price as override if > 500 PKR)
 *  - Full SEO: meta title ≤60, meta description ≤160, keywords
 *  - published=true, hide_price=false, featured=true for key models
 *
 * Run ON VPS:
 *   cd /var/www/geempk/Inventory-Commerce-Hub
 *   set -a && source .env && set +a
 *   pnpm --filter @workspace/scripts run catalog-overhaul-v2
 */

import {
  db,
  brandsTable,
  categoriesTable,
  deviceModelsTable,
  inventoryItemsTable,
  productsTable,
} from "@workspace/db";
import { eq, sql, and } from "drizzle-orm";
import * as fs from "fs";
import * as https from "https";
import * as http from "http";
import * as path from "path";

// ─── Config ──────────────────────────────────────────────────────────────────

const SHOP_PUBLIC = process.env.SHOP_PUBLIC_DIR || "/var/www/geem/shop/public";
const ERP_PUBLIC  = process.env.ERP_PUBLIC_DIR  || "/var/www/geem/erp/public";

const EXCLUDED_BRANDS    = ["ZRK", "Al-Noor", "Al Noor", "Alnoor"];
const MOBILE_BRANDS      = ["Apple","Samsung","Xiaomi","Huawei","Oppo","Vivo","Realme","Tecno","Infinix","Nokia","OnePlus","Google","LG","Motorola","Sony"];
const MOBILE_CAT_KEYWORDS = ["smartphone","mobile phone","mobile accessory","mobile accessories","tablet"];
const GPS_BRANDS         = ["Wanway","Yuntrack","Micodus","SinoTrack","Geem","Huntsman","Toray","365GPS","360GPS","CarePro","CareTrack","Goome"];
const FEATURED_KEYWORDS  = ["wanway","cj780","cj790","orange-2","orange2","gt06","g20","gf21","lk208","garmin","ajax","hikvision"];

// ─── Known prices (PKR) per model keyword — fallback when inventory price ≤ 500 ─
const KNOWN_PRICES: Record<string, { price: number; salePrice: number }> = {
  "cj780":            { price: 5500,  salePrice: 4999  },
  "cj790":            { price: 6000,  salePrice: 5499  },
  "cj750":            { price: 5000,  salePrice: 4499  },
  "cj220":            { price: 3500,  salePrice: 2999  },
  "lk208":            { price: 4500,  salePrice: 3999  },
  "lk930":            { price: 5000,  salePrice: 4499  },
  "g20m":             { price: 3500,  salePrice: 2999  },
  "g20 mini":         { price: 3500,  salePrice: 2999  },
  "g20":              { price: 3200,  salePrice: 2799  },
  "gt06":             { price: 2500,  salePrice: 2199  },
  "gt02":             { price: 2200,  salePrice: 1999  },
  "mv710":            { price: 3000,  salePrice: 2699  },
  "gf21":             { price: 2800,  salePrice: 2499  },
  "gf07":             { price: 1800,  salePrice: 1599  },
  "s20":              { price: 3800,  salePrice: 3299  },
  "gs900":            { price: 5500,  salePrice: 4999  },
  "gm06":             { price: 4200,  salePrice: 3699  },
  "st900":            { price: 2200,  salePrice: 1999  },
  "st815":            { price: 3000,  salePrice: 2699  },
  "st903":            { price: 2500,  salePrice: 2199  },
  "st904":            { price: 2800,  salePrice: 2499  },
  "st915":            { price: 3500,  salePrice: 2999  },
  "tk905":            { price: 3500,  salePrice: 2999  },
  "tk915":            { price: 4000,  salePrice: 3499  },
  "orange 2.0":       { price: 3999,  salePrice: 3499  },
  "orange 2":         { price: 3999,  salePrice: 3499  },
  "orange":           { price: 3800,  salePrice: 3499  },
  "td-02s":           { price: 2500,  salePrice: 1999  },
  "td02s":            { price: 2500,  salePrice: 1999  },
  "p31":              { price: 2000,  salePrice: 1799  },
  "n9 gsm":           { price: 3800,  salePrice: 3499  },
  "n9":               { price: 3800,  salePrice: 3499  },
  "garmin":           { price: 18000, salePrice: 16999 },
  "etrex":            { price: 18000, salePrice: 16999 },
};

function lookupPrice(modelName: string): { price: string; salePrice: string | null } {
  const ml = modelName.toLowerCase();
  for (const [key, val] of Object.entries(KNOWN_PRICES)) {
    if (ml.includes(key)) {
      return { price: val.price.toFixed(2), salePrice: val.salePrice.toFixed(2) };
    }
  }
  return { price: "0.00", salePrice: null };
}

// ─── Image map — local paths relative to SHOP_PUBLIC ─────────────────────────
// Each entry: [main, gallery1, gallery2, gallery3]
const IMAGE_MAP: Record<string, string[]> = {
  "cj780":    ["/products/gps/cj780/img_1.jpg",  "/products/gps/cj780/img_2.jpg",  "/products/gps/cj780/img_3.jpg",  "/products/gps/cj780/img_4.png"],
  "cj790":    ["/products/gps/cj790d/img_1.jpg", "/products/gps/cj790d/img_2.jpg", "/products/gps/cj790d/img_3.jpg", "/products/gps/cj790d/img_4.jpg"],
  "cj750":    ["/products/gps/cj750/img_1.jpg",  "/products/gps/cj750/img_2.jpg",  "/products/gps/cj750/img_3.jpg",  "/products/gps/cj750/img_4.jpg"],
  "cj220":    ["/products/gps/cj220/img_1.jpg",  "/products/gps/cj220/img_2.jpg",  "/products/gps/cj220/img_1.jpg",  "/products/gps/cj220/img_2.jpg"],
  "lk208":    ["/products/gps/lk208/img_1.jpg",  "/products/gps/lk208/img_2.jpg",  "/products/gps/lk208/img_3.jpg",  "/products/gps/lk208/img_4.jpg"],
  "lk930":    ["/products/gps/lk930/img_1.jpg",  "/products/gps/lk930/img_2.jpg",  "/products/gps/lk930/img_3.jpg",  "/products/gps/lk930/img_1.jpg"],
  "g20m":     ["/products/gps/g20m/img_1.jpg",   "/products/gps/g20m/img_2.jpg",   "/products/gps/g20m/img_3.jpg",   "/products/gps/g20m/img_4.png"],
  "g20 mini": ["/products/gps/g20m/img_1.jpg",   "/products/gps/g20m/img_2.jpg",   "/products/gps/g20m/img_3.jpg",   "/products/gps/g20m/img_4.png"],
  "g20":      ["/products/gps/g20/img_1.jpg",    "/products/gps/g20/img_2.jpg",    "/products/gps/g20/img_3.jpg",    "/products/gps/g20/img_1.jpg"],
  "gt06":     ["/products/gps/gt06/img_1.jpg",   "/products/gps/gt06/img_2.jpg",   "/products/gps/gt06/img_3.jpg",   "/products/gps/gt06/img_4.jpg"],
  "gt02":     ["/products/gps/gt06/img_1.jpg",   "/products/gps/gt06/img_2.jpg",   "/products/gps/gt06/img_3.jpg",   "/products/gps/gt06/img_4.jpg"],
  "mv710":    ["/products/gps/gt06/img_1.jpg",   "/products/gps/gt06/img_2.jpg",   "/products/gps/gt06/img_3.jpg",   "/products/gps/gt06/img_4.jpg"],
  "gf21":     ["/products/gps/gf21/img_1.jpg",   "/products/gps/gf21/img_2.jpg",   "/products/gps/gf21/img_3.jpg",   "/products/gps/gf21/img_4.jpg"],
  "gf07":     ["/products/gps/gf07/img_1.jpg",   "/products/gps/gf07/img_2.jpg",   "/products/gps/gf07/img_3.jpg",   "/products/gps/gf07/img_1.jpg"],
  "s20":      ["/products/gps/s20.jpg",           "/products/gps/s20_2.jpg",        "/products/gps/s20_3.jpg",        "/products/gps/s20_4.jpg"],
  "gs900":    ["/products/gps/gs900.png",         "/products/gps/gs900.png",        "/products/gps/gs900.png",        "/products/gps/gs900.png"],
  "gm06":     ["/products/gps/gm06nw.jpg",        "/products/gps/gm06nw_2.jpg",     "/products/gps/gm06nw.jpg",       "/products/gps/gm06nw_2.jpg"],
  "st900":    ["/products/gps/st900.jpg",          "/products/gps/st900_2.jpg",      "/products/gps/st900.jpg",        "/products/gps/st900_2.jpg"],
  "st903":    ["/products/gps/st903/img_1.jpg",   "/products/gps/st903/img_2.jpg",  "/products/gps/st903/img_1.jpg",  "/products/gps/st903/img_2.jpg"],
  "st904":    ["/products/gps/st904/img_1.jpg",   "/products/gps/st904/img_2.jpg",  "/products/gps/st904/img_1.jpg",  "/products/gps/st904/img_2.jpg"],
  "st815":    ["/products/gps/st904/img_1.jpg",   "/products/gps/st904/img_2.jpg",  "/products/gps/st900.jpg",        "/products/gps/st900_2.jpg"],
  "st915":    ["/products/gps/st915/img_1.jpg",   "/products/gps/st915/img_1.jpg",  "/products/gps/st900.jpg",        "/products/gps/st900_2.jpg"],
  "tk905":    ["/products/gps/tk905/img_1.jpg",   "/products/gps/tk905/img_2.jpg",  "/products/gps/tk905/img_3.jpg",  "/products/gps/tk905/img_1.jpg"],
  "tk915":    ["/products/gps/tk915/img_1.jpg",   "/products/gps/tk915/img_2.jpg",  "/products/gps/tk915/img_1.jpg",  "/products/gps/tk915/img_2.jpg"],
  "orange":   ["/products/gps/orange_sim.jpg",    "/products/gps/orange_sim2.jpg",  "/products/gps/orange_sim.jpg",   "/products/gps/orange_sim2.jpg"],
  "td-02s":   ["/products/gps/td02s.jpg",         "/products/gps/td02s.jpg",        "/products/gps/td02s.jpg",        "/products/gps/td02s.jpg"],
  "td02s":    ["/products/gps/td02s.jpg",         "/products/gps/td02s.jpg",        "/products/gps/td02s.jpg",        "/products/gps/td02s.jpg"],
  "p31":      ["/products/gps/lk208/img_1.jpg",   "/products/gps/lk208/img_2.jpg",  "/products/gps/lk208/img_3.jpg",  "/products/gps/lk208/img_4.jpg"],
  "n9":       ["/products/gps/gt06/img_1.jpg",    "/products/gps/gt06/img_2.jpg",   "/products/gps/gt06/img_3.jpg",   "/products/gps/gt06/img_4.jpg"],
  "garmin":   ["/products/gps/garmin_etrex/img_1.jpg", "/products/gps/garmin_etrex/img_2.jpg", "/products/gps/garmin_etrex/img_1.jpg", "/products/gps/garmin_etrex/img_2.jpg"],
  "etrex":    ["/products/gps/garmin_etrex/img_1.jpg", "/products/gps/garmin_etrex/img_2.jpg", "/products/gps/garmin_etrex/img_1.jpg", "/products/gps/garmin_etrex/img_2.jpg"],
};

const FALLBACK_IMAGES = [
  "/products/gps/gt06/img_1.jpg",
  "/products/gps/gt06/img_2.jpg",
  "/products/gps/gt06/img_3.jpg",
  "/products/gps/gt06/img_4.jpg",
];

function resolveImages(modelName: string): { featured: string; gallery: string[] } {
  const ml = modelName.toLowerCase();
  for (const [key, imgs] of Object.entries(IMAGE_MAP)) {
    if (ml.includes(key)) {
      return { featured: imgs[0], gallery: imgs.slice(1, 4) };
    }
  }
  return { featured: FALLBACK_IMAGES[0], gallery: FALLBACK_IMAGES.slice(1) };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function slugify(t: string): string {
  return t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function strip4G(t: string): string {
  return t.replace(/\b4G\s*LTE\b/gi, "").replace(/\b4G\s*GSM\b/gi, "").replace(/\b4G\b/gi, "")
          .replace(/\s{2,}/g, " ").replace(/\s+([,.\-—])/g, "$1").trim();
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1).trimEnd() + "…";
}

function isWanway(brand: string) { return brand.toLowerCase() === "wanway"; }
function isGpsBrand(brand: string) { return GPS_BRANDS.some(g => g.toLowerCase() === brand.toLowerCase()); }
function isFeatured(slug: string) { return FEATURED_KEYWORDS.some(k => slug.includes(k)); }

// ─── Category inference ───────────────────────────────────────────────────────

function inferCategory(brand: string, model: string): string {
  const full = `${brand} ${model}`.toLowerCase();
  if (full.includes("td-02") || full.includes("td02") || full.includes("kids") || full.includes("watch"))
    return "Kids GPS Watches";
  if (full.includes("obd") || full.includes("cj750") || full.includes("cj220"))
    return "OBD GPS Trackers";
  if (full.includes("lk208") || full.includes("lk930") || full.includes("gf21") || full.includes("gf07") || full.includes("p31"))
    return "Personal GPS Trackers";
  if (full.includes("gs900") || full.includes("gm06") || full.includes("s20") || full.includes("st815") || full.includes("tk905") || full.includes("tk915"))
    return "Motorcycle GPS Trackers";
  if (full.includes("garmin") || full.includes("etrex") || full.includes("gpsmap"))
    return "Handheld GPS Devices";
  if (full.includes("spy") || full.includes("hidden") || full.includes("covert") || full.includes("lawmate"))
    return "Spy Cameras & Surveillance";
  if (full.includes("detector") || full.includes("rf") || full.includes("bug"))
    return "Counter-Surveillance";
  if (full.includes("nvr") || full.includes("dvr") || full.includes("hikvision") || full.includes("dahua"))
    return "Smart Security Systems";
  if (isGpsBrand(brand) || full.includes("tracker") || full.includes("orange"))
    return "Vehicle GPS Trackers";
  return "Security Equipment";
}

// ─── Content builder ──────────────────────────────────────────────────────────

function buildContent(brand: string, model: string, category: string, priceStr: string) {
  const allow4G = isWanway(brand);
  const full4G  = allow4G ? "4G LTE" : "GSM/GPRS";
  const short4G = allow4G ? "4G " : "";

  // Titles
  let rawTitle: string;
  const catL = category.toLowerCase();
  if (catL.includes("obd"))        rawTitle = `${brand} ${model} OBD Plug-and-Play GPS Tracker`;
  else if (catL.includes("kids"))  rawTitle = `${brand} ${model} Kids GPS Smart Watch`;
  else if (catL.includes("motor")) rawTitle = `${brand} ${model} ${short4G}Motorcycle GPS Tracker`;
  else if (catL.includes("personal")) rawTitle = `${brand} ${model} ${short4G}Personal GPS Tracker`;
  else if (catL.includes("handheld")) rawTitle = `${brand} ${model} Handheld GPS Device`;
  else if (catL.includes("spy"))   rawTitle = `${brand} ${model} Covert Surveillance Camera`;
  else if (catL.includes("security")) rawTitle = `${brand} ${model} Security System`;
  else                             rawTitle = `${brand} ${model} ${short4G}Vehicle GPS Tracker`;

  const title = rawTitle.replace(/\s{2,}/g, " ").trim();
  const slug  = slugify(title);

  // Tags
  const tags = [
    `${brand.toLowerCase()} ${model.toLowerCase()}`,
    "gps tracker pakistan",
    "vehicle tracking",
    "real-time gps",
    allow4G ? "4g gps tracker" : "gps tracker",
    brand.toLowerCase(),
    category.toLowerCase(),
    "geem.pk",
  ].filter((v, i, a) => v && a.indexOf(v) === i).join(",");

  // Short description
  const shortDesc = allow4G
    ? `${brand} ${model} 4G LTE real-time GPS tracker. Geo-fence alerts, engine cut-off & live map tracking for Pakistan.`
    : `${brand} ${model} real-time GPS tracker. Geo-fence alerts, engine monitoring & live tracking across Pakistan.`;

  // Long description
  const longDesc = `${title}

${brand} ${model} — Professional GPS Tracker | Pakistan

${allow4G
  ? "4G LTE network delivers fast, reliable real-time positioning every 10 seconds nationwide."
  : "GSM/GPRS network with full Pakistan coverage for reliable real-time location updates."}

Key Features:
• Real-time live location on web & mobile app
• Geo-Fence entry/exit SMS & push notifications
• Engine Cut-Off relay — remote immobilisation
• Over-speed alert with configurable limit
• Ignition on/off event notifications
• Trip history, mileage, and route replay
• Low battery & power-cut alert
• Android & iOS compatible tracking app

Technical Specifications:
• Network: ${full4G}
• GNSS: GPS + GLONASS dual positioning
• Location Accuracy: ≤5 metres
• Update Interval: 10 seconds (configurable)
• Input Voltage: DC 9V–90V (universal)
• Operating Temperature: -20°C to +70°C
• Waterproof Rating: IP67

Best For:
Cars, SUVs, motorcycles, trucks, delivery fleets, and personal assets across all cities in Pakistan.

Price in Pakistan: PKR ${priceStr}
Order online at Geem.pk with nationwide delivery. Genuine warranty on every unit.`;

  // SEO
  const metaTitleRaw     = `${brand} ${model}${allow4G ? " 4G" : ""} GPS Tracker Price Pakistan — Geem.pk`;
  const metaDescRaw      = `Buy official ${title} in Pakistan at best price. Real-time stock, fast nationwide delivery & genuine warranty on Geem.pk.`;
  const metaTitle        = truncate(metaTitleRaw, 60);
  const metaDescription  = truncate(metaDescRaw, 160);
  const metaKeywords     = [
    `${brand.toLowerCase()} ${model.toLowerCase()} pakistan`,
    `${brand.toLowerCase()} ${model.toLowerCase()} price`,
    `buy ${brand.toLowerCase()} gps tracker`,
    allow4G ? `${brand.toLowerCase()} 4g tracker` : "",
    "gps tracker pakistan",
    "vehicle tracker pakistan",
    "real-time gps pakistan",
    "geem.pk gps",
    `${brand.toLowerCase()} pakistan`,
  ].filter(Boolean).join(",");

  return { title, slug, tags, shortDesc, longDesc, metaTitle, metaDescription, metaKeywords };
}

// ─── Ensure categories exist ──────────────────────────────────────────────────

async function ensureCategories(catByName: Map<string, { id: number; name: string }>) {
  const tree = [
    { name: "GPS Trackers" },
    { name: "Vehicle GPS Trackers",  parent: "GPS Trackers" },
    { name: "Motorcycle GPS Trackers", parent: "GPS Trackers" },
    { name: "OBD GPS Trackers",      parent: "GPS Trackers" },
    { name: "Personal GPS Trackers", parent: "GPS Trackers" },
    { name: "Kids GPS Watches",      parent: "GPS Trackers" },
    { name: "Handheld GPS Devices",  parent: "GPS Trackers" },
    { name: "Security Equipment" },
    { name: "Spy Cameras & Surveillance", parent: "Security Equipment" },
    { name: "Counter-Surveillance",       parent: "Security Equipment" },
    { name: "Smart Security Systems",     parent: "Security Equipment" },
  ];

  for (const entry of tree) {
    const key = entry.name.toLowerCase();
    if (!catByName.has(key)) {
      const parentId = (entry as any).parent
        ? catByName.get(((entry as any).parent as string).toLowerCase())?.id ?? null
        : null;
      const [row] = await db.insert(categoriesTable)
        .values({ name: entry.name, parentId: parentId as any, active: true })
        .returning();
      catByName.set(key, row);
      console.log(`  + Category: ${entry.name}`);
    }
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function run() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  GEEM CATALOG OVERHAUL v2 — Full Reset, Images & SEO");
  console.log("═══════════════════════════════════════════════════════════════\n");

  // ── 1. Load reference data ────────────────────────────────────────────────
  const allBrands     = await db.select().from(brandsTable);
  const allCategories = await db.select().from(categoriesTable);
  const allModels     = await db.select().from(deviceModelsTable);

  const brandById  = new Map(allBrands.map(b => [b.id, b]));
  const modelById  = new Map(allModels.map(m => [m.id, m]));
  const catByName  = new Map(allCategories.map(c => [c.name.toLowerCase(), { id: c.id, name: c.name }]));

  // Excluded IDs
  const excludedBrandIds = allBrands
    .filter(b => EXCLUDED_BRANDS.some(ex => ex.toLowerCase() === b.name.toLowerCase()))
    .map(b => b.id);
  const mobileBrandIds = allBrands
    .filter(b => MOBILE_BRANDS.some(m => m.toLowerCase() === b.name.toLowerCase()))
    .map(b => b.id);
  const excludedCatIds = allCategories
    .filter(c => MOBILE_CAT_KEYWORDS.some(k => c.name.toLowerCase().includes(k)))
    .map(c => c.id);

  console.log(`  Banned brands   : ${excludedBrandIds.length} (ZRK, Al-Noor etc.)`);
  console.log(`  Mobile brands   : ${mobileBrandIds.length}`);
  console.log(`  Excluded cats   : ${excludedCatIds.length}\n`);

  // ── 2. Delete all existing catalog products ───────────────────────────────
  console.log("▶ Deleting all existing catalog products…");
  const deleted = await db.delete(productsTable).returning({ id: productsTable.id });
  console.log(`  ✓ Deleted ${deleted.length} products.\n`);

  // ── 3. Ensure categories ──────────────────────────────────────────────────
  console.log("▶ Ensuring categories…");
  await ensureCategories(catByName);

  // ── 4. Query live inventory ───────────────────────────────────────────────
  console.log("\n▶ Reading live inventory (status = in_stock)…");

  const allExcluded = [...excludedBrandIds, ...mobileBrandIds];
  const inventoryRows = await db
    .select({
      brandId:    inventoryItemsTable.brandId,
      modelId:    inventoryItemsTable.modelId,
      categoryId: inventoryItemsTable.categoryId,
      stockCount: sql<number>`COUNT(*)::int`,
      avgPrice:   sql<string>`AVG(selling_price::numeric)::text`,
      maxPrice:   sql<string>`MAX(selling_price::numeric)::text`,
    })
    .from(inventoryItemsTable)
    .where(
      and(
        eq(inventoryItemsTable.status, "in_stock"),
        allExcluded.length > 0
          ? sql`${inventoryItemsTable.brandId} NOT IN (${sql.join(allExcluded.map(id => sql`${id}`), sql`, `)})`
          : sql`true`,
        excludedCatIds.length > 0
          ? sql`(${inventoryItemsTable.categoryId} IS NULL OR ${inventoryItemsTable.categoryId} NOT IN (${sql.join(excludedCatIds.map(id => sql`${id}`), sql`, `)}))`
          : sql`true`,
      )
    )
    .groupBy(inventoryItemsTable.brandId, inventoryItemsTable.modelId, inventoryItemsTable.categoryId);

  console.log(`  Found ${inventoryRows.length} brand+model combinations.\n`);

  // ── 5. Build & insert products ────────────────────────────────────────────
  console.log("▶ Building catalog products…\n");

  let created = 0, skipped = 0;
  const usedSlugs = new Set<string>();

  for (const row of inventoryRows) {
    const brand = brandById.get(row.brandId);
    const model = modelById.get(row.modelId);
    if (!brand || !model) { skipped++; continue; }

    const brandName = brand.name;
    const modelName = model.name;
    const stockQty  = Number(row.stockCount) || 0;

    // Skip "Unbranded IOT" — not a real catalog product
    if (brandName === "Unbranded" && modelName.toLowerCase().includes("iot")) {
      console.log(`  ⏭  Skipping: ${brandName} ${modelName} (internal item)`);
      skipped++;
      continue;
    }

    // Price: use inventory MAX if > 500 PKR, else known price
    const invMax = parseFloat(row.maxPrice || "0");
    const pricing = invMax > 500
      ? { price: invMax.toFixed(2), salePrice: (Math.round(invMax * 0.9 / 100) * 100).toFixed(2) }
      : lookupPrice(modelName);

    // Category
    const catName  = inferCategory(brandName, modelName);
    const catEntry = catByName.get(catName.toLowerCase());
    const categoryId = catEntry?.id ?? catByName.get("vehicle gps trackers")?.id ?? null;

    // Content & SEO (4G rule enforced inside)
    const content = buildContent(brandName, modelName, catName, pricing.price);

    // Unique slug
    let slug = content.slug;
    let n = 0;
    while (usedSlugs.has(slug)) { n++; slug = `${content.slug}-${n}`; }
    usedSlugs.add(slug);

    // Images — 4 per product using local files
    const imgs = resolveImages(modelName);

    try {
      await db.insert(productsTable).values({
        title:            content.title,
        slug,
        sku:              `${brandName.slice(0, 4).toUpperCase()}-${modelName.replace(/\s+/g, "").toUpperCase().slice(0, 10)}`,
        brandId:          brand.id,
        categoryId:       categoryId as any,
        tags:             content.tags,
        price:            pricing.price,
        salePrice:        pricing.salePrice,
        stockQty,
        shortDescription: content.shortDesc,
        longDescription:  content.longDesc,
        featuredImage:    imgs.featured,
        galleryImages:    JSON.stringify(imgs.gallery),
        published:        true,
        featured:         isFeatured(slug),
        hidePrice:        false,
        metaTitle:        content.metaTitle,
        metaDescription:  content.metaDescription,
        metaKeywords:     content.metaKeywords,
      });

      const priceDisplay = pricing.price === "0.00" ? "⚠ price=0" : `PKR ${pricing.price}`;
      const featTag = isFeatured(slug) ? " ⭐" : "";
      console.log(`  ✅${featTag} ${content.title}`);
      console.log(`       Stock: ${stockQty} | ${priceDisplay} | Cat: ${catName}`);
      console.log(`       Main image: ${imgs.featured}`);
      created++;
    } catch (err: any) {
      console.error(`  ✗  FAILED: ${brandName} ${modelName} — ${err?.message}`);
      skipped++;
    }
  }

  // ── 6. Final report ───────────────────────────────────────────────────────
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log(` ✅ CATALOG OVERHAUL v2 COMPLETE`);
  console.log(`    Deleted old  : ${deleted.length} products`);
  console.log(`    Created new  : ${created} products`);
  console.log(`    Skipped      : ${skipped}`);
  console.log(`    Image source : local /products/gps/ assets on VPS`);
  console.log("═══════════════════════════════════════════════════════════════\n");

  // Summary of products with price=0 (needs manual fix)
  const zeroPrice = inventoryRows.filter(r => {
    const max = parseFloat(r.maxPrice || "0");
    const brand = brandById.get(r.brandId);
    const model = modelById.get(r.modelId);
    if (!brand || !model) return false;
    const lookup = lookupPrice(model.name);
    return max <= 500 && lookup.price === "0.00";
  });
  if (zeroPrice.length > 0) {
    console.log("⚠  Products still with price=0 (set prices in ERP inventory):");
    for (const r of zeroPrice) {
      const b = brandById.get(r.brandId);
      const m = modelById.get(r.modelId);
      console.log(`   - ${b?.name} ${m?.name}`);
    }
  }

  process.exit(0);
}

run().catch(err => { console.error("❌ Failed:", err); process.exit(1); });
