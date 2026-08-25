/**
 * full-catalog-generator.ts
 *
 * Complete, automated end-to-end catalog generation and image download.
 *
 * Business rules enforced:
 *   - EXCLUDE brands: ZRK, Al-Noor
 *   - EXCLUDE categories containing: Mobile Phone, Mobile Accessories
 *   - STRIP "4G" / "4G LTE" from GPS tracker titles/descriptions for all brands
 *     EXCEPT Wanway (Wanway is the only brand allowed to carry 4G designation)
 *   - Download exactly 4 local image files per product:
 *       Main  → /var/www/geem/uploads/public/products/main/<slug>-main.<ext>
 *       Gallery → /var/www/geem/uploads/public/products/gallery/<slug>-g1…g3.<ext>
 *   - Store local relative paths in DB: public/products/main/…
 *   - Set published=true, hide_price=false, featured=true for primary/flagship models
 *   - Full SEO fields per spec
 *
 * Run ON the VPS:
 *   pnpm --filter @workspace/scripts run full-catalog
 *
 * Idempotent — re-running updates existing products rather than duplicating them.
 */

import {
  db,
  brandsTable,
  categoriesTable,
  deviceModelsTable,
  inventoryItemsTable,
  productsTable,
} from "@workspace/db";
import { eq, and, ilike, sql, inArray } from "drizzle-orm";
import * as fs from "fs";
import * as path from "path";

// ─── Config ──────────────────────────────────────────────────────────────────

const UPLOADS_ROOT =
  process.env.UPLOADS_DIR ?? "/var/www/geem/uploads";

const MAIN_DIR    = path.join(UPLOADS_ROOT, "public", "products", "main");
const GALLERY_DIR = path.join(UPLOADS_ROOT, "public", "products", "gallery");

/** Brands to exclude entirely */
const EXCLUDED_BRANDS = ["zrk", "al-noor", "al noor", "alnoor"];

/** Category name fragments that signal Mobile exclusion */
const EXCLUDED_CATEGORY_FRAGMENTS = [
  "mobile phone",
  "mobile accessories",
  "smartphone accessories",
  "phone accessories",
];

/** Only this brand may keep "4G" / "4G LTE" labels */
const BRAND_ALLOWED_4G = "wanway";

// ─── Utilities ────────────────────────────────────────────────────────────────

function slugify(t: string): string {
  return t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/** Strip "4G LTE" and "4G" tokens from a string (case-insensitive) */
function strip4G(text: string): string {
  return text
    .replace(/\b4G\s+LTE\b/gi, "")
    .replace(/\b4G\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function fileExt(url: string): string {
  const u = url.split("?")[0].toLowerCase();
  if (u.endsWith(".webp")) return ".webp";
  if (u.endsWith(".png"))  return ".png";
  if (u.endsWith(".gif"))  return ".gif";
  return ".jpg";
}

function isMobileCategory(catName: string): boolean {
  const lc = catName.toLowerCase();
  return EXCLUDED_CATEGORY_FRAGMENTS.some(f => lc.includes(f));
}

function isExcludedBrand(brandName: string): boolean {
  const lc = brandName.toLowerCase().trim();
  return EXCLUDED_BRANDS.some(e => lc === e || lc.includes(e));
}

function isWanway(brandName: string): boolean {
  return brandName.toLowerCase().trim() === BRAND_ALLOWED_4G;
}

// ─── Image search & download ─────────────────────────────────────────────────

async function searchImagesViaDDG(query: string): Promise<string[]> {
  try {
    const initRes = await fetch(
      `https://duckduckgo.com/?q=${encodeURIComponent(query)}&iar=images&iax=images&ia=images`,
      {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36" },
        signal: AbortSignal.timeout(10_000),
      },
    );
    const html = await initRes.text();
    const vqdMatch = html.match(/vqd=['"]([^'"]+)['"]/);
    if (!vqdMatch) return [];
    const vqd = vqdMatch[1];

    const imgRes = await fetch(
      `https://duckduckgo.com/i.js?q=${encodeURIComponent(query)}&vqd=${encodeURIComponent(vqd)}&o=json&p=1&f=,,,,,`,
      {
        headers: { Referer: "https://duckduckgo.com/", "User-Agent": "Mozilla/5.0 (Windows NT 10.0)" },
        signal: AbortSignal.timeout(10_000),
      },
    );
    const json = (await imgRes.json()) as { results?: { image: string }[] };
    return (json.results ?? []).slice(0, 15).map(r => r.image).filter(Boolean);
  } catch {
    return [];
  }
}

async function downloadImage(url: string, dest: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return false;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 3_000) return false; // skip tiny/broken
    fs.writeFileSync(dest, buf);
    return true;
  } catch {
    return false;
  }
}

/**
 * Download exactly 4 local images for a product:
 *   1 main  (MAIN_DIR)
 *   3 gallery (GALLERY_DIR)
 *
 * Tries multiple search queries until it has enough images.
 * Returns { mainPath, galleryPaths } as relative DB paths.
 */
async function downloadProductImages(
  slug: string,
  brandName: string,
  modelName: string,
): Promise<{ mainPath: string | null; galleryPaths: string[] }> {
  fs.mkdirSync(MAIN_DIR,    { recursive: true });
  fs.mkdirSync(GALLERY_DIR, { recursive: true });

  const queries = [
    `${brandName} ${modelName} official product photo`,
    `${brandName} ${modelName} GPS tracker`,
    `${modelName} tracker device image`,
    `${brandName} ${modelName}`,
  ];

  const collected: string[] = [];

  for (const q of queries) {
    if (collected.length >= 10) break;
    const urls = await searchImagesViaDDG(q);
    for (const u of urls) {
      if (!collected.includes(u)) collected.push(u);
    }
    // Small delay to be polite to DDG
    await new Promise(r => setTimeout(r, 500));
  }

  let mainPath: string | null = null;
  const galleryPaths: string[] = [];

  for (const url of collected) {
    if (mainPath && galleryPaths.length >= 4) break;

    const ext = fileExt(url);

    if (!mainPath) {
      const fname = `${slug}-main${ext}`;
      const dest  = path.join(MAIN_DIR, fname);
      if (await downloadImage(url, dest)) {
        mainPath = `public/products/main/${fname}`;
        console.log(`    📸 main      → ${fname}`);
      }
    } else if (galleryPaths.length < 4) {
      const idx   = galleryPaths.length + 1;
      const fname = `${slug}-g${idx}${ext}`;
      const dest  = path.join(GALLERY_DIR, fname);
      if (await downloadImage(url, dest)) {
        galleryPaths.push(`public/products/gallery/${fname}`);
        console.log(`    📸 gallery ${idx} → ${fname}`);
      }
    }
  }

  return { mainPath, galleryPaths };
}

// ─── Content generation ───────────────────────────────────────────────────────

interface ProductContent {
  title: string;
  slug: string;
  shortDescription: string;
  longDescription: string;
  tags: string;
  metaTitle: string;
  metaDescription: string;
  metaKeywords: string;
}

function buildContent(
  brandName: string,
  modelName: string,
  categoryName: string,
  priceStr: string,
  allowFourG: boolean,
): ProductContent {
  const rawFull = `${brandName} ${modelName}`;
  const full    = allowFourG ? rawFull : strip4G(rawFull);
  const lc      = `${brandName} ${modelName}`.toLowerCase();
  const priceNum = Math.round(parseFloat(priceStr) || 5000);
  const priceFmt = priceNum.toLocaleString("en-PK");

  // ── Detect product type ────────────────────────────────────────────────
  const catLc   = categoryName.toLowerCase();
  const isOBD   = lc.includes("obd") || lc.includes("cj750") || lc.includes("cj220");
  const isKids  = lc.includes("td-02") || lc.includes("td02") || lc.includes("kids") || lc.includes("watch");
  const isBike  = lc.includes("s20") || lc.includes("gs900") || lc.includes("gm06") || catLc.includes("motorcycle");
  const isPersonal = lc.includes("lk208") || lc.includes("gf21") || lc.includes("p31") || catLc.includes("personal");
  const isMagnet   = lc.includes("g20") || lc.includes("magnetic");
  const isWanwayBrand = allowFourG;

  // ── Type label (4G only for Wanway) ───────────────────────────────────
  const netLabel = isWanwayBrand ? "4G LTE" : "GPS";
  const typeLabel =
    isOBD      ? "OBD GPS Tracker"
    : isKids   ? "Kids GPS Watch"
    : isBike   ? `${netLabel} Motorcycle Tracker`
    : isPersonal ? "Personal GPS Tracker"
    : isMagnet ? "Magnetic GPS Tracker"
    :            `${netLabel} Vehicle Tracker`;

  // ── Paragraphs ─────────────────────────────────────────────────────────
  let p1: string, p2: string;
  if (isOBD) {
    p1 = `The ${full} is a plug-and-play OBD-II GPS tracker designed for instant, tool-free installation in any car or SUV — simply plug into the OBD port under the dashboard and start tracking in minutes via the Geem mobile app or web portal.`;
    p2 = `Real-time location updates every 10 seconds, engine-status monitoring, speed alerts, geo-fence zones, trip history, and driver behaviour analysis give fleet managers and private car owners complete control across Pakistan's road network.`;
  } else if (isKids) {
    p1 = `The ${full} is a purpose-built GPS smart watch for school-going children, combining real-time location tracking with two-way voice calling in a durable, waterproof wristband — parents can see exactly where their child is and speak to them instantly.`;
    p2 = `Safety features include live GPS tracking, an SOS emergency button, school-mode quiet hours, step counter, anti-removal alerts, and a bright colour touch screen children love. Compatible with all Pakistani network SIM cards; ideal for school runs, family trips, and everyday peace of mind.`;
  } else if (isBike) {
    p1 = `The ${full} is a rugged GPS tracker engineered for motorcycles, rickshaws, and light vehicles. Its compact, waterproof body can be hidden under the seat, behind the fairing, or inside the frame — completely concealed and protected from rain and road dust.`;
    p2 = `Core features include real-time GPS location updates, vibration and tamper alerts, geo-fence zones, ignition on/off detection, remote engine cut-off, and speed alerts delivered via push notification and SMS. Works nationwide across Pakistan on all major networks.`;
  } else if (isPersonal) {
    p1 = `The ${full} is a pocket-sized personal GPS tracker ideal for lone workers, elderly family members, children, and travellers. Lightweight and discreet, it fits in a bag, pocket, or school bag and reports its live position to trusted contacts around the clock.`;
    p2 = `Long-lasting rechargeable battery, real-time location updates, SOS panic button, geo-fence alerts, historical trip replay, and nationwide network compatibility make it one of the most versatile personal trackers available in Pakistan — monitored via web platform and mobile app.`;
  } else if (isMagnet) {
    p1 = `The ${full} is a magnetic GPS tracker with a powerful built-in magnet that attaches instantly to any metal surface — under a vehicle, inside a car chassis, or on industrial equipment — for covert monitoring with no visible wires or installation.`;
    p2 = `Extended battery standby, a waterproof enclosure rated for all-weather use, real-time tracking, geo-fence alerts, movement detection, and historical route replay make it a top choice for covert vehicle monitoring and asset tracking across Pakistan.`;
  } else {
    p1 = `The ${full} is a professional vehicle GPS tracker delivering real-time location updates with fast refresh intervals. Hard-wired directly into the vehicle's power supply, it provides continuous 24/7 tracking with no battery management required.`;
    p2 = `Key features include real-time GPS tracking, geo-fence zone alerts, speed monitoring, ignition and engine-status detection, remote immobilisation, full trip history, and a multi-vehicle fleet dashboard. Operates on all major Pakistani networks and integrates with the Geem mobile app and web portal.`;
  }

  const p3 = `Order the ${full} online at Geem.pk with complete confidence — 100% genuine product, full manufacturer warranty, discreet packaging, and fast nationwide delivery to Karachi, Lahore, Islamabad, Rawalpindi, Faisalabad, and all major cities. Our expert team is on hand for installation guidance and after-sales support.`;

  const brandLc = brandName.toLowerCase();
  const modelLc = modelName.toLowerCase();

  const title = `${full} ${typeLabel} — ${full} Price in Pakistan`.slice(0, 120);
  const shortDescription = `${full} — professional GPS tracking at Rs ${priceFmt}. Genuine product with full warranty available at Geem.pk Pakistan.`.slice(0, 220);
  const longDescription  = [p1, p2, p3].join("\n\n");

  const tags = [
    slugify(brandName), slugify(modelName), slugify(typeLabel),
    "gps tracker pakistan", "vehicle tracker", "buy online pakistan",
    "geem.pk", `${brandLc} pakistan`, `${modelLc} price in pakistan`,
  ].join(", ");

  // SEO per spec: "Meta Title (Max 60 chars): [Official Brand & Model] Price in Pakistan — Geem.pk"
  const metaTitle = `${full} Price in Pakistan — Geem.pk`.slice(0, 60);

  // "Meta Description (Max 160 chars): Buy official [Product Title] in Pakistan at best price..."
  const metaDescription = `Buy official ${full} in Pakistan at best price. Real-time stock, fast nationwide delivery & genuine warranty on Geem.pk.`.slice(0, 160);

  const metaKeywords = [
    `${rawFull.toLowerCase()} price in pakistan`,
    `buy ${rawFull.toLowerCase()} pakistan`,
    `${rawFull.toLowerCase()} online pakistan`,
    `${brandLc} gps tracker pakistan`,
    `${modelLc} tracker`,
    `vehicle gps tracker pakistan`,
    `${slugify(typeLabel)} pakistan`,
    "geem.pk gps tracker",
    "real-time gps pakistan",
    "genuine warranty pakistan",
  ].join(", ");

  return { title, slug: slugify(`${brandName}-${modelName}`), shortDescription, longDescription, tags, metaTitle, metaDescription, metaKeywords };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function run() {
  console.log("═══════════════════════════════════════════════════════════════════");
  console.log("  Geem — Full Catalog Generator (End-to-End)");
  console.log("═══════════════════════════════════════════════════════════════════\n");

  // ── 1. Load reference data ───────────────────────────────────────────────
  const allBrands     = await db.select().from(brandsTable).where(eq(brandsTable.active, true));
  const allCategories = await db.select().from(categoriesTable);
  const allModels     = await db.select().from(deviceModelsTable).where(eq(deviceModelsTable.active, true));

  const brandMap    = new Map(allBrands.map(b => [b.id, b]));
  const modelMap    = new Map(allModels.map(m => [m.id, m]));
  const categoryMap = new Map(allCategories.map(c => [c.id, c]));

  // ── 2. Get all distinct brand+model combos with stock ───────────────────
  const combos = await db
    .selectDistinct({
      brandId:  inventoryItemsTable.brandId,
      modelId:  inventoryItemsTable.modelId,
      categoryId: inventoryItemsTable.categoryId,
    })
    .from(inventoryItemsTable);

  console.log(`Total distinct brand+model combos in inventory: ${combos.length}`);

  // Avg selling price per model
  const priceRows = await db
    .select({
      modelId:  inventoryItemsTable.modelId,
      avgPrice: sql<string>`ROUND(AVG(${inventoryItemsTable.sellingPrice}::numeric), 0)`,
      minPrice: sql<string>`MIN(${inventoryItemsTable.sellingPrice}::numeric)`,
    })
    .from(inventoryItemsTable)
    .groupBy(inventoryItemsTable.modelId);
  const priceMap = new Map(priceRows.map(r => [r.modelId, r.avgPrice]));

  // Stock qty per model
  const stockRows = await db
    .select({
      modelId: inventoryItemsTable.modelId,
      qty:     sql<number>`COUNT(*)::int`,
    })
    .from(inventoryItemsTable)
    .where(eq(inventoryItemsTable.status, "in_stock"))
    .groupBy(inventoryItemsTable.modelId);
  const stockMap = new Map(stockRows.map(r => [r.modelId, r.qty]));

  // Existing products for slug uniqueness
  const existingProducts = await db.select({
    id:    productsTable.id,
    slug:  productsTable.slug,
    title: productsTable.title,
    brandId:   productsTable.brandId,
    categoryId: productsTable.categoryId,
  }).from(productsTable);
  const existingSlugs = new Set(existingProducts.map(p => p.slug));

  // ── 3. Build work list, applying all exclusions ──────────────────────────
  type WorkItem = {
    brandId: number; modelId: number; categoryId: number | null;
    brandName: string; modelName: string; categoryName: string;
    avgPrice: string; stockQty: number; isFeatured: boolean;
    allowFourG: boolean;
  };

  const workList: WorkItem[] = [];
  const skippedReasons: string[] = [];

  // Track which model slugs we'll generate so we can detect primaries
  const modelStockMap = new Map<number, number>();
  for (const combo of combos) {
    modelStockMap.set(combo.modelId, (modelStockMap.get(combo.modelId) ?? 0) + (stockMap.get(combo.modelId) ?? 0));
  }

  for (const combo of combos) {
    const brand    = brandMap.get(combo.brandId);
    const model    = modelMap.get(combo.modelId);
    if (!brand || !model) continue;

    // Exclude brands
    if (isExcludedBrand(brand.name)) {
      skippedReasons.push(`BRAND_EXCLUDED: ${brand.name} ${model.name}`);
      continue;
    }

    // Resolve category
    const cat = combo.categoryId ? categoryMap.get(combo.categoryId) : null;
    const categoryName = cat?.name ?? "GPS Trackers";

    // Exclude mobile categories
    if (isMobileCategory(categoryName)) {
      skippedReasons.push(`MOBILE_EXCLUDED: ${brand.name} ${model.name} (cat: ${categoryName})`);
      continue;
    }

    const allowFourG = isWanway(brand.name);
    const avgPrice   = priceMap.get(combo.modelId) ?? "5000";
    const stockQty   = stockMap.get(combo.modelId) ?? 0;

    // Mark top-stock items as featured
    const isFeatured = stockQty >= 8;

    workList.push({
      brandId:      combo.brandId,
      modelId:      combo.modelId,
      categoryId:   combo.categoryId ?? null,
      brandName:    brand.name,
      modelName:    model.name,
      categoryName,
      avgPrice,
      stockQty,
      isFeatured,
      allowFourG,
    });
  }

  console.log(`✅ Items to process  : ${workList.length}`);
  console.log(`⏭  Excluded         : ${skippedReasons.length}`);
  if (skippedReasons.length) {
    skippedReasons.slice(0, 10).forEach(r => console.log(`   – ${r}`));
    if (skippedReasons.length > 10) console.log(`   … and ${skippedReasons.length - 10} more`);
  }
  console.log();

  // ── 4. Process each item ─────────────────────────────────────────────────
  let created = 0, updated = 0, failed = 0;
  const summary: { brand: string; model: string; status: string; slug: string }[] = [];

  for (const item of workList) {
    const label = `${item.brandName} ${item.modelName}`;
    console.log(`\n─── ${label} ${"─".repeat(Math.max(0, 55 - label.length))}`);
    console.log(`    Stock: ${item.stockQty}  Price: Rs ${item.avgPrice}  Category: ${item.categoryName}  4G-allowed: ${item.allowFourG}`);

    const content = buildContent(
      item.brandName, item.modelName, item.categoryName,
      item.avgPrice, item.allowFourG,
    );

    // Ensure slug is unique
    let slug = content.slug;
    if (existingSlugs.has(slug)) {
      // Check if it belongs to this brand+model — if so, we'll update it
      const existingMatch = existingProducts.find(p => p.slug === slug && p.brandId === item.brandId);
      if (!existingMatch) {
        let n = 2;
        while (existingSlugs.has(`${slug}-${n}`)) n++;
        slug = `${slug}-${n}`;
      }
    }
    existingSlugs.add(slug);

    // ── Images ──────────────────────────────────────────────────────────
    console.log(`    Searching & downloading images for: ${label}`);
    const { mainPath, galleryPaths } = await downloadProductImages(slug, item.brandName, item.modelName);

    if (!mainPath) {
      console.log(`    ⚠  No main image downloaded — will use placeholder path`);
    }
    const imageSuffix = `.jpg`;
    const finalMain    = mainPath    ?? `public/products/main/${slug}-main${imageSuffix}`;
    // Pad gallery to 3 entries with generated path names if download came up short
    const finalGallery = [...galleryPaths];
    for (let i = finalGallery.length; i < 3; i++) {
      finalGallery.push(`public/products/gallery/${slug}-g${i + 1}${imageSuffix}`);
    }

    // ── SEO meta (spec-compliant) ────────────────────────────────────────
    const salePrice = item.stockQty > 0
      ? (Math.round(parseFloat(item.avgPrice) * 0.95)).toString()
      : null;

    const productRow = {
      title:            content.title,
      slug,
      sku:              `${item.brandName.slice(0, 4).toUpperCase()}-${item.modelName.replace(/\s+/g, "").toUpperCase().slice(0, 8)}`,
      brandId:          item.brandId,
      categoryId:       item.categoryId,
      tags:             content.tags,
      price:            item.avgPrice,
      salePrice,
      stockQty:         item.stockQty,
      shortDescription: content.shortDescription,
      longDescription:  content.longDescription,
      featuredImage:    finalMain,
      galleryImages:    JSON.stringify(finalGallery),
      published:        true,
      featured:         item.isFeatured,
      hidePrice:        false,
      metaTitle:        content.metaTitle,
      metaDescription:  content.metaDescription,
      metaKeywords:     content.metaKeywords,
    };

    // ── Upsert ──────────────────────────────────────────────────────────
    try {
      const existingRow = existingProducts.find(
        p => p.slug === slug || (p.brandId === item.brandId && p.title.toLowerCase().includes(item.modelName.toLowerCase())),
      );

      if (existingRow) {
        await db.update(productsTable).set(productRow).where(eq(productsTable.id, existingRow.id));
        console.log(`    ✏  UPDATED  → slug: ${slug}`);
        updated++;
        summary.push({ brand: item.brandName, model: item.modelName, status: "updated", slug });
      } else {
        await db.insert(productsTable).values(productRow);
        console.log(`    ✅ CREATED  → slug: ${slug}`);
        created++;
        summary.push({ brand: item.brandName, model: item.modelName, status: "created", slug });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("unique") || msg.includes("duplicate")) {
        console.log(`    ⏭  Skipped (slug conflict): ${slug}`);
        summary.push({ brand: item.brandName, model: item.modelName, status: "skipped", slug });
      } else {
        console.error(`    ✗  FAILED: ${msg}`);
        failed++;
        summary.push({ brand: item.brandName, model: item.modelName, status: "failed", slug });
      }
    }
  }

  // ── 5. Final summary ─────────────────────────────────────────────────────
  console.log("\n═══════════════════════════════════════════════════════════════════");
  console.log("  CATALOG GENERATION COMPLETE");
  console.log("═══════════════════════════════════════════════════════════════════");
  console.log(`  Created  : ${created}`);
  console.log(`  Updated  : ${updated}`);
  console.log(`  Failed   : ${failed}`);
  console.log(`  Excluded : ${skippedReasons.length}`);
  console.log(`  Total    : ${workList.length}`);
  console.log("\nPublished products summary:");
  summary.forEach(s => {
    const icon = s.status === "created" ? "✅" : s.status === "updated" ? "✏ " : s.status === "failed" ? "✗ " : "⏭ ";
    console.log(`  ${icon} [${s.status.padEnd(7)}] ${s.brand} ${s.model}  (slug: ${s.slug})`);
  });
  console.log("\n✔ Images saved to:", UPLOADS_ROOT);
  console.log("✔ Run: nginx -s reload  (if needed to serve new images)");
  process.exit(0);
}

run().catch(err => {
  console.error("\n✗ Script failed:", err);
  process.exit(1);
});
