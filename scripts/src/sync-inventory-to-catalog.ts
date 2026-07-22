/**
 * sync-inventory-to-catalog.ts
 *
 * Two-phase idempotent sync:
 *   Phase 1 — CREATE: for every brand+model combo in inventory_items that has
 *              no matching product in the catalog, inserts a new published product
 *              with a basic skeleton. Images and rich descriptions are intentionally
 *              left empty so batch-complete-catalog.ts picks them up on the next run.
 *
 *   Phase 2 — UPDATE STOCK: for every existing product that was matched to an
 *              inventory model, refreshes stockQty from the live "in_stock" count
 *              and ensures published = true.
 *
 * Safe to run as many times as needed — no duplicates are ever created.
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
import { eq, and, sql, inArray } from "drizzle-orm";

// ── Helpers ──────────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/**
 * Returns the existing product ID if the catalog already covers this brand+model,
 * otherwise returns null.
 */
function findExistingProduct(
  existingProducts: Array<{ id: number; slug: string; title: string }>,
  brandName: string,
  modelName: string,
): number | null {
  const bLow = brandName.toLowerCase();
  const mLow = modelName.toLowerCase();
  const bSlug = slugify(brandName);
  const mSlug = slugify(modelName);
  const found = existingProducts.find(p => {
    const sLow = p.slug.toLowerCase();
    const tLow = p.title.toLowerCase();
    return (
      (sLow.includes(bSlug) && sLow.includes(mSlug)) ||
      (tLow.includes(bLow) && tLow.includes(mLow))
    );
  });
  return found?.id ?? null;
}

// ── Category inference ────────────────────────────────────────────────────────

function inferCategoryName(brandName: string, modelName: string): string {
  const full = `${brandName} ${modelName}`.toLowerCase();
  if (full.includes("td-02") || full.includes("td02") || full.includes("kids") || full.includes("watch"))
    return "Kids GPS Watches";
  if (full.includes("obd") || full.includes("cj750") || full.includes("cj220"))
    return "OBD GPS Trackers";
  if (full.includes("lk208") || full.includes("gf21") || full.includes("p31"))
    return "Personal GPS Trackers";
  if (full.includes("gs900") || full.includes("gm06") || full.includes("s20") || full.includes("motorcycle") || full.includes("bike"))
    return "Motorcycle GPS Trackers";
  if (
    ["yuntrack", "goome", "micodus", "wanway", "sinotrack", "365gps", "360gps", "geem", "caretrack", "carepro", "coban", "tkstar"].includes(brandName.toLowerCase()) ||
    full.includes("tracker") || full.includes("cj") || full.includes("gt0") || full.includes("mv7") || full.includes("st9") || full.includes("st8")
  )
    return "Vehicle GPS Trackers";
  if (full.includes("spy") || full.includes("hidden") || full.includes("covert") || full.includes("pv-") || full.includes("lawmate"))
    return "Spy Cameras & Surveillance";
  if (full.includes("detector") || full.includes("rf") || full.includes("bug") || full.includes("tscm"))
    return "Counter-Surveillance";
  if (full.includes("hikvision") || full.includes("dahua") || full.includes("cctv") || full.includes("nvr"))
    return "Smart Security Systems";
  if (["apple","samsung","xiaomi","huawei","oppo","vivo","realme","tecno","infinix"].includes(brandName.toLowerCase()) || full.includes("iphone") || full.includes("galaxy"))
    return "Smartphones";
  return "GPS Tracking & Telematics";
}

async function findOrCreateCategory(name: string): Promise<number> {
  const [existing] = await db.select({ id: categoriesTable.id }).from(categoriesTable).where(eq(categoriesTable.name, name));
  if (existing) return existing.id;

  // Try to put GPS tracker categories under a "GPS Tracking & Telematics" parent
  let parentId: number | null = null;
  const gpsSubcats = ["Vehicle GPS Trackers", "Kids GPS Watches", "OBD GPS Trackers", "Personal GPS Trackers", "Motorcycle GPS Trackers"];
  if (gpsSubcats.includes(name)) {
    const [parent] = await db.select({ id: categoriesTable.id }).from(categoriesTable).where(eq(categoriesTable.name, "GPS Tracking & Telematics"));
    if (parent) {
      parentId = parent.id;
    } else {
      const [newParent] = await db.insert(categoriesTable).values({ name: "GPS Tracking & Telematics", active: true }).returning({ id: categoriesTable.id });
      parentId = newParent.id;
    }
  }

  const [newCat] = await db.insert(categoriesTable).values({ name, parentId, active: true }).returning({ id: categoriesTable.id });
  console.log(`  + Created category: ${name}`);
  return newCat.id;
}

// ── Short description (batch-complete will replace longDescription) ───────────

function buildShortDescription(brandName: string, modelName: string, categoryName: string, priceStr: string): string {
  const full     = `${brandName} ${modelName}`;
  const priceNum = Math.round(parseFloat(priceStr) || 5000);
  const priceFmt = priceNum.toLocaleString("en-PK");
  const lc       = `${brandName} ${modelName} ${categoryName}`.toLowerCase();

  if (lc.includes("obd"))        return `${full} plug-and-play OBD-II GPS tracker. No wiring needed — instant setup. Rs ${priceFmt} at Geem.pk Pakistan.`;
  if (lc.includes("kids") || lc.includes("watch"))  return `${full} 4G kids GPS smartwatch with SOS, two-way calling and real-time tracking. Rs ${priceFmt} at Geem.pk.`;
  if (lc.includes("s20") || lc.includes("motorcycle")) return `${full} compact 4G motorcycle GPS tracker. Anti-theft, real-time updates. Rs ${priceFmt} at Geem.pk.`;
  if (lc.includes("personal"))   return `${full} pocket-sized personal GPS tracker with SOS button and 4G coverage. Rs ${priceFmt} at Geem.pk.`;
  if (lc.includes("magnetic") || lc.includes("g20")) return `${full} magnetic GPS tracker with 90-day battery. Covert vehicle tracking. Rs ${priceFmt} at Geem.pk.`;
  return `${full} 4G LTE real-time GPS tracker for vehicles and fleet management in Pakistan. Rs ${priceFmt} at Geem.pk.`;
}

// ── SKU helper ───────────────────────────────────────────────────────────────

function buildSku(brandName: string, modelName: string): string {
  return `${brandName.slice(0, 4).toUpperCase()}-${modelName.replace(/\s+/g, "").toUpperCase().slice(0, 8)}`;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function run() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(" Geem — Sync Inventory → Catalog  (v2)");
  console.log("═══════════════════════════════════════════════════════════════\n");

  // ── Load distinct brand+model combos from inventory ───────────────────────
  const inventoryCombos = await db
    .selectDistinct({ brandId: inventoryItemsTable.brandId, modelId: inventoryItemsTable.modelId })
    .from(inventoryItemsTable);

  console.log(`Distinct brand+model combos in inventory: ${inventoryCombos.length}`);
  if (inventoryCombos.length === 0) { console.log("Nothing in inventory."); process.exit(0); }

  // ── Load lookup tables ────────────────────────────────────────────────────
  const allBrands  = await db.select().from(brandsTable);
  const allModels  = await db.select().from(deviceModelsTable);
  const brandMap   = new Map(allBrands.map(b => [b.id, b]));
  const modelMap   = new Map(allModels.map(m => [m.id, m]));

  // ── Load existing products for duplicate detection ────────────────────────
  const existingProducts = await db.select({ id: productsTable.id, slug: productsTable.slug, title: productsTable.title }).from(productsTable);
  const existingSlugs    = new Set(existingProducts.map(p => p.slug));

  // ── Average selling price per modelId ─────────────────────────────────────
  const priceRows = await db
    .select({
      modelId:  inventoryItemsTable.modelId,
      avgPrice: sql<string>`ROUND(AVG(${inventoryItemsTable.sellingPrice}::numeric), 0)`,
    })
    .from(inventoryItemsTable)
    .groupBy(inventoryItemsTable.modelId);
  const priceMap = new Map(priceRows.map(r => [r.modelId, r.avgPrice]));

  // ── In-stock count per modelId ─────────────────────────────────────────────
  const stockRows = await db
    .select({
      modelId: inventoryItemsTable.modelId,
      qty:     sql<number>`COUNT(*)::int`,
    })
    .from(inventoryItemsTable)
    .where(eq(inventoryItemsTable.status, "in_stock"))
    .groupBy(inventoryItemsTable.modelId);
  const stockMap = new Map(stockRows.map(r => [r.modelId, r.qty]));

  // ── Classify each combo as: existing (needs stock update) or new (create) ─
  type Existing = { productId: number; modelId: number; brandName: string; modelName: string; stockQty: number };
  type NewEntry  = { brandId: number; modelId: number; brandName: string; modelName: string; avgPrice: string; stockQty: number };

  const toUpdate: Existing[] = [];
  const toCreate: NewEntry[]  = [];

  for (const c of inventoryCombos) {
    const brand = brandMap.get(c.brandId);
    const model = modelMap.get(c.modelId);
    if (!brand || !model) continue;
    const stockQty = stockMap.get(c.modelId) ?? 0;
    const existId  = findExistingProduct(existingProducts, brand.name, model.name);
    if (existId !== null) {
      toUpdate.push({ productId: existId, modelId: c.modelId, brandName: brand.name, modelName: model.name, stockQty });
    } else {
      toCreate.push({ brandId: c.brandId, modelId: c.modelId, brandName: brand.name, modelName: model.name, avgPrice: priceMap.get(c.modelId) ?? "5000", stockQty });
    }
  }

  console.log(`Already catalogued (stock sync): ${toUpdate.length}`);
  console.log(`Missing from catalog (create):   ${toCreate.length}\n`);

  // ── Phase 1: Update stockQty for existing catalog products ────────────────
  if (toUpdate.length > 0) {
    console.log("── Phase 1: Updating stock counts for existing catalog products ──");
    let stockUpdated = 0;
    for (const item of toUpdate) {
      await db.update(productsTable)
        .set({ stockQty: item.stockQty, published: true })
        .where(eq(productsTable.id, item.productId));
      stockUpdated++;
      if (stockUpdated <= 10 || item.stockQty > 0) {
        console.log(`  ✓ ${item.brandName} ${item.modelName} → stockQty=${item.stockQty}`);
      }
    }
    console.log(`\n  Updated ${stockUpdated} products' stock counts.\n`);
  }

  // ── Phase 2: Create new catalog entries ───────────────────────────────────
  if (toCreate.length === 0) {
    console.log("✅ All inventory models are already in the catalog.");
    process.exit(0);
  }

  console.log(`── Phase 2: Creating ${toCreate.length} new catalog entries ──`);
  console.log("   (Images and rich descriptions will be filled by batch-complete)\n");

  let created = 0, skipped = 0, failed = 0;

  for (const gap of toCreate) {
    const catName   = inferCategoryName(gap.brandName, gap.modelName);
    const categoryId = await findOrCreateCategory(catName);

    const price     = parseFloat(gap.avgPrice) || 5000;
    const priceStr  = price.toFixed(0);
    const salePrice = price > 0 ? (price * 0.95).toFixed(0) : null;

    // Unique slug
    let slug = slugify(`${gap.brandName}-${gap.modelName}`);
    let n = 0;
    while (existingSlugs.has(slug)) { n++; slug = slugify(`${gap.brandName}-${gap.modelName}-${n}`); }
    existingSlugs.add(slug);

    const shortDesc = buildShortDescription(gap.brandName, gap.modelName, catName, priceStr);
    const sku       = buildSku(gap.brandName, gap.modelName);
    const fullTitle = `${gap.brandName} ${gap.modelName}`;
    const metaTitle = `${fullTitle} Price in Pakistan | Geem.pk`.slice(0, 65);
    const metaDesc  = `Buy ${fullTitle} GPS tracker in Pakistan. ${catName}. Genuine product, fast delivery. Geem.pk`.slice(0, 160);

    try {
      await db.insert(productsTable).values({
        title:            fullTitle,
        slug,
        sku,
        brandId:          gap.brandId,
        categoryId,
        tags:             null,          // batch-complete will set proper tags
        price:            priceStr,
        salePrice,
        stockQty:         gap.stockQty,
        shortDescription: shortDesc,
        longDescription:  null,          // intentionally empty → batch-complete enriches
        featuredImage:    null,          // intentionally null → batch-complete downloads
        galleryImages:    null,          // intentionally null → batch-complete downloads
        published:        true,
        featured:         false,
        metaTitle,
        metaDescription:  metaDesc,
        metaKeywords:     null,
        hidePrice:        false,
      });
      console.log(`  ✅ Created: "${fullTitle}" (slug: ${slug}, stock: ${gap.stockQty}, category: ${catName})`);
      created++;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("unique") || msg.includes("duplicate")) {
        console.log(`  ⏭  Skipped (slug conflict): ${slug}`);
        skipped++;
      } else {
        console.error(`  ✗  Failed: ${msg}`);
        failed++;
      }
    }
  }

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log(` Done!`);
  console.log(`   Phase 1 — Stock updated  : ${toUpdate.length}`);
  console.log(`   Phase 2 — Created        : ${created}`);
  console.log(`   Phase 2 — Skipped        : ${skipped}`);
  console.log(`   Phase 2 — Failed         : ${failed}`);
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("\n👉 Now run batch-complete to enrich images + descriptions:");
  console.log("   pnpm --filter @workspace/scripts run batch-complete\n");
  process.exit(0);
}

run().catch(err => { console.error("Script failed:", err); process.exit(1); });
