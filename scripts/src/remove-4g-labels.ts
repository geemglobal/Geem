/**
 * remove-4g-labels.ts
 *
 * Scrubs "4G", "4G LTE", "4G Network", "4G LTE Network" from:
 *   title, shortDescription, longDescription, metaTitle, metaDescription, tags
 * …for ALL GPS tracker products EXCEPT Wanway brand.
 *
 * Wanway products are UPDATED to ensure "4G" appears in their title.
 *
 * Run ON the VPS:
 *   pnpm --filter @workspace/scripts run remove-4g
 */

import { db, productsTable, brandsTable, categoriesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

// ── Regex patterns (order: most specific first) ───────────────────────────────

const PATTERNS_4G = [
  /\b4G LTE Network\b/gi,
  /\b4G LTE\b/gi,
  /\b4G Network\b/gi,
  /\b4G\b/gi,
];

function strip4G(text: string | null): string | null {
  if (!text) return text;
  let out = text;
  for (const re of PATTERNS_4G) {
    out = out.replace(re, "");
  }
  // Clean up artefacts: double spaces, trailing/leading commas, punctuation
  out = out
    .replace(/,\s*,/g, ",")
    .replace(/^\s*,\s*/g, "")
    .replace(/\s*,\s*$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return out;
}

function has4G(text: string | null): boolean {
  if (!text) return false;
  return /\b4G\b/i.test(text);
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function run() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(" Geem — Remove 4G Labels (non-Wanway GPS trackers)");
  console.log("═══════════════════════════════════════════════════════════════\n");

  // Load all GPS tracker products with brand and category info
  const rows = await db
    .select({
      id:              productsTable.id,
      title:           productsTable.title,
      shortDesc:       productsTable.shortDescription,
      longDesc:        productsTable.longDescription,
      metaTitle:       productsTable.metaTitle,
      metaDesc:        productsTable.metaDescription,
      tags:            productsTable.tags,
      brandName:       brandsTable.name,
      catName:         categoriesTable.name,
    })
    .from(productsTable)
    .leftJoin(brandsTable,     eq(productsTable.brandId,    brandsTable.id))
    .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id));

  // GPS categories filter (we only touch GPS product records)
  const GPS_CATS = new Set([
    "vehicle gps trackers", "obd gps trackers", "personal gps trackers",
    "kids gps watches", "motorcycle gps trackers", "gps tracking & telematics",
    "gps trackers", "gps trackers - personal",
  ]);

  const gpsRows = rows.filter(r => {
    const cat = (r.catName ?? "").toLowerCase();
    return GPS_CATS.has(cat) || cat.includes("gps") || cat.includes("tracker");
  });

  console.log(`Total products: ${rows.length}`);
  console.log(`GPS tracker products: ${gpsRows.length}\n`);

  let scrubbed = 0, wanwayFixed = 0, skipped = 0;

  for (const row of gpsRows) {
    const brand = (row.brandName ?? "").toLowerCase();
    const isWanway = brand === "wanway";

    if (isWanway) {
      // ── Wanway: ensure "4G" is in the title ───────────────────────────────
      if (!has4G(row.title)) {
        // Insert "4G" before "GPS Tracker" or at end of title
        const newTitle = row.title.replace(/GPS Tracker/i, "4G GPS Tracker");
        const finalTitle = newTitle === row.title
          ? `${row.title} 4G`
          : newTitle;
        const newMetaTitle = `${finalTitle} Price in Pakistan | Geem.pk`.slice(0, 65);
        await db.update(productsTable)
          .set({ title: finalTitle, metaTitle: newMetaTitle })
          .where(eq(productsTable.id, row.id));
        console.log(`  ✅ Wanway 4G added: "${finalTitle}"`);
        wanwayFixed++;
      } else {
        skipped++;
      }
      continue;
    }

    // ── Non-Wanway: strip all 4G mentions ────────────────────────────────────
    const newTitle    = strip4G(row.title);
    const newShort    = strip4G(row.shortDesc);
    const newMeta     = strip4G(row.metaTitle);
    const newMetaDesc = strip4G(row.metaDesc);

    // Tags: split CSV, filter, rejoin
    let newTags = row.tags;
    if (row.tags) {
      const tagArr = row.tags.split(",").map(t => t.trim());
      const filtered = tagArr.filter(t => !/^4g/i.test(t));
      newTags = filtered.join(", ");
    }

    // Long description: strip inline 4G references but keep the text
    const newLong = strip4G(row.longDesc);

    // Check if anything actually changed
    const changed = newTitle !== row.title || newShort !== row.shortDesc ||
      newLong !== row.longDesc || newMeta !== row.metaTitle ||
      newMetaDesc !== row.metaDesc || newTags !== row.tags;

    if (!changed) { skipped++; continue; }

    await db.update(productsTable).set({
      title:            newTitle,
      shortDescription: newShort,
      longDescription:  newLong,
      metaTitle:        newMeta,
      metaDescription:  newMetaDesc,
      tags:             newTags,
    }).where(eq(productsTable.id, row.id));

    console.log(`  🗑  Scrubbed 4G: "${row.title}" → "${newTitle}"`);
    scrubbed++;
  }

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log(` Done!`);
  console.log(`   Non-Wanway 4G scrubbed : ${scrubbed}`);
  console.log(`   Wanway 4G ensured      : ${wanwayFixed}`);
  console.log(`   No change (skipped)    : ${skipped}`);
  console.log("═══════════════════════════════════════════════════════════════");
  process.exit(0);
}

run().catch(err => { console.error("Script failed:", err); process.exit(1); });
