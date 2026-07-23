import { Router, type IRouter } from "express";
import { eq, and, sql, count, ilike, desc, isNotNull } from "drizzle-orm";
import {
  db, inventoryItemsTable, brandsTable, deviceModelsTable, categoriesTable, productsTable,
  invoicesTable, invoiceItemsTable, paymentsTable, customersTable, vendorsTable, invoiceSettingsTable,
  ledgerEntriesTable, imeiHistoryTable, shipmentsTable, couriersTable,
} from "@workspace/db";
import OpenAI from "openai";

function getOpenAI() {
  return new OpenAI({
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY ?? "dummy",
  });
}

interface ProductContent {
  title: string;
  shortDescription: string;
  longDescription: string;
  tags: string;
  metaTitle: string;
  metaDescription: string;
  metaKeywords: string;
}

async function generateProductContent(title: string, brandName: string, priceStr: string): Promise<ProductContent | null> {
  try {
    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_completion_tokens: 1800,
      messages: [{
        role: "user",
        content: `You are a senior SEO content strategist and e-commerce copywriter for Geem.pk — Pakistan's specialist security & surveillance equipment supplier (geem.pk).

Your task: write a complete, professional, Google-ranking product listing for this item.

Product: ${title}
Brand: ${brandName}
Price (PKR): ${priceStr}
Market: Pakistan
Store: Geem.pk — specialists in spy cameras, GPS trackers, Lawmate surveillance, signal detectors, CCTV, and professional security equipment

RULES:
- Use real, accurate features/specs for this exact product (you know them)
- Never invent specs — if unsure of a spec, describe benefits instead
- Natural language only — no bullet lists in longDescription
- Pakistan-centric search intent: buyers search "[product] price in pakistan", "buy [product] online pakistan"
- Do NOT repeat the same phrase more than twice across all fields
- Do NOT mention mobile phones or smartphones

Return ONLY valid JSON (no markdown, no code fences) with exactly these fields:

{
  "title": "Professional product title. Format: '[Brand] [Full Model Name]'. Max 80 chars.",
  "shortDescription": "One punchy sentence (max 140 chars) with the product's key feature. End with: 'Available at Geem.pk Pakistan.'",
  "longDescription": "Write EXACTLY 3 focused paragraphs separated by a blank line. P1 (~60 words): Product name, primary use case, 2-3 standout features with real detail. P2 (~80 words): Real specs and real-world use cases for Pakistani security professionals, agencies, families and businesses. P3 (~60 words): Why buy from Geem.pk — 100% original, genuine, warranty, discreet nationwide delivery (Karachi, Lahore, Islamabad), secure payment, expert support, on-demand agency import. Close with a call to action.",
  "tags": "Exactly 12 lowercase comma-separated tags. Include: brand slug, product slug, 'buy online pakistan', one use-case tag (e.g. 'hidden camera', 'vehicle tracker', 'rf detector'), 'security equipment pakistan', 'surveillance pakistan', 'geem.pk', plus 5 product-specific feature/use tags.",
  "metaTitle": "Google title tag — max 60 chars. Format: '[Product Name] Price in Pakistan | Geem.pk'.",
  "metaDescription": "Google meta description — max 155 chars. Include: product name, 'best price in Pakistan', one key feature, 'Geem.pk'. Compelling reason to click.",
  "metaKeywords": "Exactly 15 comma-separated phrases: '[product] price in pakistan', 'buy [product] online pakistan', '[product] pakistan', '[brand] [product] pakistan', '[product] original', plus 10 more long-tail variants including use-case queries."
}`,
      }],
    });

    const raw = completion.choices[0]?.message?.content ?? "";
    const cleaned = raw.replace(/```json\n?|```/g, "").trim();
    return JSON.parse(cleaned) as ProductContent;
  } catch {
    return null;
  }
}

const router: IRouter = Router();

// Brand-name → stock photo mapping for auto-created shop products
const BRAND_IMAGES: Record<string, string> = {
  lawmate:   "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80",
  yuntrack:  "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&q=80",
  micodus:   "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&q=80",
  hikvision: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80",
  dahua:     "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80",
  reolink:   "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80",
  concox:    "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&q=80",
  gosafe:    "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&q=80",
};
const DEFAULT_PRODUCT_IMAGE = "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80";

function toSlug(s: string): string {
  return s.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

/** Auto-create a GRN (purchase) invoice when inventory is added. Never throws — errors are swallowed. */
async function autoCreateGRN(opts: {
  inventoryItemId: number; imei: string; brandId: number; modelId: number;
  landedCost: number; purchaseDate: string; vendorId?: number | null;
  grnNumber?: string | null; supplierInvoiceNumber?: string | null;
}): Promise<void> {
  try {
    // Get brand + model for description
    const [brand] = await db.select({ name: brandsTable.name }).from(brandsTable).where(eq(brandsTable.id, opts.brandId));
    const [model] = await db.select({ name: deviceModelsTable.name }).from(deviceModelsTable).where(eq(deviceModelsTable.id, opts.modelId));
    const description = `${brand?.name ?? "Unknown"} ${model?.name ?? "Unknown"} (IMEI: ${opts.imei})`;

    // Resolve or create a customer record for the supplier
    let supplierId: number | null = null;
    if (opts.vendorId) {
      const [vendor] = await db.select({ name: vendorsTable.name, phone: vendorsTable.phone }).from(vendorsTable).where(eq(vendorsTable.id, opts.vendorId));
      if (vendor) {
        const [existing] = await db.select({ id: customersTable.id }).from(customersTable).where(ilike(customersTable.name, vendor.name));
        if (existing) {
          supplierId = existing.id;
        } else {
          const [newCust] = await db.insert(customersTable).values({
            name: vendor.name, mobile: vendor.phone ?? "00000000000",
          }).returning({ id: customersTable.id });
          supplierId = newCust?.id ?? null;
        }
      }
    }

    // Fall back to first customer if no vendor
    if (!supplierId) {
      const [first] = await db.select({ id: customersTable.id }).from(customersTable);
      if (!first) return; // can't create without a customer
      supplierId = first.id;
    }

    // Generate GRN invoice number
    const [settings] = await db.select().from(invoiceSettingsTable);
    const num = settings?.nextInvoiceNumber ?? 1001;
    if (settings) await db.update(invoiceSettingsTable).set({ nextInvoiceNumber: num + 1 }).where(eq(invoiceSettingsTable.id, settings.id));
    const invNumber = opts.grnNumber ?? `GRN-${String(num).padStart(4, "0")}`;

    // Check if GRN invoice already exists for this number
    if (opts.grnNumber) {
      const [existing] = await db.select({ id: invoicesTable.id }).from(invoicesTable).where(eq(invoicesTable.invoiceNumber, invNumber));
      if (existing) return; // already created for this GRN batch
    }

    const total = String(opts.landedCost);
    const [inv] = await db.insert(invoicesTable).values({
      invoiceNumber: invNumber,
      customerId: supplierId,
      date: opts.purchaseDate,
      status: "paid",
      subtotal: total, discount: "0", tax: "0", shipping: "0",
      total, paid: total,
      notes: opts.supplierInvoiceNumber ? `Supplier Invoice: ${opts.supplierInvoiceNumber}` : undefined,
    }).returning();

    await db.insert(invoiceItemsTable).values({
      invoiceId: inv.id,
      description,
      imei: opts.imei,
      inventoryItemId: opts.inventoryItemId,
      qty: "1", price: total, taxRate: "0", amount: total,
    });
  } catch { /* non-critical — swallow errors */ }
}

/**
 * Find an existing customer by mobile number (primary key for dedup), falling back to name match.
 * Creates a new customer if neither matches. Updates city/address if they were blank.
 * Never throws.
 */
async function findOrCreateCustomer(opts: {
  name?: string; mobile?: string; city?: string; address?: string;
}): Promise<number | null> {
  try {
    const name   = opts.name?.trim()    || "";
    const mobile = opts.mobile?.trim()  || "";
    const city   = opts.city?.trim()    || "";
    const address = opts.address?.trim() || "";

    if (!name && !mobile) return null;

    // 1. Match by mobile (most reliable)
    if (mobile) {
      const [byMobile] = await db.select({ id: customersTable.id, city: customersTable.city, address: customersTable.address })
        .from(customersTable).where(eq(customersTable.mobile, mobile));
      if (byMobile) {
        // Fill in missing city/address if we now have them
        const updates: Record<string, string> = {};
        if (city && !byMobile.city)   updates.city    = city;
        if (address && !byMobile.address) updates.address = address;
        if (Object.keys(updates).length)
          await db.update(customersTable).set(updates).where(eq(customersTable.id, byMobile.id));
        return byMobile.id;
      }
    }

    // 2. Match by name (case-insensitive)
    if (name) {
      const [byName] = await db.select({ id: customersTable.id }).from(customersTable)
        .where(ilike(customersTable.name, name));
      if (byName) return byName.id;
    }

    // 3. Create new customer
    const safeMobile = mobile || "00000000000";
    const safeName   = name   || `Customer (${safeMobile})`;
    const [created] = await db.insert(customersTable).values({
      name: safeName, mobile: safeMobile,
      city: city || undefined, address: address || undefined,
    }).returning({ id: customersTable.id });
    return created?.id ?? null;
  } catch {
    return null;
  }
}

/** Auto-create a sales invoice for an item that was imported/added already marked as "sold". Never throws. */
async function autoCreateSalesInvoice(opts: {
  inventoryItemId: number; imei: string; brandId: number; modelId: number;
  sellingPrice: number; saleDate: string; customerId?: number | null;
  paidAmount?: number; paymentMethod?: string;
  courierName?: string; trackingNumber?: string; customerCity?: string;
}): Promise<void> {
  try {
    const [brand] = await db.select({ name: brandsTable.name }).from(brandsTable).where(eq(brandsTable.id, opts.brandId));
    const [model] = await db.select({ name: deviceModelsTable.name }).from(deviceModelsTable).where(eq(deviceModelsTable.id, opts.modelId));
    const description = `${brand?.name ?? "Unknown"} ${model?.name ?? "Unknown"} (IMEI: ${opts.imei})`;

    // Resolve customer — use provided or auto-create Walk-in Customer
    let customerId = opts.customerId ?? null;
    if (!customerId) {
      const [walkIn] = await db.select({ id: customersTable.id }).from(customersTable)
        .where(ilike(customersTable.name, "Walk-in%"));
      if (walkIn) {
        customerId = walkIn.id;
      } else {
        const [created] = await db.insert(customersTable).values({
          name: "Walk-in Customer", mobile: "00000000000",
        }).returning({ id: customersTable.id });
        customerId = created?.id ?? null;
      }
    }
    if (!customerId) return;

    // Generate sales invoice number
    const [settings] = await db.select().from(invoiceSettingsTable);
    const num = settings?.nextInvoiceNumber ?? 1001;
    if (settings) await db.update(invoiceSettingsTable).set({ nextInvoiceNumber: num + 1 }).where(eq(invoiceSettingsTable.id, settings.id));
    const invNumber = `INV-${String(num).padStart(4, "0")}`;

    const saleAmount = opts.sellingPrice > 0 ? opts.sellingPrice : 0;
    const paidAmt = Math.min(opts.paidAmount ?? 0, saleAmount);
    const status = paidAmt >= saleAmount && saleAmount > 0 ? "paid" : paidAmt > 0 ? "partial" : "unpaid";

    const [inv] = await db.insert(invoicesTable).values({
      invoiceNumber: invNumber,
      customerId,
      date: opts.saleDate,
      status,
      subtotal: String(saleAmount), discount: "0", tax: "0", shipping: "0",
      total: String(saleAmount),
      paid: String(paidAmt),
      notes: `Auto-invoice for sold item. IMEI: ${opts.imei}`,
    }).returning();

    await db.insert(invoiceItemsTable).values({
      invoiceId: inv.id,
      description,
      imei: opts.imei,
      inventoryItemId: opts.inventoryItemId,
      qty: "1", price: String(saleAmount), taxRate: "0", amount: String(saleAmount),
    });

    // Record payment if any amount was paid
    const method = opts.paymentMethod?.trim().toLowerCase() || "cash";
    if (paidAmt > 0) {
      await db.insert(paymentsTable).values({
        invoiceId: inv.id,
        date: opts.saleDate,
        method,
        amount: String(paidAmt),
        memo: `Payment on ${invNumber}`,
      });
    }

    // Auto-create shipment if courier/tracking info is provided
    if (opts.courierName || opts.trackingNumber) {
      try {
        const courierName = (opts.courierName ?? "TCS").trim();
        let courierId: number | null = null;
        const existing = await db.select({ id: couriersTable.id }).from(couriersTable)
          .where(ilike(couriersTable.name, courierName));
        if (existing.length > 0) {
          courierId = existing[0].id;
        } else {
          const [c] = await db.insert(couriersTable).values({ name: courierName }).returning({ id: couriersTable.id });
          courierId = c?.id ?? null;
        }
        if (courierId) {
          await db.insert(shipmentsTable).values({
            invoiceId: inv.id,
            courierId,
            cn: opts.trackingNumber ?? null,
            status: "dispatched",
            destination: opts.customerCity ?? "Pakistan",
            pieces: 1,
            codAmount: "0",
            shippingCharges: "0",
          });
        }
      } catch { /* non-critical */ }
    }

    // Ledger — get running balance for this customer
    const [lastEntry] = await db.select({ balance: ledgerEntriesTable.balance })
      .from(ledgerEntriesTable)
      .where(eq(ledgerEntriesTable.customerId, customerId))
      .orderBy(desc(ledgerEntriesTable.createdAt))
      .limit(1);
    const prevBalance = parseFloat(String(lastEntry?.balance ?? "0"));

    // Debit: customer owes us the sale amount
    const balAfterInvoice = prevBalance + saleAmount;
    await db.insert(ledgerEntriesTable).values({
      customerId,
      date: new Date(opts.saleDate),
      type: "invoice",
      description: `Sales Invoice ${invNumber} — ${description}`,
      reference: invNumber,
      debit: String(saleAmount),
      credit: "0",
      balance: String(balAfterInvoice),
    });

    // Credit: record any payment received
    if (paidAmt > 0) {
      const balAfterPayment = balAfterInvoice - paidAmt;
      await db.insert(ledgerEntriesTable).values({
        customerId,
        date: new Date(opts.saleDate),
        type: "payment",
        description: `Payment received — ${invNumber}`,
        reference: invNumber,
        debit: "0",
        credit: String(paidAmt),
        balance: String(balAfterPayment),
      });
    }
  } catch { /* non-critical */ }
}


/** Build a clean, SEO-optimised product title — never repeats the brand if the model already starts with it. */
function buildProductTitle(brandName: string, modelName: string): string {
  const b = brandName.trim();
  const m = modelName.trim();
  // Avoid "Samsung Samsung Galaxy A54" when model name already includes the brand
  if (m.toLowerCase().startsWith(b.toLowerCase())) return m;
  return `${b} ${m}`;
}

/**
 * Determine the best matching category ID from the categories table for a given brand + model.
 * Uses keyword matching on the combined "brand model" string.
 * Returns the category id, or null if "Smartphones" isn't found either.
 */
async function resolveCategory(brandName: string, modelName: string): Promise<number | null> {
  const key = `${brandName} ${modelName}`.toLowerCase();

  // Ordered rules — first match wins
  const rules: Array<{ patterns: string[]; name: string }> = [
    // Tablets — check before phones so "iPad" beats "Apple"
    { patterns: ["ipad", "tab ", "tab s", "tab a", "matebook", "mediapad", "tablet", " tab"], name: "Tablets" },
    // Laptops
    { patterns: ["macbook", "laptop", "notebook", "thinkpad", "inspiron", "vivobook", "zenbook", "book pro", "chromebook", "surface pro", "surface laptop", "matebook d"], name: "Laptops" },
    // Smartwatches
    { patterns: ["apple watch", "galaxy watch", "watch 4", "watch 5", "watch 6", "watch 7", "watch ultra", "band ", "smart band", "smartwatch", "mi band", "redmi band", "fit 3", "gt 4", "gt 3", "gt runner", "amazfit", "fitbit"], name: "Smartwatches & Wearables" },
    // Audio
    { patterns: ["airpods", "buds ", "buds2", "buds+", "earbuds", "earphones", "headphones", "headset", "galaxy buds", "freebuds", "soundcore", "jbl", "neckband", "tws "], name: "Headphones & Earbuds" },
    // Power banks
    { patterns: ["power bank", "powerbank", "portable charger", "10000mah", "20000mah"], name: "Power Banks" },
    // Chargers & Cables
    { patterns: ["charger", "cable", "adapter", "usb-c", "lightning cable", "charging brick"], name: "Chargers & Cables" },
    // Cases & Covers
    { patterns: ["case", "cover", "back cover", "bumper", "flip cover", "wallet case"], name: "Cases & Covers" },
    // Memory / Storage
    { patterns: ["memory card", "sd card", "microsd", "flash drive", "usb drive", "ssd", "hard disk"], name: "Memory Cards & Storage" },
    // Smartphones — default for all phone brands and generic model names
    { patterns: ["iphone", "galaxy s", "galaxy a", "galaxy m", "galaxy f", "redmi ", "poco ", "note ", "pro max", "ultra", "plus 5g", "oneplus", "oppo", "realme", "vivo", "nokia", "tecno", "infinix", "itel", "pixel", "motorola", "moto "], name: "Smartphones" },
  ];

  // Fetch all category names + ids once
  const allCats = await db.select({ id: categoriesTable.id, name: categoriesTable.name }).from(categoriesTable);
  const byName = (n: string) => allCats.find(c => c.name.toLowerCase() === n.toLowerCase())?.id ?? null;

  for (const rule of rules) {
    if (rule.patterns.some(p => key.includes(p))) {
      const id = byName(rule.name);
      if (id) return id;
    }
  }

  // Final fallback — no category assigned for unknown items
  return null;
}

/** Create or update a shop product based on an inventory entry. Never throws — errors are swallowed. */
async function upsertProductFromInventory(brandId: number, modelId: number, sellingPrice: number): Promise<void> {
  try {
    const [brand] = await db.select({ id: brandsTable.id, name: brandsTable.name }).from(brandsTable).where(eq(brandsTable.id, brandId));
    const [model] = await db.select({ id: deviceModelsTable.id, name: deviceModelsTable.name }).from(deviceModelsTable).where(eq(deviceModelsTable.id, modelId));
    if (!brand || !model) return;

    const title = buildProductTitle(brand.name, model.name);
    const slug = toSlug(title);

    // Count how many are currently in_stock for this model
    const [{ stockCount }] = await db.select({ stockCount: count() })
      .from(inventoryItemsTable)
      .where(and(eq(inventoryItemsTable.brandId, brandId), eq(inventoryItemsTable.modelId, modelId), eq(inventoryItemsTable.status, "in_stock")));

    // Resolve the correct category based on brand + model name keywords
    const catId = await resolveCategory(brand.name, model.name);
    const cat = catId ? { id: catId } : null;

    const featuredImage = BRAND_IMAGES[brand.name.toLowerCase()] ?? DEFAULT_PRODUCT_IMAGE;

    // SEO fields computed once for both insert and update
    const metaTitle = `${title} Price in Pakistan — Buy Online at Geem.pk`;
    const metaDescription = `Buy ${title} online in Pakistan at the best price. 100% original, genuine product with manufacturer warranty. Fast nationwide delivery. Order now at Geem.pk.`;
    const metaKeywords = `${title}, ${title} price in pakistan, buy ${title} online, ${brand.name} ${title} pakistan, ${title} price pakistan, ${title} geem.pk`;

    // Primary lookup: exact slug match
    let [existing] = await db.select({ id: productsTable.id, metaTitle: productsTable.metaTitle }).from(productsTable).where(eq(productsTable.slug, slug));

    // Fallback: if slug changed (e.g. after brand dedup fix), find by brandId + title contains model name
    if (!existing) {
      const [found] = await db
        .select({ id: productsTable.id, metaTitle: productsTable.metaTitle })
        .from(productsTable)
        .where(and(eq(productsTable.brandId, brand.id), ilike(productsTable.title, `%${model.name}%`)));
      if (found) existing = found;
    }

    if (existing) {
      // Always refresh stock and price; refresh SEO + title only if still on hardcoded template
      const updates: Record<string, unknown> = { stockQty: stockCount };
      if (sellingPrice > 0) updates.price = String(sellingPrice);
      const isTemplateSEO = existing.metaTitle?.includes("Buy Online at Geem.pk");
      if (isTemplateSEO) {
        const ai = await generateProductContent(title, brand.name, sellingPrice > 0 ? `PKR ${sellingPrice.toLocaleString()}` : "contact for price");
        if (ai) {
          // Use AI-generated professional title + SEO fields
          const aiTitle = ai.title?.trim() || title;
          updates.title = aiTitle;
          updates.slug = toSlug(aiTitle);
          updates.metaTitle = ai.metaTitle;
          updates.metaDescription = ai.metaDescription;
          updates.metaKeywords = ai.metaKeywords;
          updates.shortDescription = ai.shortDescription;
          updates.longDescription = ai.longDescription;
          updates.tags = ai.tags;
        } else {
          updates.metaTitle = metaTitle;
          updates.metaDescription = metaDescription;
          updates.metaKeywords = metaKeywords;
        }
      }
      await db.update(productsTable).set(updates).where(eq(productsTable.id, existing.id));
    } else {
      // Generate AI content for new products; fall back to hardcoded if AI fails
      const priceLabel = sellingPrice > 0 ? `PKR ${sellingPrice.toLocaleString()}` : "contact for price";
      const ai = await generateProductContent(title, brand.name, priceLabel);

      // Prefer AI title (which may include storage/RAM) over raw model name
      const finalTitle = ai?.title?.trim() || title;
      const finalSlug = toSlug(finalTitle);

      const shortDescription = ai?.shortDescription
        ?? `Buy ${finalTitle} in Pakistan at the best price — 100% original, genuine product with manufacturer warranty. Order now at Geem.pk.`;

      const longDescription = ai?.longDescription
        ?? `${finalTitle} is available at Geem.pk — Pakistan's specialist security and surveillance equipment supplier.\n\nProfessionally sourced and tested for reliability, ${finalTitle} delivers outstanding performance for security and surveillance applications.\n\nWhy buy from Geem.pk? You receive a 100% original, genuine product with manufacturer warranty and professional packaging. We offer nationwide delivery across Pakistan — Karachi, Lahore, Islamabad, and beyond — with secure payment and dedicated after-sales support. Order today or contact us on WhatsApp for the latest price.`;

      const tags = ai?.tags
        ?? [brand.name.toLowerCase(), toSlug(model.name), "security equipment", "buy online pakistan", "surveillance pakistan", "pakistan", "geem.pk", "original"].join(",");

      await db.insert(productsTable).values({
        title: finalTitle,
        slug: finalSlug,
        brandId: brand.id,
        categoryId: cat?.id ?? null,
        price: String(sellingPrice > 0 ? sellingPrice : 1),
        stockQty: stockCount,
        shortDescription,
        longDescription,
        featuredImage,
        tags,
        published: true,
        featured: false,
        metaTitle:       ai?.metaTitle       ?? metaTitle,
        metaDescription: ai?.metaDescription ?? metaDescription,
        metaKeywords:    ai?.metaKeywords    ?? metaKeywords,
      });
    }
  } catch {
    // Non-critical: swallow errors so inventory ops always succeed
  }
}

async function enrichItem(item: typeof inventoryItemsTable.$inferSelect) {
  const [brand] = await db.select({ name: brandsTable.name }).from(brandsTable).where(eq(brandsTable.id, item.brandId));
  const [model] = await db.select({ name: deviceModelsTable.name }).from(deviceModelsTable).where(eq(deviceModelsTable.id, item.modelId));
  const [cat] = item.categoryId ? await db.select({ name: categoriesTable.name }).from(categoriesTable).where(eq(categoriesTable.id, item.categoryId)) : [null];

  // Link to sales invoice (INV-*) and pull customer details
  const [salesInv] = await db
    .select({
      id: invoicesTable.id,
      invoiceNumber: invoicesTable.invoiceNumber,
      paymentStatus: invoicesTable.status,
      saleDate: invoicesTable.date,
      customerName: customersTable.name,
      customerMobile: customersTable.mobile,
      customerCity: customersTable.city,
      customerId: invoicesTable.customerId,
    })
    .from(invoiceItemsTable)
    .innerJoin(invoicesTable, eq(invoiceItemsTable.invoiceId, invoicesTable.id))
    .leftJoin(customersTable, eq(invoicesTable.customerId, customersTable.id))
    .where(
      and(
        eq(invoiceItemsTable.inventoryItemId, item.id),
        sql`${invoicesTable.invoiceNumber} like 'INV-%'`
      )
    )
    .limit(1);

  const [{ imeiChangeCount }] = await db
    .select({ imeiChangeCount: count() })
    .from(imeiHistoryTable)
    .where(eq(imeiHistoryTable.inventoryItemId, item.id));

  return {
    ...item,
    brandName: brand?.name ?? "",
    modelName: model?.name ?? "",
    categoryName: cat?.name ?? null,
    productName: `${brand?.name ?? ""} ${model?.name ?? ""}`.trim(),
    landedCost: parseFloat(String(item.landedCost)),
    sellingPrice: parseFloat(String(item.sellingPrice)),
    deviceId: item.deviceId ?? null,
    iccid: item.iccid ?? null,
    msisdn: item.msisdn ?? null,
    psid: item.psid ?? null,
    notes: item.notes ?? null,
    trackerSimNo: item.trackerSimNo ?? null,
    supplierInvoiceNumber: item.supplierInvoiceNumber ?? null,
    grnNumber: item.grnNumber ?? null,
    warrantyExpiry: item.warrantyExpiry ?? null,
    categoryId: item.categoryId ?? null,
    vendorId: item.vendorId ?? null,
    purchaseDate: String(item.purchaseDate),
    createdAt: item.createdAt.toISOString(),
    salesInvoiceId: salesInv?.id ?? null,
    salesInvoiceNumber: salesInv?.invoiceNumber ?? null,
    salePaymentStatus: salesInv?.paymentStatus ?? null,
    saleDate: salesInv?.saleDate ? String(salesInv.saleDate) : null,
    saleCustomerName: salesInv?.customerName ?? null,
    saleCustomerMobile: salesInv?.customerMobile ?? null,
    saleCustomerCity: salesInv?.customerCity ?? null,
    saleCustomerId: salesInv?.customerId ?? null,
    imeiChangeCount: Number(imeiChangeCount),
  };
}

router.get("/inventory", async (req, res): Promise<void> => {
  const page = parseInt(String(req.query.page ?? "1"), 10);
  const limit = parseInt(String(req.query.limit ?? "50"), 10);
  const offset = (page - 1) * limit;
  const search = String(req.query.search ?? "");
  const status = String(req.query.status ?? "");
  const ptaStatus = String(req.query.ptaStatus ?? "");
  const brandId = req.query.brandId ? parseInt(String(req.query.brandId), 10) : undefined;
  const modelId = req.query.modelId ? parseInt(String(req.query.modelId), 10) : undefined;

  const conditions: ReturnType<typeof eq>[] = [];
  if (status === "missing") {
    conditions.push(sql`${inventoryItemsTable.status} in ('missing','lost')` as ReturnType<typeof eq>);
  } else if (status === "not_for_use") {
    conditions.push(sql`${inventoryItemsTable.status} in ('not_for_use','pta_blocked')` as ReturnType<typeof eq>);
  } else if (status) {
    conditions.push(eq(inventoryItemsTable.status, status));
  }
  if (ptaStatus) conditions.push(eq(inventoryItemsTable.ptaStatus, ptaStatus));
  if (brandId) conditions.push(eq(inventoryItemsTable.brandId, brandId));
  if (modelId) conditions.push(eq(inventoryItemsTable.modelId, modelId));
  if (search) {
    conditions.push(
      sql`(${inventoryItemsTable.imei} ilike ${'%' + search + '%'}
        or ${inventoryItemsTable.deviceId} ilike ${'%' + search + '%'}
        or ${inventoryItemsTable.psid} ilike ${'%' + search + '%'}
        or exists (select 1 from brands where brands.id = ${inventoryItemsTable.brandId} and brands.name ilike ${'%' + search + '%'})
        or exists (select 1 from device_models where device_models.id = ${inventoryItemsTable.modelId} and device_models.name ilike ${'%' + search + '%'}))` as ReturnType<typeof eq>
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [{ total }] = await db.select({ total: count() }).from(inventoryItemsTable).where(whereClause);
  const items = await db.select().from(inventoryItemsTable).where(whereClause).limit(limit).offset(offset).orderBy(sql`${inventoryItemsTable.createdAt} desc`);

  const [inStock] = await db.select({ c: count() }).from(inventoryItemsTable).where(eq(inventoryItemsTable.status, "in_stock"));
  const [sold] = await db.select({ c: count() }).from(inventoryItemsTable).where(eq(inventoryItemsTable.status, "sold"));
  const [damaged] = await db.select({ c: count() }).from(inventoryItemsTable).where(eq(inventoryItemsTable.status, "damaged"));
  const [missing] = await db.select({ c: count() }).from(inventoryItemsTable).where(
    sql`${inventoryItemsTable.status} in ('missing','lost')`
  );
  const [notForUse] = await db.select({ c: count() }).from(inventoryItemsTable).where(
    sql`${inventoryItemsTable.status} in ('not_for_use','pta_blocked')`
  );
  const [ptaPending] = await db.select({ c: count() }).from(inventoryItemsTable).where(eq(inventoryItemsTable.ptaStatus, "pending"));
  const [ptaUnpaid] = await db.select({ c: count() }).from(inventoryItemsTable).where(
    and(eq(inventoryItemsTable.ptaStatus, "unpaid"), eq(inventoryItemsTable.status, "sold"))
  );

  const enriched = await Promise.all(items.map(enrichItem));
  res.json({
    items: enriched,
    total,
    page,
    limit,
    summary: {
      inStock: inStock.c, sold: sold.c,
      damaged: damaged.c, missing: missing.c, notForUse: notForUse.c,
      ptaPending: ptaPending.c, ptaUnpaid: ptaUnpaid.c,
    },
  });
});

router.post("/inventory", async (req, res): Promise<void> => {
  const { imei, deviceId, iccid, msisdn, brandId, modelId, categoryId, vendorId, status, ptaStatus, psid, landedCost, sellingPrice, purchaseDate, warrantyDays, supplierInvoiceNumber, grnNumber, notes } = req.body;
  if (!imei || !brandId || !modelId || landedCost === undefined || sellingPrice === undefined || !purchaseDate) {
    res.status(400).json({ error: "Required: imei, brandId, modelId, landedCost, sellingPrice, purchaseDate" });
    return;
  }
  const warrantyExpiry = purchaseDate ? new Date(new Date(purchaseDate).getTime() + (warrantyDays ?? 365) * 86400000).toISOString().split("T")[0] : null;
  const [item] = await db.insert(inventoryItemsTable).values({
    imei: String(imei), deviceId: deviceId ? String(deviceId) : undefined,
    iccid, msisdn, brandId, modelId, categoryId, vendorId,
    status: status ?? "in_stock", ptaStatus: ptaStatus ?? "approved",
    psid, landedCost: String(landedCost), sellingPrice: String(sellingPrice),
    purchaseDate, warrantyExpiry, supplierInvoiceNumber, grnNumber, notes,
  }).returning();

  // Auto-create/update shop product
  await upsertProductFromInventory(brandId, modelId, parseFloat(String(sellingPrice)));

  // Auto-create GRN (purchase) invoice
  await autoCreateGRN({
    inventoryItemId: item.id,
    imei: item.imei,
    brandId, modelId,
    landedCost: parseFloat(String(landedCost)),
    purchaseDate: String(purchaseDate),
    vendorId: vendorId ?? null,
    grnNumber: grnNumber ?? null,
    supplierInvoiceNumber: supplierInvoiceNumber ?? null,
  });

  // If added as already sold, auto-create a sales invoice + ledger entry
  if ((status ?? "in_stock") === "sold") {
    await autoCreateSalesInvoice({
      inventoryItemId: item.id,
      imei: item.imei,
      brandId, modelId,
      sellingPrice: parseFloat(String(sellingPrice)),
      saleDate: String(purchaseDate),
    });
  }

  res.status(201).json(await enrichItem(item));
});

// Bulk add — multiple IMEIs with shared fields (brand, model, cost, etc.)
router.post("/inventory/bulk-add", async (req, res): Promise<void> => {
  const {
    brandId, modelId, status, ptaStatus, landedCost, sellingPrice,
    purchaseDate, grnNumber, supplierInvoiceNumber, notes, items,
  } = req.body as {
    brandId: number; modelId: number; status?: string; ptaStatus?: string;
    landedCost?: number; sellingPrice?: number; purchaseDate: string;
    grnNumber?: string; supplierInvoiceNumber?: string; notes?: string;
    items: Array<{ imei: string; deviceId?: string }>;
  };

  if (!brandId || !modelId || !purchaseDate || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: "Required: brandId, modelId, purchaseDate, items[]" });
    return;
  }

  const warrantyExpiry = new Date(new Date(purchaseDate).getTime() + 365 * 86400000).toISOString().split("T")[0];
  let added = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const it of items) {
    const imei = String(it.imei ?? "").trim();
    if (!imei) { skipped++; continue; }
    try {
      const [item] = await db.insert(inventoryItemsTable).values({
        imei,
        deviceId: it.deviceId ? String(it.deviceId) : undefined,
        brandId, modelId,
        status: status ?? "in_stock",
        ptaStatus: ptaStatus ?? "approved",
        landedCost: String(landedCost ?? 0),
        sellingPrice: String(sellingPrice ?? 0),
        purchaseDate, warrantyExpiry,
        grnNumber: grnNumber ?? undefined,
        supplierInvoiceNumber: supplierInvoiceNumber ?? undefined,
        notes: notes ?? undefined,
      }).returning();
      added++;
      await autoCreateGRN({
        inventoryItemId: item.id,
        imei: item.imei,
        brandId, modelId,
        landedCost: parseFloat(String(landedCost ?? 0)),
        purchaseDate: String(purchaseDate),
        grnNumber: grnNumber ?? null,
        supplierInvoiceNumber: supplierInvoiceNumber ?? null,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      skipped++;
      errors.push(msg.includes("unique") ? `IMEI ${imei} already exists` : `${imei}: ${msg}`);
    }
  }

  if (added > 0) {
    await upsertProductFromInventory(brandId, modelId, parseFloat(String(sellingPrice ?? 0)));
  }

  res.status(201).json({ added, skipped, errors });
});

// Bulk import from Excel rows (JSON)
router.post("/inventory/import", async (req, res): Promise<void> => {
  const { rows } = req.body as {
    rows: Array<{
      imei: string | number; deviceId?: string | number; brand: string; model: string;
      status?: string; ptaStatus?: string; psid?: string;
      landedCost?: number | string; sellPrice?: number | string;
      purchaseDate?: string | number; saleDate?: string | number;
      grnNumber?: string;
      oldImei?: string;
      trackerSimNo?: string;
      customerName?: string; customerMobile?: string;
      customerCity?: string; customerAddress?: string;
      received?: number | string;
      paymentMethod?: string;
      courierName?: string; trackingNumber?: string;
    }>;
  };
  if (!Array.isArray(rows) || rows.length === 0) {
    res.status(400).json({ error: "rows[] required — check your Excel column headers" });
    return;
  }

  const brandCache: Record<string, number> = {};
  const modelCache: Record<string, number> = {};

  const statusMap: Record<string, string> = {
    // in_stock variants
    "in stock": "in_stock", "instock": "in_stock", "in hand": "in_stock",
    "available": "in_stock", "stock": "in_stock", "free": "in_stock",
    "imei": "in_stock", "new": "in_stock", "fresh": "in_stock",
    "active": "in_stock", "ready": "in_stock", "hold": "in_stock",
    "on hold": "in_stock", "pending sale": "in_stock",
    // sold variants — the most important group
    "sold": "sold", "sale": "sold", "saled": "sold", "sell": "sold",
    "dispatch": "sold", "dispatched": "sold", "delivered": "sold",
    "invoice": "sold", "invoiced": "sold", "billed": "sold",
    "customer": "sold", "sold out": "sold", "out": "sold",
    "gone": "sold", "done": "sold", "complete": "sold", "completed": "sold",
    "closed": "sold", "paid sold": "sold", "s": "sold",
    "sale done": "sold", "sold/dispatched": "sold", "dispatched/sold": "sold",
    "sold dispatched": "sold", "give": "sold", "given": "sold",
    "handover": "sold", "hand over": "sold", "handoverd": "sold",
    // damaged
    "damaged": "damaged", "damage": "damaged", "broken": "damaged",
    "faulty": "damaged", "dead": "damaged", "defective": "damaged",
    "cracked": "damaged", "water damage": "damaged", "liquid damage": "damaged",
    // missing / lost
    "missing": "missing", "lost": "lost", "missing glb": "missing",
    "theft": "lost", "stolen": "lost",
    // blocked / not for use
    "pta blocked": "pta_blocked", "blocked": "pta_blocked", "block": "pta_blocked",
    "not for use": "not_for_use", "nfu": "not_for_use", "n/a": "not_for_use",
    "na": "not_for_use", "scrap": "not_for_use", "junk": "not_for_use",
  };
  const ptaMap: Record<string, string> = {
    "paid": "paid", "approved": "approved", "approved/paid": "approved",
    "unpaid": "unpaid", "not paid": "unpaid", "due": "unpaid",
    "pending": "pending", "in process": "pending", "processing": "pending",
    "missing": "missing", "don't pay": "dont_pay", "dont pay": "dont_pay",
    "no": "dont_pay", "n/a": "dont_pay", "na": "dont_pay",
  };
  const unknownStatuses = new Set<string>();

  let imported = 0, skipped = 0;
  const errors: string[] = [];
  // Track unique brand+model combos for product upsert
  const productUpserts = new Map<string, { brandId: number; modelId: number; sellPrice: number }>();

  for (const row of rows) {
    if (!row.imei || !row.brand || !row.model) { skipped++; continue; }
    const imeiStr = String(row.imei).trim();
    const brandName = String(row.brand).trim();
    const modelName = String(row.model).trim();
    if (!imeiStr || imeiStr === "N/A" || imeiStr === "" || imeiStr === "0") { skipped++; continue; }

    try {
      let brandId = brandCache[brandName];
      if (!brandId) {
        const existing = await db.select({ id: brandsTable.id }).from(brandsTable).where(sql`lower(${brandsTable.name}) = lower(${brandName})`);
        if (existing.length > 0) { brandId = existing[0].id; }
        else { const [b] = await db.insert(brandsTable).values({ name: brandName }).returning(); brandId = b.id; }
        brandCache[brandName] = brandId;
      }

      const modelKey = `${brandId}:${modelName}`;
      let modelId = modelCache[modelKey];
      if (!modelId) {
        const existing = await db.select({ id: deviceModelsTable.id }).from(deviceModelsTable)
          .where(and(eq(deviceModelsTable.brandId, brandId), sql`lower(${deviceModelsTable.name}) = lower(${modelName})`));
        if (existing.length > 0) { modelId = existing[0].id; }
        else { const [m] = await db.insert(deviceModelsTable).values({ brandId, name: modelName, hasImei: true, hasDeviceId: true }).returning(); modelId = m.id; }
        modelCache[modelKey] = modelId;
      }

      const rawStatus = String(row.status ?? "").toLowerCase().trim();
      const mappedStatus = statusMap[rawStatus];
      if (rawStatus && !mappedStatus) unknownStatuses.add(rawStatus);
      const status = mappedStatus ?? "in_stock";
      const rawPta = String(row.ptaStatus ?? "").toLowerCase().trim();
      const ptaStatus = ptaMap[rawPta] ?? "approved";

      // Parse Excel date serial or string → ISO yyyy-mm-dd
      function parseExcelDate(d: string | number | undefined, fallback: string): string {
        if (!d) return fallback;
        if (typeof d === "number" && d > 40000) {
          return new Date(Date.UTC(1899, 11, 30) + d * 86400000).toISOString().split("T")[0];
        }
        if (typeof d === "string" && (d.includes("-") || d.includes("/"))) {
          return d.replace(/\//g, "-").split("T")[0];
        }
        return fallback;
      }

      const purchaseDate = parseExcelDate(row.purchaseDate, "2024-01-01");
      // saleDate defaults to purchaseDate when not provided (e.g. stock items)
      const saleDate = parseExcelDate(row.saleDate, purchaseDate);

      const landedCost = parseFloat(String(row.landedCost ?? "0")) || 0;
      const sellingPrice = parseFloat(String(row.sellPrice ?? "0")) || 0;
      const receivedAmt = parseFloat(String(row.received ?? "0")) || 0;

      const [item] = await db.insert(inventoryItemsTable).values({
        imei: imeiStr,
        deviceId: row.deviceId ? String(row.deviceId).trim() : undefined,
        brandId, modelId, status, ptaStatus,
        psid: row.psid ? String(row.psid).trim() : undefined,
        landedCost: String(landedCost), sellingPrice: String(sellingPrice), purchaseDate,
        grnNumber: row.grnNumber ? String(row.grnNumber).trim() : undefined,
        trackerSimNo: row.trackerSimNo ? String(row.trackerSimNo).trim() : undefined,
      }).returning();
      imported++;

      // If Old IMEI provided, log the IMEI change in history
      const oldImeiStr = row.oldImei ? String(row.oldImei).trim() : "";
      if (oldImeiStr && oldImeiStr !== imeiStr && oldImeiStr !== "0") {
        await db.insert(imeiHistoryTable).values({
          inventoryItemId: item.id,
          oldImei: oldImeiStr,
          newImei: imeiStr,
          reason: "IMEI updated (imported from Excel)",
          source: "import",
        });
      }

      // Auto-create GRN (purchase) invoice for every item
      await autoCreateGRN({
        inventoryItemId: item.id, imei: imeiStr,
        brandId, modelId, landedCost, purchaseDate,
        grnNumber: row.grnNumber?.trim() || undefined,
      });

      // Mobile is required to identify a customer uniquely; without it → Walk-in Customer
      const hasCustomerData = !!row.customerMobile?.trim();
      let importedCustomerId: number | null = null;
      if (hasCustomerData) {
        importedCustomerId = await findOrCreateCustomer({
          name:    row.customerName,
          mobile:  row.customerMobile,
          city:    row.customerCity,
          address: row.customerAddress,
        });
      }

      // Auto-create sales invoice + ledger + shipment for items already marked sold
      if (status === "sold") {
        await autoCreateSalesInvoice({
          inventoryItemId: item.id, imei: imeiStr,
          brandId, modelId, sellingPrice,
          saleDate,
          customerId: importedCustomerId,
          paidAmount: receivedAmt,
          paymentMethod: row.paymentMethod,
          courierName: row.courierName,
          trackingNumber: row.trackingNumber,
          customerCity: row.customerCity,
        });
      }

      // Track for product upsert (keep highest selling price seen)
      const pk = `${brandId}:${modelId}`;
      if (!productUpserts.has(pk) || sellingPrice > productUpserts.get(pk)!.sellPrice) {
        productUpserts.set(pk, { brandId, modelId, sellPrice: sellingPrice });
      }
    } catch (e: unknown) {
      skipped++;
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.includes("unique")) errors.push(`IMEI ${row.imei}: ${msg.slice(0, 60)}`);
    }
  }

  // Respond immediately; run AI product-catalog generation in the background
  res.json({ imported, skipped, errors: errors.slice(0, 20), unknownStatuses: [...unknownStatuses] });

  // Fire-and-forget: auto-create/update shop products for all unique brand+model combos
  (async () => {
    for (const { brandId, modelId, sellPrice } of productUpserts.values()) {
      await upsertProductFromInventory(brandId, modelId, sellPrice);
    }
  })().catch(() => {});
});

router.post("/inventory/bulk", async (req, res): Promise<void> => {
  const { brandId, modelId, imeis, landedCost, sellingPrice, purchaseDate, ptaStatus, psid, vendorId, warrantyDays } = req.body;
  if (!brandId || !modelId || !Array.isArray(imeis) || !landedCost || !sellingPrice || !purchaseDate) {
    res.status(400).json({ error: "Required: brandId, modelId, imeis[], landedCost, sellingPrice, purchaseDate" });
    return;
  }
  const warrantyExpiry = new Date(new Date(purchaseDate).getTime() + (warrantyDays ?? 365) * 86400000).toISOString().split("T")[0];
  let imported = 0, skipped = 0;
  const errors: string[] = [];
  for (const imei of imeis) {
    try {
      const [item] = await db.insert(inventoryItemsTable).values({
        imei: String(imei).trim(), brandId, modelId, vendorId,
        ptaStatus: ptaStatus ?? "approved", psid,
        landedCost: String(landedCost), sellingPrice: String(sellingPrice),
        purchaseDate, warrantyExpiry,
      }).returning();

      // Auto-create GRN (purchase) invoice for every item
      await autoCreateGRN({
        inventoryItemId: item.id, imei: item.imei,
        brandId, modelId,
        landedCost: parseFloat(String(landedCost)),
        purchaseDate: String(purchaseDate),
        vendorId: vendorId ?? null,
      });

      imported++;
    } catch { skipped++; }
  }
  // Auto-create/update shop product
  await upsertProductFromInventory(brandId, modelId, parseFloat(String(sellingPrice)));
  res.json({ imported, skipped, errors });
});

router.get("/inventory/stats/by-brand", async (req, res): Promise<void> => {
  const rows = await db
    .select({ brandName: brandsTable.name, total: count() })
    .from(inventoryItemsTable)
    .leftJoin(brandsTable, eq(inventoryItemsTable.brandId, brandsTable.id))
    .groupBy(brandsTable.name)
    .orderBy(sql`count(*) desc`)
    .limit(10);
  res.json(rows.map(r => ({ brand: r.brandName ?? "Unknown", count: r.total })));
});

router.get("/inventory/stats/by-status", async (req, res): Promise<void> => {
  const rows = await db
    .select({ status: inventoryItemsTable.status, total: count() })
    .from(inventoryItemsTable).groupBy(inventoryItemsTable.status);
  res.json(rows.map(r => ({ status: r.status, count: r.total })));
});

router.get("/inventory/stats/by-pta", async (req, res): Promise<void> => {
  const rows = await db
    .select({ ptaStatus: inventoryItemsTable.ptaStatus, total: count() })
    .from(inventoryItemsTable).groupBy(inventoryItemsTable.ptaStatus);
  res.json(rows.map(r => ({ ptaStatus: r.ptaStatus, count: r.total })));
});

router.get("/inventory/low-stock", async (req, res): Promise<void> => { res.json([]); });

// Bulk sync all product stock counts from live inventory.
// Products are identified by brand; stock is summed across all models that
// share the same product slug (brand + model combo used at creation time).
router.post("/inventory/sync-shop", async (req, res): Promise<void> => {
  // Group inventory in-stock counts by (brandId, modelId)
  const groups = await db
    .select({
      brandId: inventoryItemsTable.brandId,
      modelId: inventoryItemsTable.modelId,
      stockCount: count(),
    })
    .from(inventoryItemsTable)
    .where(eq(inventoryItemsTable.status, "in_stock"))
    .groupBy(inventoryItemsTable.brandId, inventoryItemsTable.modelId);

  let synced = 0;
  for (const g of groups) {
    if (!g.brandId || !g.modelId) continue;
    // upsertProductFromInventory will create or update the matching product's
    // stock count and price — reuse it here for consistency.
    await upsertProductFromInventory(g.brandId, g.modelId, 0);
    synced++;
  }

  // Also zero-out products that have no more in_stock inventory
  const allProducts = await db.select({ id: productsTable.id, brandId: productsTable.brandId }).from(productsTable).where(isNotNull(productsTable.brandId));
  for (const product of allProducts) {
    if (!product.brandId) continue;
    const hasStock = groups.some(g => g.brandId === product.brandId && g.stockCount > 0);
    if (!hasStock) {
      await db.update(productsTable).set({ stockQty: 0 }).where(eq(productsTable.id, product.id));
    }
  }

  res.json({ synced });
});
router.get("/inventory/pta-pending", async (req, res): Promise<void> => {
  const items = await db.select().from(inventoryItemsTable).where(eq(inventoryItemsTable.ptaStatus, "pending")).limit(100);
  res.json(await Promise.all(items.map(enrichItem)));
});

router.get("/inventory/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [item] = await db.select().from(inventoryItemsTable).where(eq(inventoryItemsTable.id, id));
  if (!item) { res.status(404).json({ error: "Not found" }); return; }
  res.json(await enrichItem(item));
});

router.patch("/inventory/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);

  const [current] = await db.select().from(inventoryItemsTable).where(eq(inventoryItemsTable.id, id));
  if (!current) { res.status(404).json({ error: "Not found" }); return; }

  const updates: Record<string, unknown> = {};
  const fields = ["imei", "status", "ptaStatus", "psid", "sellingPrice", "landedCost", "notes", "grnNumber", "supplierInvoiceNumber", "trackerSimNo"];
  for (const f of fields) if (req.body[f] !== undefined) updates[f] = req.body[f];
  if (updates.sellingPrice !== undefined) updates.sellingPrice = String(updates.sellingPrice);
  if (updates.landedCost !== undefined) updates.landedCost = String(updates.landedCost);
  if (Object.keys(updates).length === 0) { res.status(400).json({ error: "No fields to update" }); return; }

  // When status is changed TO pta_blocked, save the current status so it can be restored later
  if (updates.status === "pta_blocked" && current.status !== "pta_blocked") {
    updates.previousStatus = current.status;
  }

  // When IMEI is updated on a pta_blocked item, auto-restore the previous status
  // and set ptaStatus to blocked (new IMEI needs PTA clearance)
  const isImeiUpdate = updates.imei !== undefined && String(updates.imei) !== current.imei;
  if (isImeiUpdate && current.status === "pta_blocked") {
    const restoreStatus = current.previousStatus ?? "in_stock";
    updates.status = restoreStatus;
    updates.previousStatus = null;
  }
  // Only reset PTA status for real phone IMEIs.
  // GPS trackers are identified by having a device_id — their PTA approval is model-based, not IMEI-based.
  // ICCIDs (SIM identifiers, start with "89", length > 15) are also PTA-exempt.
  const isIccidIdentifier = (v: string) => v.startsWith("89") && v.length > 15;
  const isGpsTracker = !!(current.deviceId && current.deviceId.trim());
  if (isImeiUpdate && !isGpsTracker && !isIccidIdentifier(String(updates.imei))) {
    updates.ptaStatus = "unpaid";
  }

  const [item] = await db.update(inventoryItemsTable).set(updates).where(eq(inventoryItemsTable.id, id)).returning();
  if (!item) { res.status(404).json({ error: "Not found" }); return; }

  // Log IMEI change to history
  if (isImeiUpdate) {
    const reason = typeof req.body.reason === "string" && req.body.reason.trim()
      ? req.body.reason.trim()
      : "Manual IMEI update";
    await db.insert(imeiHistoryTable).values({
      inventoryItemId: id,
      oldImei: current.imei,
      newImei: String(updates.imei),
      previousStatus: current.status === "pta_blocked" ? current.status : null,
      restoredStatus: current.status === "pta_blocked" ? String(updates.status) : null,
      reason,
      source: "manual",
    });
  }

  // Update shop product stock when status changes
  if (updates.status !== undefined) {
    await upsertProductFromInventory(item.brandId, item.modelId, parseFloat(String(item.sellingPrice)));
  }

  res.json(await enrichItem(item));
});

// GET /inventory/:id/imei-history — return IMEI change history for one item
router.get("/inventory/:id/imei-history", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const rows = await db.select().from(imeiHistoryTable)
    .where(eq(imeiHistoryTable.inventoryItemId, id))
    .orderBy(desc(imeiHistoryTable.changedAt));
  res.json(rows);
});

router.delete("/inventory/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [item] = await db.select().from(inventoryItemsTable).where(eq(inventoryItemsTable.id, id));
  await db.delete(inventoryItemsTable).where(eq(inventoryItemsTable.id, id));
  // Update product stock count after deletion
  if (item) await upsertProductFromInventory(item.brandId, item.modelId, parseFloat(String(item.sellingPrice)));
  res.sendStatus(204);
});

export default router;
