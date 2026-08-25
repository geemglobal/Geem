import { Router, type IRouter } from "express";
import OpenAI from "openai";
import sharp from "sharp";
import { db, brandsTable, categoriesTable, integrationSettingsTable, productsTable } from "@workspace/db";
import { eq, ilike } from "drizzle-orm";
import * as fs from "fs";
import * as path from "path";

const router: IRouter = Router();

const AI_MASK = "••••••••";

async function getOpenAI(): Promise<{ client: OpenAI; model: string }> {
  // 1. DB-stored AI integration (admin Settings → Integrations → AI Text Generation)
  try {
    const [row] = await db.select().from(integrationSettingsTable).where(eq(integrationSettingsTable.type, "ai"));
    if (row?.enabled) {
      const cfg = JSON.parse(row.config) as { provider?: string; apiKey?: string; model?: string };
      if (cfg.apiKey && cfg.apiKey !== AI_MASK) {
        const baseURL =
          cfg.provider === "gemini"     ? "https://generativelanguage.googleapis.com/v1beta/openai/" :
          cfg.provider === "openrouter" ? "https://openrouter.ai/api/v1" :
          undefined; // OpenAI default (api.openai.com)
        const model = cfg.model || (cfg.provider === "gemini" ? "gemini-2.0-flash-lite" : "gpt-4o-mini");
        return { client: new OpenAI({ baseURL, apiKey: cfg.apiKey }), model };
      }
    }
  } catch { /* fall through */ }

  // 2. OPENAI_API_KEY env var
  if (process.env.OPENAI_API_KEY) {
    return { client: new OpenAI({ apiKey: process.env.OPENAI_API_KEY }), model: "gpt-4o-mini" };
  }

  // 3. Replit AI integration proxy (dev only)
  return {
    client: new OpenAI({
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY ?? "dummy",
    }),
    model: "gpt-4o-mini",
  };
}

function getUploadsDir(): string {
  return process.env.UPLOADS_DIR || path.join(process.cwd(), "uploads");
}

// ── Auto-categorization ──────────────────────────────────────────────────────

type CategoryMatch = {
  parentName: string;
  childName: string;
  brandName?: string;
  hidePrice?: boolean;
};

function detectCategory(title: string): CategoryMatch | null {
  const t = title.toUpperCase();
  const trimmed = title.trim();

  // LawMate detection
  if (
    t.includes("LAWMATE") ||
    /^(PV-|BU-|CM-|CMD-|ER-|NT-|RD-|AR-)/i.test(trimmed)
  ) {
    return {
      parentName: "Covert Surveillance & Audio Gear",
      childName: "LawMate Surveillance Products",
      brandName: "LawMate",
    };
  }

  // Esonic / MemoQ detection
  if (
    t.includes("ESONIC") ||
    t.includes("MEMOQ") ||
    /^(MQ-|MR-|PCM-|BR|CAM-)/i.test(trimmed)
  ) {
    return {
      parentName: "Covert Surveillance & Audio Gear",
      childName: "Esonic Audio Recorders & Bugging Devices",
      brandName: "Esonic",
    };
  }

  // Carbon Fiber detection
  if (
    t.includes("TORAY") ||
    t.includes("CARBON FIBER") ||
    t.includes("CARBON FIBRE") ||
    t.includes("SPOOL") ||
    (t.includes("UD") && t.includes("FABRIC")) ||
    (t.includes("FABRIC") && t.includes("GSM"))
  ) {
    return {
      parentName: "Industrial Composite Materials",
      childName: "Carbon Fiber Spools & Fabrics",
    };
  }

  // Huntsman / Araldite detection
  if (
    t.includes("HUNTSMAN") ||
    t.includes("ARALDITE") ||
    t.includes("ARADUR") ||
    /\b(5052|1564|3585|8615|3031|3508|3474|3475|3032|3478)\b/.test(title) ||
    / LY /.test(title)
  ) {
    return {
      parentName: "Industrial Composite Materials",
      childName: "Huntsman Araldite Epoxy Resin Systems",
      brandName: "Huntsman",
    };
  }

  // Custom Battery detection (subcategory routing)
  if (
    t.includes("BATTERY") ||
    t.includes("LITHIUM") ||
    t.includes("NCM") ||
    t.includes("CYLINDRICAL CELL") ||
    t.includes("CHARGER MATCHING") ||
    t.includes("TURNKEY INDUSTRIAL")
  ) {
    if (t.includes("MARINE") || t.includes("SUBSEA") || t.includes("WATERTIGHT")) {
      return {
        parentName: "Custom Battery Design & Manufacturing Services",
        childName: "Marine & Subsea Power Systems",
        hidePrice: true,
      };
    }
    if (t.includes("BMS") || t.includes("SMART BMS") || t.includes("COMMUNICATIONS")) {
      return {
        parentName: "Custom Battery Design & Manufacturing Services",
        childName: "Smart BMS & Communications",
        hidePrice: true,
      };
    }
    if (t.includes("HIGH-VOLTAGE") || t.includes("INDUSTRIAL BATTERY") || t.includes("ASSEMBLY")) {
      return {
        parentName: "Custom Battery Design & Manufacturing Services",
        childName: "High-Voltage Industrial Assembly",
        hidePrice: true,
      };
    }
    return {
      parentName: "Custom Battery Design & Manufacturing Services",
      childName: "Custom Battery Packs",
      hidePrice: true,
    };
  }

  // GPS Tracking & Telematics detection
  if (
    t.includes("GPS") ||
    t.includes("TRACKER") ||
    t.includes("SINOTRACK") ||
    t.includes("YUNTRACK") ||
    t.includes("MICODUS") ||
    t.includes("WANWAY") ||
    t.includes("GOOME") ||
    t.includes("TKSTAR") ||
    t.includes("COBAN") ||
    t.includes("GARMIN") ||
    t.includes("365GPS") ||
    t.includes("360GPS") ||
    t.includes("IOT GATEWAY") ||
    t.includes("VEHICLE TRACKER") ||
    t.includes("ASSET TRACKER")
  ) {
    return {
      parentName: "GPS Tracking & Telematics",
      childName: "Vehicle & Asset Trackers",
    };
  }

  return null;
}

async function findOrCreateCategory(
  parentName: string,
  childName: string,
): Promise<{ parentId: number; childId: number }> {
  let [parent] = await db
    .select()
    .from(categoriesTable)
    .where(eq(categoriesTable.name, parentName));
  if (!parent) {
    [parent] = await db
      .insert(categoriesTable)
      .values({ name: parentName, active: true })
      .returning();
  }

  let [child] = await db
    .select()
    .from(categoriesTable)
    .where(eq(categoriesTable.name, childName));
  if (!child) {
    [child] = await db
      .insert(categoriesTable)
      .values({ name: childName, parentId: parent.id, active: true })
      .returning();
  }

  return { parentId: parent.id, childId: child.id };
}

async function findOrCreateBrand(brandName: string): Promise<number | null> {
  if (!brandName) return null;
  let [brand] = await db
    .select()
    .from(brandsTable)
    .where(ilike(brandsTable.name, brandName));
  if (!brand) {
    [brand] = await db
      .insert(brandsTable)
      .values({ name: brandName, active: true })
      .returning();
  }
  return brand.id;
}

// ── Image Search & Download ──────────────────────────────────────────────────

async function searchImagesViaDDG(query: string): Promise<string[]> {
  try {
    // Step 1: get vqd token
    const initRes = await fetch(
      `https://duckduckgo.com/?q=${encodeURIComponent(query)}&iar=images&iax=images&ia=images`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
        signal: AbortSignal.timeout(8000),
      },
    );
    const html = await initRes.text();
    const vqdMatch = html.match(/vqd=['"]([^'"]+)['"]/);
    if (!vqdMatch) return [];
    const vqd = vqdMatch[1];

    // Step 2: get image results
    const imgRes = await fetch(
      `https://duckduckgo.com/i.js?q=${encodeURIComponent(query)}&vqd=${encodeURIComponent(vqd)}&o=json&p=1&f=,,,,,`,
      {
        headers: {
          Referer: "https://duckduckgo.com/",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
        signal: AbortSignal.timeout(8000),
      },
    );
    const json = (await imgRes.json()) as { results?: { image: string }[] };
    return (json.results ?? [])
      .slice(0, 10)
      .map((r) => r.image)
      .filter(Boolean);
  } catch {
    return [];
  }
}

function sanitizeFilePrefix(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 55);
}

/**
 * Download a URL, convert to optimised WebP via sharp, and save to destPath.
 * destPath should already end in .webp.
 */
async function downloadImageAsWebP(url: string, destPath: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return false;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 2000) return false; // skip tiny / broken images
    await sharp(buf)
      .resize({ width: 1200, withoutEnlargement: true }) // cap at 1200px wide
      .webp({ quality: 85 })
      .toFile(destPath);
    return true;
  } catch {
    return false;
  }
}

async function fetchAndSaveProductImages(
  searchQuery: string,
  filePrefix: string,
): Promise<{ main: string | null; gallery: string[] }> {
  const productsDir = path.join(getUploadsDir(), "public", "products");
  const galleryDir  = path.join(productsDir, "gallery");
  fs.mkdirSync(productsDir, { recursive: true });
  fs.mkdirSync(galleryDir,  { recursive: true });

  // Try two queries so we have enough candidate URLs for 5 images (1 main + 4 gallery)
  let imageUrls = await searchImagesViaDDG(searchQuery);
  if (imageUrls.length < 6) {
    const extra = await searchImagesViaDDG(`${searchQuery} product photo`);
    for (const u of extra) if (!imageUrls.includes(u)) imageUrls.push(u);
  }
  if (!imageUrls.length) return { main: null, gallery: [] };

  let main: string | null = null;
  const gallery: string[] = [];

  for (const url of imageUrls) {
    if (main && gallery.length >= 4) break;

    if (!main) {
      // Main / featured image
      const mainFile = `${filePrefix}-main.webp`;
      const mainPath = path.join(productsDir, mainFile);
      if (await downloadImageAsWebP(url, mainPath)) {
        main = `/api/storage/public-objects/products/${mainFile}`;
      }
    } else if (gallery.length < 4) {
      // Gallery images
      const n = gallery.length + 1;
      const galleryFile = `${filePrefix}-gallery-${n}.webp`;
      const galleryPath = path.join(galleryDir, galleryFile);
      if (await downloadImageAsWebP(url, galleryPath)) {
        gallery.push(`/api/storage/public-objects/products/gallery/${galleryFile}`);
      }
    }
  }

  return { main, gallery };
}

// ── Routes ───────────────────────────────────────────────────────────────────

/**
 * POST /products/ai-autogenerate
 * Full automation: auto-categorize → AI text + SEO → image search & download
 * Body: { title: string }
 */
router.post("/products/ai-autogenerate", async (req, res): Promise<void> => {
  const { title } = req.body as { title?: string };
  if (!title?.trim()) {
    res.status(400).json({ error: "title required" });
    return;
  }

  const { client: openai, model: aiModel } = await getOpenAI();

  // 1. Auto-categorize based on brand/model rules
  const catMatch = detectCategory(title);
  let categoryId: number | null = null;
  let brandId: number | null = null;
  const hidePrice = catMatch?.hidePrice ?? false;

  if (catMatch) {
    try {
      const cats = await findOrCreateCategory(catMatch.parentName, catMatch.childName);
      categoryId = cats.childId;
      if (catMatch.brandName) {
        brandId = await findOrCreateBrand(catMatch.brandName);
      }
    } catch (err) {
      req.log.error({ err }, "Category/brand resolution failed");
    }
  }

  // 2. OpenAI: generate full SEO text content
  const categoryContext = catMatch
    ? `${catMatch.parentName} > ${catMatch.childName}`
    : "Auto-detect from product name";

  const prompt = `You are a product data specialist for Geem.pk, a Pakistani e-commerce store specializing in:
- Covert surveillance & audio gear (LawMate hidden cameras/recorders, Esonic / MemoQ voice recorders)
- Industrial composite materials (Toray carbon fiber spools/fabrics, Huntsman Araldite epoxy resin systems)
- Custom battery design & manufacturing services (lithium-ion packs, BMS, marine/subsea systems)

Product: "${title}"
Category: ${categoryContext}
Is Inquiry-Only (no direct price): ${hidePrice}

Return ONLY valid JSON — no markdown fences, no backticks, no extra text:
{
  "title": "Clean, professional product title matching the exact model",
  "slug": "url-friendly-slug-all-lowercase-hyphens-no-special-chars",
  "shortDescription": "2-3 engaging sentences emphasizing utility and quality for Pakistani buyers. Max 220 chars.",
  "longDescription": "Detailed HTML using <h3>, <ul>, <li>, and a <table> for specs. Minimum 300 words. Include exact technical specifications (lens type, resolution, frequency, weave pattern, resin ratio, battery capacity, thermal data etc). Mention PTA approval for surveillance devices where applicable. Use professional product-listing language.",
  "metaTitle": "SEO title max 60 chars — format: [Product Model] - Geem Pakistan",
  "metaDescription": "SEO click-through description max 160 chars using keywords: Pakistan, buy, and relevant industry terms (Surveillance / PTA Approved / Industrial-grade / Carbon Fiber / Epoxy Resin / Battery Pack)",
  "metaKeywords": "8-12 comma-separated SEO keywords relevant to this product and Pakistani market",
  "tags": "5-8 comma-separated short tags for internal search",
  "suggestedBrand": "brand name if identifiable, else empty string",
  "suggestedImageQuery": "precise English image search query to find this exact product model (max 8 words, include brand and model number)"
}`;

  let aiData: Record<string, string> = {};
  try {
    const completion = await openai.chat.completions.create({
      model: aiModel,
      max_completion_tokens: 2500,
      messages: [{ role: "user", content: prompt }],
    });
    const raw = completion.choices[0]?.message?.content ?? "{}";
    const cleaned = raw.replace(/```json\n?|```/g, "").trim();
    aiData = JSON.parse(cleaned);
  } catch (err) {
    req.log.warn({ err }, "AI text generation failed or returned bad JSON");
  }

  // 3. Resolve brand from AI suggestion if not set by category rules
  if (!brandId && aiData.suggestedBrand?.trim()) {
    try {
      brandId = await findOrCreateBrand(aiData.suggestedBrand.trim());
    } catch (err) {
      req.log.warn({ err }, "Brand auto-creation failed");
    }
  }

  // 4. Search and download product images
  const imageQuery = aiData.suggestedImageQuery?.trim() || title;
  const filePrefix = sanitizeFilePrefix(title);
  const { main: featuredImage, gallery: galleryImages } =
    await fetchAndSaveProductImages(imageQuery, filePrefix);

  const warnings: string[] = [];
  if (!featuredImage) warnings.push("No images could be downloaded automatically — please upload manually.");
  if (galleryImages.length < 4) warnings.push(`Only ${galleryImages.length} gallery image(s) downloaded (target: 4).`);
  if (!Object.keys(aiData).length) warnings.push("AI text generation failed — fields may be incomplete.");

  res.json({
    title: aiData.title || title,
    slug: aiData.slug || sanitizeFilePrefix(title),
    shortDescription: aiData.shortDescription || "",
    longDescription: aiData.longDescription || "",
    metaTitle: (aiData.metaTitle || `${title} - Geem Pakistan`).slice(0, 60),
    metaDescription: (aiData.metaDescription || "").slice(0, 160),
    metaKeywords: aiData.metaKeywords || "",
    tags: aiData.tags || "",
    categoryId,
    brandId,
    hidePrice,
    featuredImage,
    galleryImages,
    imageCount: galleryImages.length + (featuredImage ? 1 : 0),
    warnings,
  });
});

// ── Full catalog product list ─────────────────────────────────────────────────
const CATALOG_PRODUCTS: string[] = [
  // ── LawMate Surveillance Products (38) ──────────────────────────────────────
  "LawMate PV-RC400UW","LawMate PV-RC200HDW","LawMate PV-RC200HD2",
  "LawMate PV-WT20W","LawMate PV-EG10CL","LawMate PV-900EVO3",
  "LawMate PV-BT10i","LawMate PV-PB20i","LawMate PV-PB30W",
  "LawMate PV-TC10i","LawMate PV-AP10i","LawMate PV-WB10i",
  "LawMate PV-RC10FHD","LawMate PV-CC10W","LawMate PV-FM20HDWi",
  "LawMate PV-CHG30i","LawMate PV-NB10W","LawMate PV-DY40UW",
  "LawMate PV-DY40UWW","LawMate PV-DY20i","LawMate PV-DY10i",
  "LawMate PV-1000EVO3","LawMate PV-1000AHD","LawMate PV-500Neo Pro",
  "LawMate PV-500ECO2","LawMate PV-500 L4i","LawMate PV-500 Lite 3",
  "LawMate BU-18Neo","LawMate BU-19+","LawMate CM-BU20",
  "LawMate CMD-BU20LX","LawMate ER-18HD","LawMate NT-18HD",
  "LawMate CM-TC10","LawMate AR-100","LawMate AR-300",
  "LawMate RD-30","LawMate RD-10",
  // ── Esonic / MemoQ Audio Recorders (12) ─────────────────────────────────────
  "Esonic MemoQ MQ-U350","Esonic MemoQ MQ-L500N","Esonic MQ-U310",
  "Esonic MR-150","Esonic MR-140","Esonic MR-130",
  "Esonic KC-500","Esonic MQ-99","Esonic MQ-79",
  "Esonic PCM-008","Esonic BR20","Esonic CAM-U7",
  // ── Carbon Fiber Spools & Fabrics (11) ──────────────────────────────────────
  "Toray T700 12K Carbon Fiber Spool","Toray T700 24K Carbon Fiber Spool",
  "Toray T800 12K Carbon Fiber Spool","1K 600D Carbon Fiber Spool",
  "3K 1800D Carbon Fiber Spool","6K 3600D Carbon Fiber Spool",
  "12K 7200D Carbon Fiber Spool","24K 14400D Carbon Fiber Spool",
  "Carbon Fiber Fabric 3K 200GSM Plain Weave",
  "Carbon Fiber Fabric 3K 200GSM Twill Weave",
  "Carbon Fiber Unidirectional UD Fabric",
  // ── Huntsman Araldite Epoxy Systems (7) ─────────────────────────────────────
  "Araldite LY 5052 ARADUR 5052","Araldite LY 5052 ARADUR 5052 CH",
  "Araldite LY 1564 ARADUR 3474","Araldite LY 3585 ARADUR 3475",
  "Araldite LY 8615 ARADUR 8615","Araldite LY 3031 ARADUR 3032",
  "Araldite LY 3508 ARADUR 3478",
  // ── Custom Battery Design & Manufacturing (6) ────────────────────────────────
  "Geem Custom Lithium-Ion NCM Battery Pack Engineering",
  "Geem Subsea Marine Grade Watertight Battery Systems",
  "Geem Smart BMS Integration Services",
  "Geem High-Voltage Industrial Battery Pack Assembly",
  "Geem Custom Cylindrical Cell Array Configuration",
  "Geem Turnkey Industrial Battery Charger Matching Systems",
];

/**
 * POST /products/bulk-seed
 * Seed the full product catalog in batches. Idempotent (skips existing slugs).
 * Body: { offset?: number; limit?: number }
 */
router.post("/products/bulk-seed", async (req, res): Promise<void> => {
  const { offset = 0, limit = 10 } = req.body as { offset?: number; limit?: number };
  const slice = CATALOG_PRODUCTS.slice(offset, offset + limit);
  const total = CATALOG_PRODUCTS.length;

  const results: { title: string; status: "created" | "skipped"; slug: string }[] = [];

  for (const title of slice) {
    const slug = sanitizeFilePrefix(title);

    // Skip if already exists
    const [existing] = await db
      .select({ id: productsTable.id })
      .from(productsTable)
      .where(eq(productsTable.slug, slug));
    if (existing) { results.push({ title, status: "skipped", slug }); continue; }

    const catMatch = detectCategory(title);
    let categoryId: number | null = null;
    let brandId: number | null = null;
    const hidePrice = catMatch?.hidePrice ?? true; // default inquiry-only

    if (catMatch) {
      try {
        const cats = await findOrCreateCategory(catMatch.parentName, catMatch.childName);
        categoryId = cats.childId;
        if (catMatch.brandName) brandId = await findOrCreateBrand(catMatch.brandName);
      } catch { /* ignore */ }
    }

    const metaBase = `${title} - Geem Pakistan`;
    await db.insert(productsTable).values({
      title,
      slug,
      categoryId,
      brandId,
      price: "1",
      hidePrice,
      published: true,
      featured: false,
      stockQty: 0,
      shortDescription: `${title} — available on inquiry. Contact Geem for pricing and availability in Pakistan.`,
      metaTitle: metaBase.slice(0, 60),
      metaDescription: `Buy ${title} in Pakistan. Professional grade equipment. Contact Geem.pk for pricing.`.slice(0, 160),
      metaKeywords: `${title}, Pakistan, Geem, buy online`,
    });

    results.push({ title, status: "created", slug });
  }

  res.json({
    total,
    offset,
    count: slice.length,
    done: offset + slice.length >= total,
    created: results.filter(r => r.status === "created").length,
    skipped: results.filter(r => r.status === "skipped").length,
    results,
  });
});

/**
 * POST /products/ai-fill
 * Legacy simple fill — kept for backwards compatibility.
 */
router.post("/products/ai-fill", async (req, res): Promise<void> => {
  const { title, brandId, categoryId, price } = req.body as {
    title?: string;
    brandId?: number;
    categoryId?: number;
    price?: string;
  };
  if (!title) {
    res.status(400).json({ error: "title required" });
    return;
  }

  const [brand] = brandId
    ? await db.select().from(brandsTable).where(eq(brandsTable.id, brandId))
    : [null];
  const [cat] = categoryId
    ? await db.select().from(categoriesTable).where(eq(categoriesTable.id, categoryId))
    : [null];

  const { client: openai, model: aiModel } = await getOpenAI();

  const prompt = `You are a product data specialist for a Pakistani mobile phone shop called Geem.pk.
Generate complete e-commerce product listing data for the following device in Pakistani market context.

Device: ${title}
Brand: ${brand?.name ?? "Unknown"}
Category: ${cat?.name ?? "Smartphone"}
Price (PKR): ${price ?? "varies"}

Return ONLY a valid JSON object (no markdown, no backticks) with these exact fields:
{
  "title": "Complete official product title (e.g. Samsung Galaxy S24 Ultra 12GB/256GB)",
  "slug": "url-friendly-slug-lowercase-hyphens",
  "shortDescription": "One compelling sentence about the device for Pakistani buyers (max 120 chars)",
  "longDescription": "2-3 paragraphs: key specs, features, why to buy. Mention PTA approved if applicable. Use plain text.",
  "tags": "comma-separated tags: brand, model, category, key features (e.g. 5G, flagship, PTA)",
  "metaTitle": "SEO title under 60 chars",
  "metaDescription": "SEO description under 155 chars mentioning price if given"
}`;

  try {
    const completion = await openai.chat.completions.create({
      model: aiModel,
      max_completion_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });
    const raw = completion.choices[0]?.message?.content ?? "{}";
    const cleaned = raw.replace(/```json\n?|```/g, "").trim();
    const data = JSON.parse(cleaned);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "AI generation failed", detail: String(err) });
  }
});

export default router;
