/**
 * catalog-overhaul.ts
 *
 * Executes a complete fresh reset and re-population of the public catalog.
 *
 * Rules applied:
 *  1. DELETE all existing catalog products (clean slate).
 *  2. Exclude Mobile Phones / Mobile Accessories categories.
 *  3. Exclude brands: ZRK, Al-Noor.
 *  4. 4G rule: Only Wanway GPS trackers may use "4G" branding anywhere.
 *     All other GPS devices have "4G" stripped from title, slug, tags, descriptions.
 *  5. Populate from live inventory — brand + model combos with available stock.
 *  6. Full SEO fields: meta title (≤60 chars), meta description (≤160 chars),
 *     meta keywords, slug, tags, short + long description.
 *  7. published = true, hide_price = false.
 *     featured = true for flagship/key models.
 *
 * Run ON the VPS:
 *   pnpm --filter @workspace/scripts run catalog-overhaul
 */

import {
  db,
  brandsTable,
  categoriesTable,
  deviceModelsTable,
  inventoryItemsTable,
  productsTable,
} from "@workspace/db";
import { eq, inArray, sql, and, ne } from "drizzle-orm";

// ─── Constants ───────────────────────────────────────────────────────────────

/** Brands explicitly banned from the catalog */
const EXCLUDED_BRAND_NAMES = ["ZRK", "Al-Noor", "Al Noor", "Alnoor"];

/** Category names that are mobile-phone or mobile-accessory related */
const EXCLUDED_CATEGORY_KEYWORDS = [
  "smartphone",
  "mobile phone",
  "mobile accessory",
  "mobile accessories",
  "phone accessories",
  "tablets",
  "tablet",
];

/** Only Wanway may use "4G" in GPS tracker context */
const WANWAY_BRAND_NAME = "Wanway";

/** Brands considered GPS/security — used for 4G enforcement */
const GPS_BRAND_NAMES = [
  "Wanway", "Yuntrack", "Micodus", "SinoTrack", "Geem",
  "Huntsman", "Toray", "365GPS", "360GPS", "CarePro", "CareTrack", "Goome",
];

/** Flagship model slugs that get featured=true */
const FEATURED_MODEL_KEYWORDS = [
  "wanway", "orange-2", "orange2", "cj780", "cj790", "gt06", "g20",
  "gf21", "st915", "lk208", "ajax", "hikvision", "garmin",
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Remove "4G" / "4G LTE" / "4G GSM" tokens from a string */
function strip4G(text: string): string {
  return text
    .replace(/\b4G\s*LTE\b/gi, "")
    .replace(/\b4G\s*GSM\b/gi, "")
    .replace(/\b4G\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.\-—])/g, "$1")
    .trim();
}

function isFeatured(slug: string): boolean {
  return FEATURED_MODEL_KEYWORDS.some(k => slug.includes(k));
}

function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max - 1).trimEnd() + "…";
}

// ─── Content builders ─────────────────────────────────────────────────────────

interface ProductContent {
  title: string;
  slug: string;
  tags: string;
  shortDescription: string;
  longDescription: string;
  metaTitle: string;
  metaDescription: string;
  metaKeywords: string;
  featured: boolean;
}

function isGpsBrand(brandName: string): boolean {
  return GPS_BRAND_NAMES.some(g => g.toLowerCase() === brandName.toLowerCase());
}

function isWanway(brandName: string): boolean {
  return brandName.toLowerCase() === WANWAY_BRAND_NAME.toLowerCase();
}

function buildGpsContent(
  brandName: string,
  modelName: string,
  categoryName: string,
  priceStr: string,
): ProductContent {
  const allow4G = isWanway(brandName);
  const network4G = allow4G ? "4G LTE" : "GSM/GPRS";
  const networkShort = allow4G ? "4G" : "";

  // Build title — only Wanway includes "4G" token
  const rawTitle = allow4G
    ? `${brandName} ${modelName} 4G Vehicle GPS Tracker`
    : `${brandName} ${modelName} Vehicle GPS Tracker`;
  const title = rawTitle;

  // Slug — clean, no false 4G
  const slug = slugify(`${brandName}-${modelName}-${allow4G ? "4g-" : ""}gps-tracker`);

  const tags = [
    `${brandName.toLowerCase()} ${modelName.toLowerCase()}`,
    "gps tracker",
    "vehicle tracking pakistan",
    "real-time gps",
    allow4G ? "4g tracker" : "",
    brandName.toLowerCase(),
    categoryName.toLowerCase(),
  ].filter(Boolean).join(",");

  const shortDescription = allow4G
    ? `${brandName} ${modelName} 4G LTE real-time vehicle GPS tracker. Engine cut-off, geo-fence alerts, live map tracking across Pakistan.`
    : `${brandName} ${modelName} real-time vehicle GPS tracker. Geo-fence alerts, engine monitoring, and live tracking across Pakistan.`;

  const longDescription = `${title}

${brandName} ${modelName} — Professional Vehicle GPS Tracker for Pakistan

${allow4G ? "4G LTE network ensures fast, reliable positioning updates every 10 seconds." : "GSM/GPRS network with nationwide Pakistan coverage for reliable real-time positioning."}

Core Features:
• Real-time live location tracking
• Geo-Fence entry/exit alerts via app & SMS
• Engine Cut-Off relay (remote immobilisation)
• Over-speed alert with configurable threshold
• Ignition on/off notifications
• Low battery and power-disconnect alerts
• Trip history & mileage reporting
• Compatible with Android & iOS tracking app

Technical Specifications:
• Network: ${network4G}
• GNSS: GPS + GLONASS dual positioning
• Positioning Accuracy: ≤5 metres
• Update Interval: 10 seconds (configurable)
• Input Voltage: DC 9–90V
• Operating Temperature: -20°C to +70°C
• Waterproof: IP67

Best For:
Cars, SUVs, motorcycles, delivery fleets, heavy vehicles, and personal asset tracking across Pakistan.

Price in Pakistan: PKR ${priceStr}
Available at Geem.pk with nationwide delivery.`;

  const metaTitleRaw = `${brandName} ${modelName}${allow4G ? " 4G" : ""} GPS Tracker Pakistan — Geem.pk`;
  const metaTitle = truncate(metaTitleRaw, 60);

  const metaDescRaw = `Buy ${title} in Pakistan at best price. Real-time stock, fast nationwide delivery & genuine warranty on Geem.pk.`;
  const metaDescription = truncate(metaDescRaw, 160);

  const metaKeywords = [
    `${brandName.toLowerCase()} ${modelName.toLowerCase()} pakistan`,
    `${brandName.toLowerCase()} gps tracker`,
    allow4G ? `${brandName.toLowerCase()} 4g tracker` : "",
    "gps tracker pakistan",
    "vehicle tracker pakistan",
    "buy gps tracker pakistan",
    "real-time gps pakistan",
    "geem.pk gps",
  ].filter(Boolean).join(",");

  return {
    title,
    slug,
    tags,
    shortDescription,
    longDescription,
    metaTitle,
    metaDescription,
    metaKeywords,
    featured: isFeatured(slug),
  };
}

function buildSecurityContent(
  brandName: string,
  modelName: string,
  categoryName: string,
  priceStr: string,
): ProductContent {
  const title = `${brandName} ${modelName} — ${categoryName}`;
  const slug = slugify(`${brandName}-${modelName}-${categoryName}`);

  const tags = [
    brandName.toLowerCase(),
    modelName.toLowerCase(),
    categoryName.toLowerCase(),
    "security equipment",
    "pakistan",
    "geem.pk",
  ].join(",");

  const shortDescription = `${brandName} ${modelName} ${categoryName}. Genuine product with full warranty. Available in Pakistan at Geem.pk.`;

  const longDescription = `${title}

${brandName} ${modelName} — Official ${categoryName}

Genuine ${brandName} ${modelName} available in Pakistan through Geem.pk. Full manufacturer warranty included with every unit.

Key Highlights:
• Genuine ${brandName} product — no grey-market imports
• Full manufacturer warranty
• Technical support available
• Fast nationwide delivery across Pakistan

Price: PKR ${priceStr}
Buy online at Geem.pk or visit our Karachi store.`;

  const metaTitleRaw = `${brandName} ${modelName} Price Pakistan — Geem.pk`;
  const metaTitle = truncate(metaTitleRaw, 60);

  const metaDescRaw = `Buy official ${brandName} ${modelName} in Pakistan at best price. Real-time stock, fast nationwide delivery & genuine warranty on Geem.pk.`;
  const metaDescription = truncate(metaDescRaw, 160);

  const metaKeywords = [
    `${brandName.toLowerCase()} ${modelName.toLowerCase()} pakistan`,
    `${brandName.toLowerCase()} ${modelName.toLowerCase()} price`,
    `buy ${brandName.toLowerCase()} pakistan`,
    "geem.pk",
    categoryName.toLowerCase(),
  ].join(",");

  return {
    title,
    slug,
    tags,
    shortDescription,
    longDescription,
    metaTitle,
    metaDescription,
    metaKeywords,
    featured: isFeatured(slug),
  };
}

function buildContent(
  brandName: string,
  modelName: string,
  categoryName: string,
  priceStr: string,
): ProductContent {
  const catLower = categoryName.toLowerCase();
  const isGps =
    catLower.includes("gps") ||
    catLower.includes("tracker") ||
    isGpsBrand(brandName);

  if (isGps) {
    return buildGpsContent(brandName, modelName, categoryName, priceStr);
  }
  return buildSecurityContent(brandName, modelName, categoryName, priceStr);
}

// ─── Category inference ───────────────────────────────────────────────────────

function inferCategoryName(brandName: string, modelName: string): string {
  const full = `${brandName} ${modelName}`.toLowerCase();

  if (full.includes("td-02") || full.includes("td02") || full.includes("watch"))
    return "Kids GPS Watches";
  if (full.includes("obd") || full.includes("cj750") || full.includes("cj220"))
    return "OBD GPS Trackers";
  if (full.includes("lk208") || full.includes("gf21") || full.includes("p31") || full.includes("personal"))
    return "Personal GPS Trackers";
  if (full.includes("gs900") || full.includes("gm06") || full.includes("s20") || full.includes("motorcycle") || full.includes("bike"))
    return "Motorcycle GPS Trackers";
  if (full.includes("spy") || full.includes("hidden") || full.includes("covert") || full.includes("lawmate") || full.includes("pv-"))
    return "Spy Cameras & Surveillance";
  if (full.includes("detector") || full.includes("rf") || full.includes("bug") || full.includes("tscm"))
    return "Counter-Surveillance";
  if (full.includes("hikvision") || full.includes("dahua") || full.includes("cctv") || full.includes("nvr") || full.includes("dvr"))
    return "Smart Security Systems";
  if (full.includes("garmin") || full.includes("etrex") || full.includes("gpsmap"))
    return "Handheld GPS Devices";
  if (full.includes("esonic") || full.includes("esno"))
    return "Spy Cameras & Surveillance";
  if (full.includes("huntsman") || full.includes("toray"))
    return "Security Equipment";
  if (isGpsBrand(brandName))
    return "Vehicle GPS Trackers";
  return "Security Equipment";
}

// ─── Default images ───────────────────────────────────────────────────────────

function defaultImage(categoryName: string, modelName: string): string {
  const lc = `${categoryName} ${modelName}`.toLowerCase();
  if (lc.includes("cj780")) return "/products/gps/cj780/img_1.jpg";
  if (lc.includes("cj790")) return "/products/gps/cj790d/img_1.jpg";
  if (lc.includes("cj750")) return "/products/gps/cj750/img_1.jpg";
  if (lc.includes("cj220")) return "/products/gps/cj220/img_1.jpg";
  if (lc.includes("lk208")) return "/products/gps/lk208/img_1.jpg";
  if (lc.includes("gf21")) return "/products/gps/gf21/img_1.jpg";
  if (lc.includes("gt06") || lc.includes("gt-06")) return "/products/gps/gt06/img_1.jpg";
  if (lc.includes("g20m")) return "/products/gps/g20m/img_1.jpg";
  if (lc.includes("g20")) return "/products/gps/g20/img_1.jpg";
  if (lc.includes("s20") || lc.includes("motorcycle")) return "/products/gps/s20.jpg";
  if (lc.includes("gm06")) return "/products/gps/gm06nw.jpg";
  if (lc.includes("gs900")) return "/products/gps/gs900.png";
  if (lc.includes("st915")) return "/products/gps/st915/img_1.jpg";
  if (lc.includes("st900") || lc.includes("sinotrack")) return "/products/gps/st900.jpg";
  if (lc.includes("orange")) return "/products/gps/orange_sim.jpg";
  if (lc.includes("obd")) return "/products/gps/cj750/img_1.jpg";
  if (lc.includes("spy") || lc.includes("surveillance") || lc.includes("esonic")) return "/products/security/spy.jpg";
  if (lc.includes("garmin")) return "/products/gps/garmin.jpg";
  if (lc.includes("nvr") || lc.includes("hikvision")) return "/products/security/nvr.jpg";
  return "/products/gps/orange_sim.jpg";
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function run() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  GEEM CATALOG OVERHAUL — Full Reset & Repopulate");
  console.log("═══════════════════════════════════════════════════════════════\n");

  // ── 1. Load lookup tables ──────────────────────────────────────────────────
  console.log("▶ Loading brands and categories from database…");

  const allBrands = await db.select().from(brandsTable);
  const allCategories = await db.select().from(categoriesTable);

  const brandByName = new Map(allBrands.map(b => [b.name.toLowerCase(), b]));
  const catByName   = new Map(allCategories.map(c => [c.name.toLowerCase(), c]));

  // ── 2. Determine excluded brand & category IDs ────────────────────────────
  const excludedBrandIds = allBrands
    .filter(b => EXCLUDED_BRAND_NAMES.some(ex => ex.toLowerCase() === b.name.toLowerCase()))
    .map(b => b.id);

  const excludedCatIds = allCategories
    .filter(c => EXCLUDED_CATEGORY_KEYWORDS.some(k => c.name.toLowerCase().includes(k)))
    .map(c => c.id);

  console.log(`  Excluded brands (${excludedBrandIds.length}): ${
    allBrands.filter(b => excludedBrandIds.includes(b.id)).map(b => b.name).join(", ") || "none"
  }`);
  console.log(`  Excluded categories (${excludedCatIds.length}): ${
    allCategories.filter(c => excludedCatIds.includes(c.id)).map(c => c.name).join(", ") || "none"
  }`);

  // ── 3. DELETE all existing catalog products ────────────────────────────────
  console.log("\n▶ Deleting all existing catalog products (fresh reset)…");
  const deleted = await db.delete(productsTable).returning({ id: productsTable.id });
  console.log(`  ✓ Deleted ${deleted.length} products.`);

  // ── 4. Query live inventory for brand+model combos ────────────────────────
  console.log("\n▶ Reading live inventory…");

  // Get inventory counts and price by brand+model, excluding banned brands & categories
  const inventoryQuery = await db
    .select({
      brandId:    inventoryItemsTable.brandId,
      modelId:    inventoryItemsTable.modelId,
      categoryId: inventoryItemsTable.categoryId,
      stockCount: sql<number>`COUNT(*)::int`,
      avgPrice:   sql<string>`AVG(selling_price::numeric)::text`,
      minPrice:   sql<string>`MIN(selling_price::numeric)::text`,
    })
    .from(inventoryItemsTable)
    .where(
      and(
        // Only in_stock items count as available
        eq(inventoryItemsTable.status, "in_stock"),
        // Exclude banned brands
        excludedBrandIds.length > 0
          ? sql`${inventoryItemsTable.brandId} NOT IN (${sql.join(excludedBrandIds.map(id => sql`${id}`), sql`, `)})`
          : sql`true`,
        // Exclude mobile phone categories (if category is set)
        excludedCatIds.length > 0
          ? sql`(${inventoryItemsTable.categoryId} IS NULL OR ${inventoryItemsTable.categoryId} NOT IN (${sql.join(excludedCatIds.map(id => sql`${id}`), sql`, `)}))`
          : sql`true`,
      )
    )
    .groupBy(
      inventoryItemsTable.brandId,
      inventoryItemsTable.modelId,
      inventoryItemsTable.categoryId,
    );

  console.log(`  Found ${inventoryQuery.length} brand+model combinations in inventory.`);

  // Also filter out mobile-phone brands by name (in case they don't have a category set)
  const mobileBrandNames = ["Apple", "Samsung", "Xiaomi", "Huawei", "Oppo", "Vivo", "Realme", "Tecno", "Infinix", "Nokia", "OnePlus", "Google"];
  const mobileBrandIds = allBrands
    .filter(b => mobileBrandNames.some(m => m.toLowerCase() === b.name.toLowerCase()))
    .map(b => b.id);

  // Load all models at once
  const allModels = await db.select().from(deviceModelsTable);
  const modelById = new Map(allModels.map(m => [m.id, m]));

  // ── 5. Upsert required categories ─────────────────────────────────────────
  console.log("\n▶ Ensuring catalog categories exist…");

  const requiredCategories = [
    { name: "GPS Trackers", parentId: undefined },
    { name: "Vehicle GPS Trackers", parent: "GPS Trackers" },
    { name: "Motorcycle GPS Trackers", parent: "GPS Trackers" },
    { name: "OBD GPS Trackers", parent: "GPS Trackers" },
    { name: "Personal GPS Trackers", parent: "GPS Trackers" },
    { name: "Kids GPS Watches", parent: "GPS Trackers" },
    { name: "Handheld GPS Devices", parent: "GPS Trackers" },
    { name: "Security Equipment", parentId: undefined },
    { name: "Spy Cameras & Surveillance", parent: "Security Equipment" },
    { name: "Counter-Surveillance", parent: "Security Equipment" },
    { name: "Smart Security Systems", parent: "Security Equipment" },
    { name: "Covert Communications", parent: "Security Equipment" },
  ];

  // Refresh cat map to include any missing ones
  for (const rc of requiredCategories) {
    const key = rc.name.toLowerCase();
    if (!catByName.has(key)) {
      let parentId: number | undefined;
      if ((rc as any).parent) {
        const parentKey = ((rc as any).parent as string).toLowerCase();
        parentId = catByName.get(parentKey)?.id;
      }
      const [inserted] = await db.insert(categoriesTable)
        .values({ name: rc.name, parentId: parentId ?? null as any, active: true })
        .returning();
      catByName.set(key, inserted);
      console.log(`  + Category: ${rc.name}`);
    }
  }

  // ── 6. Build and insert catalog products ──────────────────────────────────
  console.log("\n▶ Building catalog products from inventory…\n");

  let created = 0;
  let skipped = 0;
  const usedSlugs = new Set<string>();

  for (const row of inventoryQuery) {
    const brand = allBrands.find(b => b.id === row.brandId);
    const model = modelById.get(row.modelId);

    if (!brand || !model) { skipped++; continue; }

    // Skip mobile brands by name
    if (mobileBrandIds.includes(brand.id)) { skipped++; continue; }

    const brandName = brand.name;
    const modelName = model.name;
    const stockCount = Number(row.stockCount) || 0;

    // Price: use average, round to nearest 100
    const avgPriceNum = parseFloat(row.avgPrice || "0");
    const roundedPrice = Math.round(avgPriceNum / 100) * 100;
    const priceStr = roundedPrice > 0 ? roundedPrice.toFixed(2) : "0.00";
    const salePriceNum = roundedPrice > 0 ? Math.round(roundedPrice * 0.9 / 100) * 100 : 0;
    const salePriceStr = salePriceNum > 0 ? salePriceNum.toFixed(2) : null;

    // Infer category
    const inferredCatName = inferCategoryName(brandName, modelName);
    const cat = catByName.get(inferredCatName.toLowerCase());
    const categoryId = cat?.id ?? catByName.get("gps trackers")?.id ?? null;

    // Build content (enforces 4G rules)
    const content = buildContent(brandName, modelName, inferredCatName, priceStr);

    // Ensure unique slug
    let slug = content.slug;
    let counter = 0;
    while (usedSlugs.has(slug)) {
      counter++;
      slug = `${content.slug}-${counter}`;
    }
    usedSlugs.add(slug);

    const featuredImage = defaultImage(inferredCatName, modelName);

    try {
      await db.insert(productsTable).values({
        title:            content.title,
        slug,
        sku:              `${brandName.slice(0, 4).toUpperCase()}-${modelName.replace(/\s+/g, "").toUpperCase().slice(0, 8)}`,
        brandId:          brand.id,
        categoryId:       categoryId as any,
        tags:             content.tags,
        price:            priceStr,
        salePrice:        salePriceStr,
        stockQty:         stockCount,
        shortDescription: content.shortDescription,
        longDescription:  content.longDescription,
        featuredImage,
        published:        true,
        featured:         content.featured,
        hidePrice:        false,
        metaTitle:        content.metaTitle,
        metaDescription:  content.metaDescription,
        metaKeywords:     content.metaKeywords,
      });
      console.log(`  ✅ ${content.title} (stock: ${stockCount}, price: ${priceStr})`);
      created++;
    } catch (err: any) {
      console.error(`  ✗ Failed: ${brandName} ${modelName} — ${err?.message}`);
      skipped++;
    }
  }

  // ── 7. Summary ────────────────────────────────────────────────────────────
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log(` ✅ CATALOG OVERHAUL COMPLETE`);
  console.log(`    Created : ${created} products`);
  console.log(`    Skipped : ${skipped} (no brand/model data, mobile, or error)`);
  console.log(`    Deleted : ${deleted.length} old products`);
  console.log("═══════════════════════════════════════════════════════════════");
  process.exit(0);
}

run().catch(err => {
  console.error("\n❌ Catalog overhaul failed:", err);
  process.exit(1);
});
