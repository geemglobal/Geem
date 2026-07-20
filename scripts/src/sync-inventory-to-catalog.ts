/**
 * sync-inventory-to-catalog.ts
 *
 * Finds every brand+model combination that exists in inventory_items
 * but has NO corresponding product in the products catalog, then creates
 * full SEO-optimised catalog entries for each missing item — using the
 * same OpenAI content-generation pattern as the ERP's product_ai route.
 *
 * Run ON the VPS (where DATABASE_URL points to localhost):
 *   pnpm --filter @workspace/scripts run sync-inventory-catalog
 *
 * Safe to run multiple times — uses upsert-by-slug logic.
 */

import { db, brandsTable, categoriesTable, deviceModelsTable, inventoryItemsTable, productsTable } from "@workspace/db";
import { eq, sql, and, ilike, inArray } from "drizzle-orm";
import OpenAI from "openai";

// ── OpenAI client (same env vars the API server uses) ────────────────────────
function getOpenAI() {
  return new OpenAI({
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    apiKey:  process.env.AI_INTEGRATIONS_OPENAI_API_KEY ?? process.env.OPENAI_API_KEY ?? "dummy",
  });
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** True if any existing product looks like it covers this brand+model combo */
function isAlreadyCatalogued(
  existingSlugs: string[],
  existingTitles: string[],
  brandName: string,
  modelName: string,
): boolean {
  const bSlug = slugify(brandName);
  const mSlug = slugify(modelName);

  // Primary: slug contains both brand slug and model slug
  const slugMatch = existingSlugs.some(
    s => s.includes(bSlug) && s.includes(mSlug),
  );
  if (slugMatch) return true;

  // Secondary: title contains brand and model (case-insensitive)
  const bLower = brandName.toLowerCase();
  const mLower = modelName.toLowerCase();
  const titleMatch = existingTitles.some(
    t => t.toLowerCase().includes(bLower) && t.toLowerCase().includes(mLower),
  );
  return titleMatch;
}

/**
 * Infer the most appropriate category name from brand and model names.
 * Returns an ordered list of category name candidates (first match wins).
 */
function inferCategoryNames(brandName: string, modelName: string): string[] {
  const full = `${brandName} ${modelName}`.toLowerCase();

  // Kids GPS watches
  if (full.includes("td-02") || full.includes("td02") || full.includes("kids") || full.includes("watch")) {
    return ["Kids GPS Watches", "Personal GPS Trackers", "GPS Trackers"];
  }
  // OBD trackers
  if (full.includes("obd") || full.includes("cj750") || full.includes("cj220")) {
    return ["OBD GPS Trackers", "Vehicle GPS Trackers", "GPS Trackers"];
  }
  // Personal / portable trackers
  if (
    full.includes("personal") || full.includes("lk208") || full.includes("gf21") ||
    full.includes("p31") || full.includes("portable")
  ) {
    return ["Personal GPS Trackers", "GPS Trackers"];
  }
  // Motorcycle trackers
  if (
    full.includes("motorcycle") || full.includes("bike") || full.includes("gs900") ||
    full.includes("gm06") || full.includes("s20")
  ) {
    return ["Motorcycle GPS Trackers", "Vehicle GPS Trackers", "GPS Trackers"];
  }
  // GPS brands → vehicle trackers
  if (
    ["yuntrack", "goome", "micodus", "wanway", "sinotrack", "365gps", "360gps", "geem", "unbranded"].includes(
      brandName.toLowerCase(),
    ) ||
    full.includes("tracker") || full.includes("gps") || full.includes("cj") ||
    full.includes("gt0") || full.includes("mv7")
  ) {
    return ["Vehicle GPS Trackers", "GPS Trackers"];
  }
  // Spy / hidden cameras
  if (
    full.includes("spy") || full.includes("camera") || full.includes("hidden") ||
    full.includes("covert") || full.includes("lawmate") || full.includes("pv-")
  ) {
    return ["Spy Cameras & Surveillance"];
  }
  // Counter-surveillance
  if (
    full.includes("detector") || full.includes("bug") || full.includes("rf") ||
    full.includes("tscm") || full.includes("sweep")
  ) {
    return ["Counter-Surveillance", "Security Equipment"];
  }
  // Smart security
  if (
    full.includes("hikvision") || full.includes("dahua") || full.includes("cctv") ||
    full.includes("nvr") || full.includes("ip camera")
  ) {
    return ["Smart Security Systems", "Security Equipment"];
  }
  // Smartphones
  if (
    ["apple", "samsung", "xiaomi", "huawei", "oppo", "vivo", "realme", "tecno", "infinix"].includes(
      brandName.toLowerCase(),
    ) ||
    full.includes("iphone") || full.includes("galaxy") || full.includes("pixel")
  ) {
    return ["Smartphones"];
  }
  // Tablets
  if (full.includes("tab") || full.includes("ipad")) {
    return ["Tablets"];
  }

  return ["Security Equipment", "GPS Trackers"];
}

/** Default image for a model based on inferred category */
function defaultImage(categoryName: string, modelName: string): { featured: string; gallery: string[] } {
  const lc = categoryName.toLowerCase() + " " + modelName.toLowerCase();

  if (lc.includes("motorcycle") || lc.includes("bike")) {
    return { featured: "/products/gps/s20.jpg", gallery: ["/products/gps/s20.jpg"] };
  }
  if (lc.includes("obd")) {
    return { featured: "/products/gps/cj750.jpg", gallery: ["/products/gps/cj750.jpg", "/products/gps/cj750_2.jpg"] };
  }
  if (lc.includes("kids") || lc.includes("watch")) {
    return { featured: "/products/gps/td02s.jpg", gallery: ["/products/gps/td02s.jpg"] };
  }
  if (lc.includes("personal") || lc.includes("portable")) {
    return { featured: "/products/gps/lk208.jpg", gallery: ["/products/gps/lk208.jpg"] };
  }
  if (lc.includes("magnetic") || lc.includes("g20")) {
    return { featured: "/products/gps/g20.jpg", gallery: ["/products/gps/g20.jpg", "/products/gps/g20_mini.jpg"] };
  }
  if (lc.includes("gps") || lc.includes("tracker") || lc.includes("vehicle")) {
    return { featured: "/products/gps/orange_sim.jpg", gallery: ["/products/gps/orange_sim.jpg", "/products/gps/orange_sim2.jpg"] };
  }
  if (lc.includes("spy") || lc.includes("camera") || lc.includes("hidden")) {
    return {
      featured: "https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=800&q=80",
      gallery:  ["https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=800&q=80"],
    };
  }
  if (lc.includes("detector") || lc.includes("rf") || lc.includes("bug")) {
    return {
      featured: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&q=80",
      gallery:  ["https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&q=80"],
    };
  }
  if (lc.includes("iphone")) {
    return {
      featured: "https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=800&q=80",
      gallery:  ["https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=800&q=80"],
    };
  }
  if (lc.includes("samsung") || lc.includes("galaxy")) {
    return {
      featured: "https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=800&q=80",
      gallery:  ["https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=800&q=80"],
    };
  }
  // Generic fallback
  return {
    featured: "/products/gps/orange_sim.jpg",
    gallery:  ["/products/gps/orange_sim.jpg"],
  };
}

interface AIContent {
  title: string;
  shortDescription: string;
  longDescription: string;
  tags: string;
  metaTitle: string;
  metaDescription: string;
  metaKeywords: string;
}

async function generateContent(brandName: string, modelName: string, priceStr: string, categoryName: string): Promise<AIContent | null> {
  try {
    const openai = getOpenAI();
    const productLabel = `${brandName} ${modelName}`;
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_completion_tokens: 1800,
      messages: [{
        role: "user",
        content: `You are a senior SEO content strategist and e-commerce copywriter for Geem.pk — Pakistan's specialist in GPS trackers, spy cameras, surveillance equipment, and security devices.

Write a complete, professional, Google-ranking product listing for:

Product: ${productLabel}
Brand: ${brandName}
Category: ${categoryName}
Price (PKR): ${priceStr}
Market: Pakistan
Store: Geem.pk — specialists in GPS trackers, spy cameras, Lawmate surveillance, signal detectors, CCTV, and professional security equipment

RULES:
- Use real, accurate features and specifications for this exact product (you know them)
- Never invent specs you are unsure of — describe benefits instead
- Pakistan-centric: buyers search "[product] price in pakistan", "buy [product] online pakistan"
- Do NOT repeat the same phrase more than twice
- Do NOT mention mobile phones unless the product IS a phone

Return ONLY valid JSON (no markdown, no code fences) with exactly these fields:

{
  "title": "Professional product title. Format: '[Brand] [Full Model Name] — [key benefit/type]'. Max 80 chars.",
  "shortDescription": "One punchy sentence (max 140 chars) with the product's key selling point. End with 'Available at Geem.pk Pakistan.'",
  "longDescription": "Exactly 3 paragraphs separated by a blank line. P1 (~60 words): product name, primary use case, 2-3 standout features with real detail. P2 (~80 words): real specs and use cases for Pakistani security professionals, businesses, and families. P3 (~50 words): why buy from Geem.pk — genuine product, warranty, discreet nationwide delivery (Karachi, Lahore, Islamabad), expert support, secure payment. End with a call to action.",
  "tags": "12 lowercase comma-separated tags. Include brand, model, 'buy online pakistan', a use-case tag, 'security equipment pakistan', 'geem.pk', plus 6 product/feature tags.",
  "metaTitle": "Google title tag — max 60 chars. Format: '[Product Name] Price in Pakistan | Geem.pk'",
  "metaDescription": "Google meta description — max 155 chars. Include product name, 1-2 key features, price, and 'Geem.pk'.",
  "metaKeywords": "10 comma-separated keyword phrases for Google. Include '[product] price in pakistan', 'buy [product] pakistan', and 8 specific feature/use keywords."
}`,
      }],
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "";
    // Strip any accidental code fences
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
    return JSON.parse(cleaned) as AIContent;
  } catch (err) {
    console.error(`  ⚠  AI content generation failed for ${brandName} ${modelName}:`, err);
    return null;
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function run() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(" Geem — Sync Inventory → Catalog");
  console.log("═══════════════════════════════════════════════════════════════\n");

  // 1. Pull all distinct (brandId, modelId) combos that actually have inventory
  const inventoryCombos = await db
    .selectDistinct({
      brandId:   inventoryItemsTable.brandId,
      modelId:   inventoryItemsTable.modelId,
    })
    .from(inventoryItemsTable);

  console.log(`Found ${inventoryCombos.length} distinct brand+model combos in inventory.\n`);

  if (inventoryCombos.length === 0) {
    console.log("Nothing in inventory — nothing to sync.");
    process.exit(0);
  }

  // 2. Resolve brand and model names
  const allBrands   = await db.select().from(brandsTable);
  const allModels   = await db.select().from(deviceModelsTable);
  const allCategories = await db.select().from(categoriesTable);

  const brandMap = new Map(allBrands.map(b => [b.id, b]));
  const modelMap = new Map(allModels.map(m => [m.id, m]));
  const categoryMap = new Map(allCategories.map(c => [c.name, c.id]));

  // 3. Pull all existing products (slug + title)
  const existingProducts = await db.select({ slug: productsTable.slug, title: productsTable.title }).from(productsTable);
  const existingSlugs  = existingProducts.map(p => p.slug);
  const existingTitles = existingProducts.map(p => p.title);

  // 4. Pull average selling prices per model from inventory
  const priceRows = await db
    .select({
      modelId: inventoryItemsTable.modelId,
      avgPrice: sql<string>`ROUND(AVG(${inventoryItemsTable.sellingPrice}::numeric), 0)`,
      maxPrice: sql<string>`MAX(${inventoryItemsTable.sellingPrice}::numeric)`,
      minPrice: sql<string>`MIN(${inventoryItemsTable.sellingPrice}::numeric)`,
      totalQty: sql<number>`COUNT(*)::int`,
    })
    .from(inventoryItemsTable)
    .groupBy(inventoryItemsTable.modelId);

  const priceMap = new Map(priceRows.map(r => [r.modelId, r]));

  // 5. Find missing combos
  type MissingItem = {
    brandId: number;
    modelId: number;
    brandName: string;
    modelName: string;
    avgPrice: string;
    totalQty: number;
  };

  const missing: MissingItem[] = [];

  for (const combo of inventoryCombos) {
    const brand = brandMap.get(combo.brandId);
    const model = modelMap.get(combo.modelId);
    if (!brand || !model) continue;

    const alreadyDone = isAlreadyCatalogued(existingSlugs, existingTitles, brand.name, model.name);
    if (!alreadyDone) {
      const priceInfo = priceMap.get(combo.modelId);
      missing.push({
        brandId:   combo.brandId,
        modelId:   combo.modelId,
        brandName: brand.name,
        modelName: model.name,
        avgPrice:  priceInfo?.avgPrice ?? "0",
        totalQty:  priceInfo?.totalQty ?? 0,
      });
    }
  }

  console.log(`✅ Already catalogued: ${inventoryCombos.length - missing.length} combos`);
  console.log(`❌ Missing from catalog: ${missing.length} combos\n`);

  if (missing.length === 0) {
    console.log("All inventory items already have catalog entries. Nothing to do! 🎉");
    process.exit(0);
  }

  console.log("Missing items:");
  missing.forEach(m => console.log(`  • ${m.brandName} — ${m.modelName}  (${m.totalQty} units in inventory, avg Rs ${m.avgPrice})`));
  console.log();

  // 6. Create catalog entries for missing items
  let created = 0;
  let failed  = 0;

  for (const item of missing) {
    console.log(`\n─── Processing: ${item.brandName} ${item.modelName} ─────────────────`);

    // Determine category
    const catNameCandidates = inferCategoryNames(item.brandName, item.modelName);
    let categoryId: number | null = null;
    let resolvedCatName = catNameCandidates[0];

    for (const catName of catNameCandidates) {
      const cid = categoryMap.get(catName);
      if (cid !== undefined) {
        categoryId = cid;
        resolvedCatName = catName;
        break;
      }
    }

    // If category still not found, create it
    if (categoryId === null) {
      const [newCat] = await db.insert(categoriesTable).values({ name: resolvedCatName, active: true }).returning();
      categoryId = newCat.id;
      categoryMap.set(resolvedCatName, categoryId);
      allCategories.push(newCat);
      console.log(`  + Created new category: ${resolvedCatName}`);
    }

    console.log(`  Category: ${resolvedCatName}`);

    // Generate selling price (use avg from inventory, or sensible default)
    const sellingPrice = parseFloat(item.avgPrice) || 5000;
    const priceStr     = sellingPrice.toFixed(0);
    // Sale price: 10% off if >0
    const salePrice    = sellingPrice > 0 ? (sellingPrice * 0.95).toFixed(0) : null;

    // Generate AI content
    console.log(`  Generating AI content...`);
    const ai = await generateContent(item.brandName, item.modelName, priceStr, resolvedCatName);

    // Fallback title/descriptions if AI fails
    const fallbackTitle = `${item.brandName} ${item.modelName}`;
    const fallbackShort = `${item.brandName} ${item.modelName} — professional security equipment. Available at Geem.pk Pakistan.`;
    const fallbackLong  = `${item.brandName} ${item.modelName} is a professional-grade security and surveillance device available exclusively at Geem.pk Pakistan.

This product is stocked and sold by Geem — Pakistan's trusted specialist in GPS trackers, surveillance cameras, security equipment, and covert monitoring devices.

Order online with confidence: 100% genuine product, full warranty, discreet nationwide delivery to Karachi, Lahore, Islamabad, and all major cities. Contact Geem.pk for expert guidance and the best price in Pakistan.`;

    const title      = ai?.title            ?? fallbackTitle;
    const shortDesc  = ai?.shortDescription ?? fallbackShort;
    const longDesc   = ai?.longDescription  ?? fallbackLong;
    const tags       = ai?.tags             ?? `${item.brandName.toLowerCase()},${item.modelName.toLowerCase()},gps tracker pakistan,security equipment pakistan,geem.pk`;
    const metaTitle  = ai?.metaTitle        ?? `${fallbackTitle} Price in Pakistan | Geem.pk`;
    const metaDesc   = ai?.metaDescription  ?? `Buy ${fallbackTitle} in Pakistan. Genuine product, warranty, fast delivery. Geem.pk`;
    const metaKw     = ai?.metaKeywords     ?? `${item.modelName.toLowerCase()} price in pakistan,buy ${item.modelName.toLowerCase()} pakistan,${item.brandName.toLowerCase()} pakistan,geem.pk`;

    // Build slug (ensure uniqueness)
    let slug = slugify(`${item.brandName}-${item.modelName}`);
    // Guard against duplicate slugs
    let slugSuffix = 0;
    while (existingSlugs.includes(slug)) {
      slugSuffix++;
      slug = slugify(`${item.brandName}-${item.modelName}-${slugSuffix}`);
    }
    existingSlugs.push(slug); // claim it

    // Images
    const imgs = defaultImage(resolvedCatName, item.modelName);

    const sku = `${item.brandName.slice(0, 4).toUpperCase()}-${item.modelName.replace(/\s+/g, "").toUpperCase().slice(0, 8)}`;

    // Calculate stock qty from inventory (count in_stock items for this model)
    const stockRows = await db
      .select({ qty: sql<number>`COUNT(*)::int` })
      .from(inventoryItemsTable)
      .where(and(
        eq(inventoryItemsTable.modelId, item.modelId),
        eq(inventoryItemsTable.status, "in_stock"),
      ));
    const stockQty = stockRows[0]?.qty ?? 0;

    try {
      await db.insert(productsTable).values({
        title,
        slug,
        sku,
        brandId:          item.brandId,
        categoryId,
        tags,
        price:            priceStr,
        salePrice,
        stockQty,
        shortDescription: shortDesc,
        longDescription:  longDesc,
        featuredImage:    imgs.featured,
        galleryImages:    JSON.stringify(imgs.gallery),
        published:        true,
        featured:         false,
        metaTitle,
        metaDescription:  metaDesc,
        metaKeywords:     metaKw,
      });

      console.log(`  ✅ Created: "${title}" (slug: ${slug}, stock: ${stockQty})`);
      created++;
    } catch (err: any) {
      if (err?.message?.includes("unique") || err?.message?.includes("duplicate")) {
        console.log(`  ⏭  Skipped (slug already exists): ${slug}`);
      } else {
        console.error(`  ✗  Failed to insert ${slug}:`, err?.message);
        failed++;
      }
    }

    // Small delay to avoid OpenAI rate limits
    await new Promise(r => setTimeout(r, 800));
  }

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log(` Done! Created: ${created}  Failed: ${failed}  Already had: ${inventoryCombos.length - missing.length}`);
  console.log("═══════════════════════════════════════════════════════════════");
  process.exit(0);
}

run().catch(err => {
  console.error("Script failed:", err);
  process.exit(1);
});
