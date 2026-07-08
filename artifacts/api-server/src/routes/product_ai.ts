import { Router, type IRouter } from "express";
import OpenAI from "openai";
import { db, brandsTable, categoriesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

function getOpenAI() {
  return new OpenAI({
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY ?? "dummy",
  });
}

// POST /products/ai-fill — auto-fill product metadata from brand+model+category context
router.post("/products/ai-fill", async (req, res): Promise<void> => {
  const { title, brandId, categoryId, price } = req.body;
  if (!title) { res.status(400).json({ error: "title required" }); return; }

  const [brand] = brandId ? await db.select().from(brandsTable).where(eq(brandsTable.id, brandId)) : [null];
  const [cat] = categoryId ? await db.select().from(categoriesTable).where(eq(categoriesTable.id, categoryId)) : [null];

  const openai = getOpenAI();

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
      model: "gpt-4o-mini",
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
