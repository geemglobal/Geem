import { Router, type IRouter } from "express";
import OpenAI from "openai";
import { db, brandsTable, categoriesTable, integrationSettingsTable } from "@workspace/db";
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

function getImageExt(url: string): string {
  const u = url.split("?")[0].toLowerCase();
  if (u.endsWith(".webp")) return ".webp";
  if (u.endsWith(".png")) return ".png";
  if (u.endsWith(".gif")) return ".gif";
  return ".jpg";
}

async function downloadImageToFile(url: string, destPath: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return false;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 2000) return false; // skip tiny/broken images
    fs.writeFileSync(destPath, buf);
    return true;
  } catch {
    return false;
  }
}

function sanitizeFilePrefix(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 55);
}

async function fetchAndSaveProductImages(
  searchQuery: string,
  filePrefix: string,
): Promise<{ main: string | null; gallery: string[] }> {
  const productsDir = path.join(getUploadsDir(), "public", "products");
  const galleryDir = path.join(productsDir, "gallery");
  fs.mkdirSync(productsDir, { recursive: true });
  fs.mkdirSync(galleryDir, { recursive: true });

  const imageUrls = await searchImagesViaDDG(searchQuery);
  if (!imageUrls.length) return { main: null, gallery: [] };

  let main: string | null = null;
  const gallery: string[] = [];

  // Download main image
  if (imageUrls[0]) {
    const ext = getImageExt(imageUrls[0]);
    const mainFile = `${filePrefix}-main${ext}`;
    const mainPath = path.join(productsDir, mainFile);
    if (await downloadImageToFile(imageUrls[0], mainPath)) {
      main = `/api/storage/public-objects/products/${mainFile}`;
    }
  }

  // Download up to 4 gallery images from remaining URLs
  for (let i = 1; i < imageUrls.length && gallery.length < 4; i++) {
    const url = imageUrls[i];
    if (!url) continue;
    const ext = getImageExt(url);
    const galleryFile = `${filePrefix}-gallery-${gallery.length + 1}${ext}`;
    const galleryPath = path.join(galleryDir, galleryFile);
    if (await downloadImageToFile(url, galleryPath)) {
      gallery.push(`/api/storage/public-objects/products/gallery/${galleryFile}`);
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
