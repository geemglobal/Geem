/**
 * standardize-titles.ts  (v3 — idempotent, model-code-aware)
 *
 * Builds a clean title from scratch for every product:
 *   {BrandName} {MODEL_CODE} {Category Descriptor}
 *
 * Rules:
 *   1. Brand name is taken EXACTLY from the brands table (preserves "LawMate", "SinoTrack")
 *   2. Model code is extracted from the current title by stripping the brand and
 *      ALL known descriptor words/phrases (including ones from previous runs)
 *   3. Words that contain a digit in the model portion are uppercased in full
 *      (e.g. "cj780" → "CJ780", "gt06" → "GT06", "pv-500eco2" → "PV-500ECO2")
 *   4. One clean category descriptor is appended (never doubled)
 *   5. New slug is regenerated and made unique
 *
 * Idempotent — running twice produces the same result.
 * Run ON the VPS:
 *   pnpm --filter @workspace/scripts run standardize-titles
 */

import { db, productsTable, brandsTable, categoriesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

// ── Helpers ──────────────────────────────────────────────────────────────────

function escapeRe(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

/**
 * Extract the clean model string from a raw title.
 * Aggressively strips: brand name, all descriptor phrases (in any order),
 * boilerplate words, and leaves only the core model identifier.
 */
function extractModel(rawTitle: string, brandName: string): string {
  let m = rawTitle;

  // 1. Strip brand name (case-insensitive, word-boundary)
  m = m.replace(new RegExp("\\b" + escapeRe(brandName) + "\\b", "gi"), "");

  // 2. Strip all known descriptor phrases (longest first to avoid partial matches)
  const PHRASES = [
    "Vehicle GPS Tracker",
    "OBD GPS Tracker",
    "Personal GPS Tracker",
    "Motorcycle GPS Tracker",
    "Kids GPS Smartwatch",
    "GPS Smartwatch",
    "Spy Camera",
    "Counter-Surveillance Device",
    "RF Signal Detector",
    "Security Device",
    "Covert Audio Recorder",
    "GPS Tracker",
    "Tracking Device",
    "Tracker Device",
    "GPS Tracking",
  ];
  for (const phrase of PHRASES) {
    m = m.replace(new RegExp(escapeRe(phrase), "gi"), " ");
  }

  // 3. Strip standalone descriptor words that we've been inadvertently adding
  const DESCRIPTOR_WORDS = [
    "Vehicle", "Personal", "Motorcycle", "Real-time", "Realtime",
    "Pakistan", "Price", "Geem\\.pk", "Smartwatch",
  ];
  for (const w of DESCRIPTOR_WORDS) {
    m = m.replace(new RegExp("\\b" + w + "\\b", "gi"), " ");
  }

  // 4. Normalise whitespace
  return m.replace(/\s{2,}/g, " ").trim();
}

/**
 * Uppercase the model string intelligently:
 *   - Words that contain a digit → fully uppercase (model codes: CJ780, GT06, PV-500ECO2)
 *   - Multi-letter all-caps chunks already correct → keep
 *   - Pure lowercase plain words → Title Case
 */
function caseModel(modelStr: string): string {
  // Split on spaces, handle hyphenated tokens as a unit
  return modelStr
    .split(/\s+/)
    .map(word => {
      // Word contains a digit → it's a model code, uppercase fully
      if (/\d/.test(word)) return word.toUpperCase();
      // Already has 2+ consecutive uppercase letters → likely a code (PCB, GSM, etc.)
      if (/[A-Z]{2}/.test(word)) return word;
      // Mixed case (e.g. "mAh") → keep as-is
      if (/[A-Z]/.test(word) && /[a-z]/.test(word)) return word;
      // Plain lowercase word → title case
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

/** Map category name → short professional descriptor (never blank for GPS) */
function descriptor(catName: string): string {
  const lc = catName.toLowerCase();
  if (lc.includes("obd"))                                        return "OBD GPS Tracker";
  if (lc.includes("kids") || lc.includes("watch"))              return "Kids GPS Smartwatch";
  if (lc.includes("motorcycle") || lc.includes("bike"))         return "Motorcycle GPS Tracker";
  if (lc.includes("personal gps"))                              return "Personal GPS Tracker";
  if (lc.includes("vehicle gps") || lc.includes("telematics")) return "Vehicle GPS Tracker";
  if (lc.includes("gps tracking"))                              return "GPS Tracker";
  if (lc.includes("spy") || lc.includes("surveillance"))        return "Spy Camera";
  if (lc.includes("counter"))                                   return "Counter-Surveillance Device";
  if (lc.includes("rf") || lc.includes("signal") || lc.includes("detector")) return "RF Signal Detector";
  if (lc.includes("security equipment"))                        return "Security Device";
  if (lc.includes("carbon fiber") || lc.includes("industrial composite")) return "";
  if (lc.includes("battery"))                                   return "";
  if (lc.includes("smartphone") || lc.includes("mobile"))      return "";
  if (lc.includes("covert"))                                    return "Covert Audio Recorder";
  if (lc.includes("gps"))                                       return "GPS Tracker";
  return "";
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function run() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(" Geem — Title Standardisation v3 (clean model code casing)");
  console.log("═══════════════════════════════════════════════════════════════\n");

  const rows = await db
    .select({
      id:        productsTable.id,
      title:     productsTable.title,
      slug:      productsTable.slug,
      brandName: brandsTable.name,
      catName:   categoriesTable.name,
    })
    .from(productsTable)
    .leftJoin(brandsTable,     eq(productsTable.brandId,    brandsTable.id))
    .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id));

  console.log(`Loaded ${rows.length} products.\n`);

  const existingSlugs = new Set(rows.map(r => r.slug));
  let updated = 0, skipped = 0;

  for (const row of rows) {
    const brand = row.brandName ?? "";
    const cat   = row.catName   ?? "";

    // Extract raw model from whatever the current title is
    const rawModel  = extractModel(row.title, brand);
    const casedModel = rawModel ? caseModel(rawModel) : "";
    const desc       = descriptor(cat);

    // Build final title
    const parts: string[] = [];
    if (brand)       parts.push(brand);        // exact from DB
    if (casedModel)  parts.push(casedModel);   // smart-cased model code
    if (desc)        parts.push(desc);         // one clean descriptor

    const newTitle = parts.join(" ").replace(/\s{2,}/g, " ").trim();
    if (!newTitle) { skipped++; continue; }

    // Unique slug
    let newSlug = slugify(newTitle);
    if (newSlug !== row.slug && existingSlugs.has(newSlug)) {
      let n = 1;
      while (existingSlugs.has(`${newSlug}-${n}`)) n++;
      newSlug = `${newSlug}-${n}`;
    }

    if (newTitle === row.title && newSlug === row.slug) { skipped++; continue; }

    const newMetaTitle = `${newTitle} Price in Pakistan | Geem.pk`.slice(0, 65);

    existingSlugs.delete(row.slug);
    existingSlugs.add(newSlug);

    await db.update(productsTable)
      .set({ title: newTitle, slug: newSlug, metaTitle: newMetaTitle })
      .where(eq(productsTable.id, row.id));

    console.log(`  ✏  [${row.id}] "${row.title}"\n       → "${newTitle}"`);
    updated++;
  }

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log(` Done! Updated: ${updated}  |  Already correct: ${skipped}`);
  console.log("═══════════════════════════════════════════════════════════════");
  process.exit(0);
}

run().catch(err => { console.error("Script failed:", err); process.exit(1); });
