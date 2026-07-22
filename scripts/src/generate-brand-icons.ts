/**
 * generate-brand-icons.ts
 *
 * Generates all PNG icon variants from the master SVG favicon:
 *   icon-192.png, icon-512.png, icon-512-maskable.png, apple-touch-icon.png
 *
 * Also creates favicon.ico (48×48 embedded PNG).
 *
 * Run LOCALLY (in Replit) or on the VPS before building:
 *   pnpm --filter @workspace/scripts run generate-icons
 */

import sharp from "sharp";
import * as fs from "fs";
import * as path from "path";

const PUBLIC_DIR = path.resolve(import.meta.dirname, "../../artifacts/geem/public");

// Inline SVG matching geem-project/artifacts/geem/public/favicon.svg
// (embedded so the script works without a local file-read on VPS)
const GICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <rect width="64" height="64" rx="14" fill="#dc2626"/>
  <text
    x="32" y="46"
    font-family="'Georgia', 'Times New Roman', serif"
    font-size="42"
    font-weight="700"
    fill="#ffffff"
    text-anchor="middle"
    letter-spacing="-1">G</text>
</svg>`;

/** SVG with safe padded background for maskable icon (safe area = 80% circle) */
const MASKABLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" fill="#dc2626"/>
  <rect x="80" y="80" width="352" height="352" rx="60" fill="#b91c1c"/>
  <text
    x="256" y="330"
    font-family="'Georgia', 'Times New Roman', serif"
    font-size="240"
    font-weight="700"
    fill="#ffffff"
    text-anchor="middle"
    letter-spacing="-4">G</text>
</svg>`;

async function generate() {
  console.log("Generating brand icons...\n");

  const svgBuf = Buffer.from(GICON_SVG);
  const maskBuf = Buffer.from(MASKABLE_SVG);

  const icons: Array<{ size: number; name: string; src?: Buffer }> = [
    { size: 192, name: "icon-192.png" },
    { size: 512, name: "icon-512.png" },
    { size: 180, name: "apple-touch-icon.png" },
  ];

  for (const icon of icons) {
    const outPath = path.join(PUBLIC_DIR, icon.name);
    await sharp(icon.src ?? svgBuf)
      .resize(icon.size, icon.size)
      .png({ quality: 90, compressionLevel: 9 })
      .toFile(outPath);
    console.log(`  ✅ ${icon.name} (${icon.size}×${icon.size})`);
  }

  // Maskable icon (full-bleed red background, G centred in safe area)
  const maskPath = path.join(PUBLIC_DIR, "icon-512-maskable.png");
  await sharp(maskBuf)
    .resize(512, 512)
    .png({ quality: 90, compressionLevel: 9 })
    .toFile(maskPath);
  console.log(`  ✅ icon-512-maskable.png (512×512 maskable)`);

  // favicon.ico — embed as 48×48 PNG inside ICO wrapper
  // We write a 48×48 PNG and rename it .ico (browsers accept PNG-in-ICO fine)
  const icoPath = path.join(PUBLIC_DIR, "favicon.ico");
  await sharp(svgBuf)
    .resize(48, 48)
    .png()
    .toFile(icoPath);
  console.log(`  ✅ favicon.ico (48×48)`);

  // opengraph.jpg — 1200×630 social share card
  const ogSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%"   stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect x="80" y="200" width="120" height="120" rx="28" fill="#dc2626"/>
  <text x="140" y="284" font-family="Georgia,serif" font-size="80" font-weight="700" fill="#fff" text-anchor="middle">G</text>
  <text x="222" y="282" font-family="Helvetica,Arial,sans-serif" font-size="80" font-weight="800" fill="#fff" letter-spacing="-2">eem</text>
  <text x="80" y="362" font-family="Helvetica,Arial,sans-serif" font-size="28" fill="#9ca3af">Pakistan's Specialist Security &amp; Surveillance Equipment Supplier</text>
  <rect x="80" y="388" width="80" height="4" rx="2" fill="#dc2626"/>
</svg>`;

  const ogPath = path.join(PUBLIC_DIR, "opengraph.jpg");
  await sharp(Buffer.from(ogSvg))
    .resize(1200, 630)
    .jpeg({ quality: 90 })
    .toFile(ogPath);
  console.log(`  ✅ opengraph.jpg (1200×630 social card)`);

  console.log("\nAll brand icons generated successfully.");
}

generate().catch(err => { console.error("Failed:", err); process.exit(1); });
