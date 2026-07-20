/**
 * sync-inventory-to-catalog.ts
 *
 * Finds every brand+model combination that exists in inventory_items
 * but has NO corresponding product in the products catalog, then creates
 * full SEO-optimised catalog entries for each missing item.
 *
 * Safe to run multiple times — skips slugs that already exist.
 *
 * Run ON the VPS:
 *   pnpm --filter @workspace/scripts run sync-inventory-catalog
 */

import {
  db,
  brandsTable,
  categoriesTable,
  deviceModelsTable,
  inventoryItemsTable,
  productsTable,
} from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";

// ── Helpers ──────────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** True when any existing product clearly covers this brand+model */
function isAlreadyCatalogued(
  existingSlugs: string[],
  existingTitles: string[],
  brandName: string,
  modelName: string,
): boolean {
  const bSlug = slugify(brandName);
  const mSlug = slugify(modelName);
  if (existingSlugs.some(s => s.includes(bSlug) && s.includes(mSlug))) return true;
  const bLow = brandName.toLowerCase();
  const mLow = modelName.toLowerCase();
  return existingTitles.some(
    t => t.toLowerCase().includes(bLow) && t.toLowerCase().includes(mLow),
  );
}

// ── Category inference ────────────────────────────────────────────────────────

function inferCategoryNames(brandName: string, modelName: string): string[] {
  const full = `${brandName} ${modelName}`.toLowerCase();

  if (full.includes("td-02") || full.includes("td02") || full.includes("kids") || full.includes("watch"))
    return ["Kids GPS Watches", "Personal GPS Trackers", "GPS Trackers"];
  if (full.includes("obd") || full.includes("cj750") || full.includes("cj220"))
    return ["OBD GPS Trackers", "Vehicle GPS Trackers", "GPS Trackers"];
  if (full.includes("lk208") || full.includes("gf21") || full.includes("p31") || full.includes("personal"))
    return ["Personal GPS Trackers", "GPS Trackers"];
  if (full.includes("gs900") || full.includes("gm06") || full.includes("motorcycle") || full.includes("bike"))
    return ["Motorcycle GPS Trackers", "Vehicle GPS Trackers", "GPS Trackers"];
  if (
    ["yuntrack","goome","micodus","wanway","sinotrack","365gps","360gps","geem","caretrack","carepro"].includes(brandName.toLowerCase()) ||
    full.includes("tracker") || full.includes("cj") || full.includes("gt0") || full.includes("mv7") || full.includes("st9") || full.includes("st8")
  )
    return ["Vehicle GPS Trackers", "GPS Trackers"];
  if (full.includes("spy") || full.includes("hidden") || full.includes("covert") || full.includes("pv-") || full.includes("lawmate"))
    return ["Spy Cameras & Surveillance"];
  if (full.includes("detector") || full.includes("rf") || full.includes("bug") || full.includes("tscm"))
    return ["Counter-Surveillance", "Security Equipment"];
  if (full.includes("hikvision") || full.includes("dahua") || full.includes("cctv") || full.includes("nvr"))
    return ["Smart Security Systems", "Security Equipment"];
  if (
    ["apple","samsung","xiaomi","huawei","oppo","vivo","realme","tecno","infinix"].includes(brandName.toLowerCase()) ||
    full.includes("iphone") || full.includes("galaxy")
  )
    return ["Smartphones"];
  return ["Security Equipment", "GPS Trackers"];
}

// ── Image defaults ────────────────────────────────────────────────────────────

function defaultImages(categoryName: string, modelName: string): { featured: string; gallery: string[] } {
  const lc = `${categoryName} ${modelName}`.toLowerCase();

  if (lc.includes("motorcycle") || lc.includes("s20"))
    return { featured: "/products/gps/s20.jpg", gallery: ["/products/gps/s20.jpg"] };
  if (lc.includes("obd") || lc.includes("cj750"))
    return { featured: "/products/gps/cj750.jpg", gallery: ["/products/gps/cj750.jpg", "/products/gps/cj750_2.jpg"] };
  if (lc.includes("kids") || lc.includes("watch") || lc.includes("td-02") || lc.includes("td02"))
    return { featured: "/products/gps/td02s.jpg", gallery: ["/products/gps/td02s.jpg"] };
  if (lc.includes("lk208") || lc.includes("personal"))
    return { featured: "/products/gps/lk208.jpg", gallery: ["/products/gps/lk208.jpg"] };
  if (lc.includes("g20m") || lc.includes("g20_m"))
    return { featured: "/products/gps/g20_mini.jpg", gallery: ["/products/gps/g20_mini.jpg", "/products/gps/g20.jpg"] };
  if (lc.includes("g20"))
    return { featured: "/products/gps/g20.jpg", gallery: ["/products/gps/g20.jpg", "/products/gps/g20_mini.jpg"] };
  if (lc.includes("gf21"))
    return { featured: "/products/gps/gf21.jpg", gallery: ["/products/gps/gf21.jpg"] };
  if (lc.includes("cj780"))
    return { featured: "/products/gps/cj780.jpg", gallery: ["/products/gps/cj780.jpg", "/products/gps/cj780_2.jpg"] };
  if (lc.includes("cj790"))
    return { featured: "/products/gps/cj790d.jpg", gallery: ["/products/gps/cj790d.jpg"] };
  if (lc.includes("orange 2") || lc.includes("orange2"))
    return { featured: "/products/gps/orange2.jpg", gallery: ["/products/gps/orange2.jpg", "/products/gps/orange2_2.jpg"] };
  if (lc.includes("orange"))
    return { featured: "/products/gps/orange_sim.jpg", gallery: ["/products/gps/orange_sim.jpg", "/products/gps/orange_sim2.jpg"] };
  if (lc.includes("gps") || lc.includes("tracker") || lc.includes("vehicle"))
    return { featured: "/products/gps/orange_sim.jpg", gallery: ["/products/gps/orange_sim.jpg"] };
  if (lc.includes("spy") || lc.includes("camera") || lc.includes("hidden"))
    return {
      featured: "https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=800&q=80",
      gallery:  ["https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=800&q=80"],
    };
  // Smartphone fallbacks
  if (lc.includes("iphone") || lc.includes("apple"))
    return {
      featured: "https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=800&q=80",
      gallery:  ["https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=800&q=80"],
    };
  if (lc.includes("samsung") || lc.includes("galaxy"))
    return {
      featured: "https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=800&q=80",
      gallery:  ["https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=800&q=80"],
    };
  return { featured: "/products/gps/orange_sim.jpg", gallery: ["/products/gps/orange_sim.jpg"] };
}

// ── Description generation (no external API needed) ───────────────────────────

interface ProductContent {
  title: string;
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
): ProductContent {
  const full      = `${brandName} ${modelName}`;
  const lc        = full.toLowerCase();
  const bSlug     = slugify(brandName);
  const mSlug     = slugify(modelName);
  const priceNum  = Math.round(parseFloat(priceStr) || 5000);
  const priceFmt  = priceNum.toLocaleString("en-PK");

  // Detect product type for copy
  const isOBD        = lc.includes("obd") || lc.includes("cj750") || lc.includes("cj220");
  const isKidsWatch  = lc.includes("td-02") || lc.includes("td02") || lc.includes("kids") || lc.includes("watch");
  const isMotorcycle = lc.includes("gs900") || lc.includes("gm06") || lc.includes("s20");
  const isPersonal   = lc.includes("lk208") || lc.includes("gf21") || lc.includes("p31");
  const isMagnet     = lc.includes("g20") || lc.includes("magnetic");
  const isGPS        = categoryName.toLowerCase().includes("gps");
  const isPhone      = categoryName.toLowerCase().includes("smartphone");
  const isSpy        = lc.includes("spy") || lc.includes("hidden") || lc.includes("lawmate");
  const isDetector   = lc.includes("detector") || lc.includes("rf") || lc.includes("bug");
  const isCCTV       = lc.includes("hikvision") || lc.includes("dahua") || lc.includes("cctv");

  let typeTag: string;
  let p1: string;
  let p2: string;

  if (isOBD) {
    typeTag = "obd gps tracker";
    p1 = `The ${full} is a plug-and-play OBD-II GPS tracker designed for instant installation in any car or SUV. Simply plug it into the OBD port under your dashboard — no wiring, no tools — and start tracking in minutes via the Geem mobile app or web portal.`;
    p2 = `Real-time location updates every 10 seconds, engine status monitoring, speed alerts, geofencing zones, trip history, and remote engine cut-off give fleet managers and private car owners complete control. Works across Pakistan on 4G/2G networks with a compact, tamper-evident design that stays hidden from the driver.`;
  } else if (isKidsWatch) {
    typeTag = "kids gps watch";
    p1 = `The ${full} is a 4G LTE GPS smartwatch built for children's safety, combining real-time location tracking with two-way voice calling in a durable, waterproof wristband. Parents can see exactly where their child is, set safe zones, and speak to them instantly — all from a single app.`;
    p2 = `Features include live GPS tracking, SOS emergency button, school-mode quiet hours, step counter, anti-removal alerts, and a bright colour touch screen that children love. Works on Pakistani 4G LTE networks. Ideal for school-going children, family trips, and peace of mind for parents across Pakistan.`;
  } else if (isMotorcycle) {
    typeTag = "motorcycle gps tracker";
    p1 = `The ${full} is a compact 4G GPS tracker engineered for motorcycles, rickshaws, and light vehicles. Concealed behind the dashboard or under the seat, it delivers tamper-proof real-time location tracking without visible antennas or wiring.`;
    p2 = `Real-time GPS updates every 10–30 seconds, vibration / movement alerts, geo-fence zones, ignition ON/OFF detection, and 24/7 live tracking via the Geem mobile app. Ideal for delivery fleets, rental businesses, and private motorcycle owners wanting anti-theft protection across Pakistan.`;
  } else if (isPersonal) {
    typeTag = "personal gps tracker";
    p1 = `The ${full} is a pocket-sized personal GPS tracker perfect for lone workers, elderly family members, children, and travellers. Lightweight and discreet, it fits in a bag, pocket, or school bag and reports its live position to trusted contacts around the clock.`;
    p2 = `Long-lasting rechargeable battery, real-time location updates, SOS panic button, geofence alerts, historical trip replay, and worldwide network compatibility make it one of the most versatile personal trackers available in Pakistan. Monitored via web platform and mobile app — no subscription required.`;
  } else if (isMagnet) {
    typeTag = "magnetic gps tracker";
    p1 = `The ${full} is a magnetic GPS tracker with a powerful built-in magnet that attaches instantly to any metal surface — under a vehicle, inside a car chassis, or on equipment. Designed for covert monitoring with no visible wires or installation required.`;
    p2 = `Extended battery life of up to 90 days on standby, waterproof enclosure, real-time tracking on 4G/2G, geo-fence alerts, movement detection, and historical route replay. Widely used in Pakistan for vehicle monitoring, asset tracking, and discreet fleet surveillance.`;
  } else if (isGPS) {
    typeTag = "vehicle gps tracker";
    p1 = `The ${full} is a professional 4G LTE vehicle GPS tracker delivering real-time location updates with 10-second refresh intervals. Hard-wired directly into the vehicle's power supply, it provides 24/7 tracking with no battery management required.`;
    p2 = `Features include real-time GPS tracking, geo-fence zone alerts, speed monitoring, ignition and engine status detection, remote immobilisation, trip history, and multi-vehicle fleet dashboard. Operates on all major Pakistani 4G/2G networks and is compatible with the Geem mobile app and web portal.`;
  } else if (isPhone) {
    typeTag = "smartphone";
    p1 = `The ${full} delivers a flagship smartphone experience with cutting-edge performance, an advanced camera system, and a premium build that stands out in the Pakistani market. Available at Geem.pk with genuine warranty and competitive pricing.`;
    p2 = `Engineered for power users who demand the best in mobile photography, processing speed, and display quality. Supports Pakistani 4G LTE bands, comes with official warranty, and is covered by Geem.pk's professional after-sales support team.`;
  } else if (isSpy) {
    typeTag = "spy camera";
    p1 = `The ${full} is a professional-grade covert surveillance camera engineered for discreet monitoring in homes, offices, and high-security environments. Its hidden form factor allows deployment in virtually any setting without detection.`;
    p2 = `Full HD 1080p recording, motion-triggered capture, long-duration battery, loop recording, and broad compatibility with standard DVRs and NVRs. Trusted by security professionals, private investigators, and corporate security teams across Pakistan.`;
  } else if (isDetector) {
    typeTag = "bug detector";
    p1 = `The ${full} is a professional RF signal and hidden device detector designed for counter-surveillance sweeps in offices, meeting rooms, hotel rooms, and private residences. Instantly alerts to active wireless bugs, hidden cameras, and GPS trackers.`;
    p2 = `Detects GSM, 3G, 4G, Wi-Fi, and RF transmissions across a broad frequency range. Compact, handheld design with sensitivity controls and visual / audio alert modes. Essential TSCM equipment for executives, legal professionals, and private security teams in Pakistan.`;
  } else if (isCCTV) {
    typeTag = "cctv camera";
    p1 = `The ${full} is a high-definition IP security camera offering crystal-clear surveillance for homes, businesses, and industrial premises. Designed for both indoor and outdoor deployment, it delivers round-the-clock monitoring with remote access.`;
    p2 = `4MP / 8MP resolution options, night vision up to 30 metres, motion detection with smart alerts, two-way audio, weatherproof IP67 housing, and seamless integration with Hikvision / Dahua NVR systems and the Geem-supplied monitoring platform.`;
  } else {
    typeTag = "security equipment";
    p1 = `The ${full} is a professional security and surveillance device available exclusively through Geem.pk — Pakistan's specialist in GPS trackers, covert cameras, RF detectors, and security equipment.`;
    p2 = `Engineered to professional standards, this device is designed for deployment by security professionals, businesses, government agencies, and private users who require reliable, high-performance security equipment in Pakistan.`;
  }

  const p3 = `Order the ${full} online at Geem.pk with complete confidence: 100% genuine product, full manufacturer warranty, discreet packaging, and fast nationwide delivery to Karachi, Lahore, Islamabad, Rawalpindi, Faisalabad, and all major cities. Our expert team is on hand for installation guidance and after-sales support. Contact us today for the best price in Pakistan.`;

  const title             = `${full} — ${isOBD ? "OBD GPS Tracker" : isKidsWatch ? "Kids GPS Watch" : isMotorcycle ? "Motorcycle GPS Tracker" : isPersonal ? "Personal GPS Tracker" : isMagnet ? "Magnetic GPS Tracker" : isGPS ? "4G LTE Vehicle GPS Tracker" : isPhone ? "Smartphone" : isSpy ? "Covert Surveillance Camera" : isDetector ? "RF Bug Detector" : isCCTV ? "IP Security Camera" : "Security Equipment"} | Geem.pk`.slice(0, 120);
  const shortDescription  = `${full} — ${isGPS ? "real-time 4G LTE tracking" : isPhone ? "flagship performance" : "professional-grade performance"} at Rs ${priceFmt}. Available at Geem.pk Pakistan.`.slice(0, 160);
  const longDescription   = `${p1}\n\n${p2}\n\n${p3}`;
  const tags              = [
    bSlug, mSlug, typeTag, "buy online pakistan",
    "security equipment pakistan", "surveillance pakistan",
    "geem.pk", `${bSlug} pakistan`, `${mSlug} price in pakistan`,
    isGPS ? "gps tracker pakistan" : "spy equipment pakistan",
    isGPS ? "vehicle tracker" : "security device",
    "genuine warranty pakistan",
  ].join(", ");
  const metaTitle         = `${full} Price in Pakistan | Geem.pk`.slice(0, 65);
  const metaDescription   = `Buy ${full} in Pakistan at Rs ${priceFmt}. ${isGPS ? "4G LTE GPS tracking, real-time updates." : isPhone ? "Genuine, warranty included." : "Genuine product, full warranty."} Fast delivery. Geem.pk`.slice(0, 160);
  const metaKeywords      = [
    `${full.toLowerCase()} price in pakistan`,
    `buy ${full.toLowerCase()} pakistan`,
    `${full.toLowerCase()} online pakistan`,
    `${brandName.toLowerCase()} pakistan`,
    `${modelName.toLowerCase()} tracker pakistan`,
    typeTag + " pakistan",
    "gps tracker price in pakistan",
    "security equipment pakistan",
    "geem.pk",
    `${bSlug} ${mSlug}`,
  ].join(", ");

  return { title, shortDescription, longDescription, tags, metaTitle, metaDescription, metaKeywords };
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function run() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(" Geem — Sync Inventory → Catalog");
  console.log("═══════════════════════════════════════════════════════════════\n");

  // All distinct brand+model combos that have inventory
  const inventoryCombos = await db
    .selectDistinct({ brandId: inventoryItemsTable.brandId, modelId: inventoryItemsTable.modelId })
    .from(inventoryItemsTable);

  console.log(`Found ${inventoryCombos.length} distinct brand+model combos in inventory.\n`);
  if (inventoryCombos.length === 0) { console.log("Nothing in inventory."); process.exit(0); }

  // Lookup tables
  const allBrands     = await db.select().from(brandsTable);
  const allModels     = await db.select().from(deviceModelsTable);
  const allCategories = await db.select().from(categoriesTable);

  const brandMap    = new Map(allBrands.map(b => [b.id, b]));
  const modelMap    = new Map(allModels.map(m => [m.id, m]));
  const categoryMap = new Map(allCategories.map(c => [c.name, c.id]));

  // Existing products
  const existingProducts = await db.select({ slug: productsTable.slug, title: productsTable.title }).from(productsTable);
  const existingSlugs    = existingProducts.map(p => p.slug);
  const existingTitles   = existingProducts.map(p => p.title);

  // Average selling price per model
  const priceRows = await db
    .select({
      modelId:  inventoryItemsTable.modelId,
      avgPrice: sql<string>`ROUND(AVG(${inventoryItemsTable.sellingPrice}::numeric), 0)`,
    })
    .from(inventoryItemsTable)
    .groupBy(inventoryItemsTable.modelId);
  const priceMap = new Map(priceRows.map(r => [r.modelId, r.avgPrice]));

  // Find gaps
  type Gap = { brandId: number; modelId: number; brandName: string; modelName: string; avgPrice: string };
  const gaps: Gap[] = [];

  for (const c of inventoryCombos) {
    const brand = brandMap.get(c.brandId);
    const model = modelMap.get(c.modelId);
    if (!brand || !model) continue;
    if (!isAlreadyCatalogued(existingSlugs, existingTitles, brand.name, model.name)) {
      gaps.push({ brandId: c.brandId, modelId: c.modelId, brandName: brand.name, modelName: model.name, avgPrice: priceMap.get(c.modelId) ?? "5000" });
    }
  }

  console.log(`✅ Already catalogued : ${inventoryCombos.length - gaps.length}`);
  console.log(`❌ Missing from catalog: ${gaps.length}\n`);

  if (gaps.length === 0) {
    console.log("All inventory items already have catalog entries. Nothing to do! 🎉");
    process.exit(0);
  }

  console.log("Items to add:");
  gaps.forEach(g => console.log(`  • ${g.brandName} ${g.modelName}  (avg Rs ${g.avgPrice})`));
  console.log();

  let created = 0, skipped = 0, failed = 0;

  for (const gap of gaps) {
    console.log(`\n─── ${gap.brandName} ${gap.modelName} ────────────────────────────`);

    // Resolve category
    const catCandidates = inferCategoryNames(gap.brandName, gap.modelName);
    let categoryId: number | null = null;
    let resolvedCat = catCandidates[0];
    for (const name of catCandidates) {
      const id = categoryMap.get(name);
      if (id !== undefined) { categoryId = id; resolvedCat = name; break; }
    }
    if (categoryId === null) {
      const [newCat] = await db.insert(categoriesTable).values({ name: resolvedCat, active: true }).returning();
      categoryId = newCat.id;
      categoryMap.set(resolvedCat, categoryId);
      console.log(`  + Created category: ${resolvedCat}`);
    }
    console.log(`  Category: ${resolvedCat}`);

    const sellingPrice = parseFloat(gap.avgPrice) || 5000;
    const priceStr     = sellingPrice.toFixed(0);
    const salePrice    = sellingPrice > 0 ? (sellingPrice * 0.95).toFixed(0) : null;

    // In-stock qty
    const stockRows = await db
      .select({ qty: sql<number>`COUNT(*)::int` })
      .from(inventoryItemsTable)
      .where(and(eq(inventoryItemsTable.modelId, gap.modelId), eq(inventoryItemsTable.status, "in_stock")));
    const stockQty = stockRows[0]?.qty ?? 0;

    // Build slug (unique)
    let slug = slugify(`${gap.brandName}-${gap.modelName}`);
    let n = 0;
    while (existingSlugs.includes(slug)) { n++; slug = slugify(`${gap.brandName}-${gap.modelName}-${n}`); }
    existingSlugs.push(slug);

    const imgs    = defaultImages(resolvedCat, gap.modelName);
    const content = buildContent(gap.brandName, gap.modelName, resolvedCat, priceStr);
    const sku     = `${gap.brandName.slice(0, 4).toUpperCase()}-${gap.modelName.replace(/\s+/g, "").toUpperCase().slice(0, 8)}`;

    try {
      await db.insert(productsTable).values({
        title:            content.title,
        slug,
        sku,
        brandId:          gap.brandId,
        categoryId,
        tags:             content.tags,
        price:            priceStr,
        salePrice,
        stockQty,
        shortDescription: content.shortDescription,
        longDescription:  content.longDescription,
        featuredImage:    imgs.featured,
        galleryImages:    JSON.stringify(imgs.gallery),
        published:        true,
        featured:         false,
        metaTitle:        content.metaTitle,
        metaDescription:  content.metaDescription,
        metaKeywords:     content.metaKeywords,
      });
      console.log(`  ✅ Created: "${content.title}" (slug: ${slug}, stock: ${stockQty})`);
      created++;
    } catch (err: any) {
      if (err?.message?.includes("unique") || err?.message?.includes("duplicate")) {
        console.log(`  ⏭  Skipped (already exists): ${slug}`);
        skipped++;
      } else {
        console.error(`  ✗  Failed: ${err?.message}`);
        failed++;
      }
    }
  }

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log(` Done!  Created: ${created}  Skipped: ${skipped}  Failed: ${failed}  Already had: ${inventoryCombos.length - gaps.length}`);
  console.log("═══════════════════════════════════════════════════════════════");
  process.exit(0);
}

run().catch(err => { console.error("Script failed:", err); process.exit(1); });
