/**
 * refresh-yuntrack-images.ts
 *
 * Phase 1 — DELETE existing Yuntrack images:
 *   • Deletes main + all gallery WebP files from disk
 *   • Clears featuredImage and galleryImages in the DB for all Yuntrack products
 *
 * Phase 2 — FETCH fresh authentic images:
 *   • For each Yuntrack product, searches for model-specific product images
 *   • Downloads 1 main + 4 gallery images, converts to WebP via sharp
 *   • Updates DB with new local paths
 *
 * Run ON the VPS:
 *   pnpm --filter @workspace/scripts run refresh-yuntrack-images
 */

import { db, productsTable, brandsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import sharp from "sharp";
import * as fs from "fs";
import * as path from "path";
import * as https from "https";
import * as http from "http";

// ── Config ────────────────────────────────────────────────────────────────────

const UPLOADS_ROOT = process.env.UPLOADS_DIR ?? "/var/www/geem/uploads";
const PRODUCTS_DIR = path.join(UPLOADS_ROOT, "public", "products");
const GALLERY_DIR  = path.join(PRODUCTS_DIR, "gallery");

// ── Image helpers (same pattern as batch-complete) ────────────────────────────

function fetchBuf(url: string, maxRedirects = 5): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith("https") ? https : http;
    proto.get(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; GeemBot/1.0)" } }, res => {
      if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location && maxRedirects > 0) {
        resolve(fetchBuf(res.headers.location, maxRedirects - 1));
        return;
      }
      if (res.statusCode !== 200) { reject(new Error(`HTTP ${res.statusCode}`)); return; }
      const chunks: Buffer[] = [];
      res.on("data", c => chunks.push(c));
      res.on("end",  () => resolve(Buffer.concat(chunks)));
      res.on("error", reject);
    }).on("error", reject);
  });
}

async function downloadWebP(url: string, outPath: string): Promise<boolean> {
  try {
    const buf = await fetchBuf(url);
    if (buf.length < 5000) return false;  // skip tiny/broken images
    await sharp(buf).resize({ width: 800, height: 800, fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toFile(outPath);
    return true;
  } catch {
    return false;
  }
}

/** Returns candidate image URLs for a Yuntrack model using DuckDuckGo image search */
async function searchImages(query: string): Promise<string[]> {
  const encoded = encodeURIComponent(query);
  const searchUrl = `https://duckduckgo.com/?q=${encoded}&iax=images&ia=images&t=h_`;
  try {
    const buf = await fetchBuf(searchUrl);
    const html = buf.toString("utf-8");
    // Extract vqd token for the API call
    const vqdMatch = html.match(/vqd=([^&"]+)/);
    if (!vqdMatch) return [];
    const vqd = vqdMatch[1];
    const apiUrl = `https://duckduckgo.com/i.js?q=${encoded}&o=json&vqd=${vqd}&f=,,,,,&p=1`;
    const apiBuf = await fetchBuf(apiUrl);
    const json = JSON.parse(apiBuf.toString("utf-8"));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (json.results ?? []).slice(0, 10).map((r: any) => r.image as string).filter(Boolean);
  } catch {
    return [];
  }
}

/** Download one image from a list of candidates. Returns the local path or null. */
async function downloadFirst(candidates: string[], outPath: string): Promise<string | null> {
  for (const url of candidates) {
    const ok = await downloadWebP(url, outPath);
    if (ok) return outPath;
  }
  return null;
}

// ── Delete helpers ────────────────────────────────────────────────────────────

function deleteIfExists(filePath: string) {
  try {
    if (fs.existsSync(filePath)) { fs.unlinkSync(filePath); return true; }
  } catch { /* ignore */ }
  return false;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function run() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(" Geem — Refresh Yuntrack Images");
  console.log("═══════════════════════════════════════════════════════════════\n");

  fs.mkdirSync(PRODUCTS_DIR, { recursive: true });
  fs.mkdirSync(GALLERY_DIR,  { recursive: true });

  // ── Load all Yuntrack products ────────────────────────────────────────────
  const yuntrackRows = await db
    .select({
      id:            productsTable.id,
      title:         productsTable.title,
      slug:          productsTable.slug,
      featuredImage: productsTable.featuredImage,
      galleryImages: productsTable.galleryImages,
    })
    .from(productsTable)
    .leftJoin(brandsTable, eq(productsTable.brandId, brandsTable.id))
    .where(eq(brandsTable.name, "Yuntrack"));

  console.log(`Found ${yuntrackRows.length} Yuntrack products.\n`);

  // ── Phase 1: Delete existing images ──────────────────────────────────────
  console.log("── Phase 1: Deleting existing Yuntrack images ──────────────────");
  let deletedFiles = 0;

  for (const row of yuntrackRows) {
    // Delete main image
    if (row.featuredImage) {
      const fileName = path.basename(row.featuredImage);
      const filePath = path.join(PRODUCTS_DIR, fileName);
      if (deleteIfExists(filePath)) { console.log(`  🗑  Deleted main: ${fileName}`); deletedFiles++; }
    }

    // Delete gallery images
    if (row.galleryImages) {
      let gallery: string[] = [];
      try { gallery = JSON.parse(row.galleryImages); } catch { gallery = []; }
      for (const imgPath of gallery) {
        const fileName = path.basename(imgPath);
        const filePath = path.join(GALLERY_DIR, fileName);
        if (deleteIfExists(filePath)) { deletedFiles++; }
      }
    }

    // Clear DB records
    await db.update(productsTable)
      .set({ featuredImage: null, galleryImages: null })
      .where(eq(productsTable.id, row.id));
  }

  console.log(`  → Deleted ${deletedFiles} image files. DB cleared.\n`);

  // ── Phase 2: Download fresh images ───────────────────────────────────────
  console.log("── Phase 2: Downloading fresh Yuntrack images ─────────────────");

  let succeeded = 0, failed = 0;

  for (let i = 0; i < yuntrackRows.length; i++) {
    const row = yuntrackRows[i];
    console.log(`\n[${i + 1}/${yuntrackRows.length}] ${row.title}`);

    // Build search queries (specific → broad)
    const queries = [
      `${row.title} GPS tracker product photo`,
      `${row.slug.replace(/-/g, " ")} GPS tracker`,
      `Yuntrack ${row.slug.split("-").slice(1, 3).join(" ")} tracker`,
    ];

    // ── Main image ──────────────────────────────────────────────────────────
    const mainPath = path.join(PRODUCTS_DIR, `${row.slug}-main.webp`);
    let mainOk = false;

    for (const q of queries) {
      const candidates = await searchImages(q);
      const result = await downloadFirst(candidates, mainPath);
      if (result) {
        console.log(`  📸 main → ${path.basename(mainPath)}`);
        mainOk = true;
        break;
      }
    }
    if (!mainOk) console.log(`  ⚠  main image not found`);

    // ── Gallery images ──────────────────────────────────────────────────────
    const galleryPaths: string[] = [];
    const candidates = await searchImages(queries[0]);

    for (let g = 1; g <= 4; g++) {
      const gPath = path.join(GALLERY_DIR, `${row.slug}-gallery-${g}.webp`);
      // Offset into the candidates list to get different images
      const subset = candidates.slice(g);
      const ok = await downloadFirst(subset, gPath);
      if (ok) {
        console.log(`  📸 gallery ${g} → ${path.basename(gPath)}`);
        galleryPaths.push(`/api/storage/public-objects/products/gallery/${path.basename(gPath)}`);
      }
    }

    // ── Update DB ───────────────────────────────────────────────────────────
    await db.update(productsTable).set({
      featuredImage: mainOk
        ? `/api/storage/public-objects/products/${path.basename(mainPath)}`
        : null,
      galleryImages: galleryPaths.length ? JSON.stringify(galleryPaths) : null,
    }).where(eq(productsTable.id, row.id));

    if (mainOk || galleryPaths.length > 0) {
      console.log(`  ✅ Updated DB`);
      succeeded++;
    } else {
      console.log(`  ✗  No images found — DB left with null (batch-complete will retry)`);
      failed++;
    }
  }

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log(` Done!`);
  console.log(`   Phase 1 — Files deleted : ${deletedFiles}`);
  console.log(`   Phase 2 — Succeeded     : ${succeeded}`);
  console.log(`   Phase 2 — Failed        : ${failed}`);
  if (failed > 0) {
    console.log("\n   Products with no images will be picked up by batch-complete.");
    console.log("   Run:  pnpm --filter @workspace/scripts run batch-complete");
  }
  console.log("═══════════════════════════════════════════════════════════════");
  process.exit(0);
}

run().catch(err => { console.error("Script failed:", err); process.exit(1); });
