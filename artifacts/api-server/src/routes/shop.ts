import { Router, type IRouter } from "express";
import { eq, ilike, and, count, sql, or, gt } from "drizzle-orm";
import { db, productsTable, webOrdersTable, webOrderItemsTable, brandsTable, categoriesTable, integrationSettingsTable, companySettingsTable, shopCustomersTable, shopSessionsTable, customersTable, walletTransactionsTable, webOrderReturnsTable, invoicesTable } from "@workspace/db";
import { hashPassword, verifyPassword, generateToken } from "../lib/auth.js";
import { getAuth, clerkClient } from "@clerk/express";
import { sendPushToAdmins, sendPushToUser } from "../lib/push";
import { sendPasswordReset } from "../lib/mailer";
import { sendSms, sendWhatsApp } from "../lib/sms";
import { generateOtp, storeOtp, verifyOtp, sendOtpViaChannel } from "../lib/otp";
import { verifyRecaptcha } from "../lib/recaptcha.js";

type ShopSessionData = { customerId: number; name: string; email: string | null; mobile: string | null; username: string | null };

// Memory cache — speeds up the common case; DB is the source of truth (survives restarts)
const shopSessionCache = new Map<string, { data: ShopSessionData; expiresAt: number }>();

async function storeShopSession(token: string, data: ShopSessionData): Promise<void> {
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  shopSessionCache.set(token, { data, expiresAt: expiresAt.getTime() });
  await db.insert(shopSessionsTable).values({
    token,
    customerId: data.customerId,
    name: data.name,
    email: data.email,
    mobile: data.mobile,
    username: data.username,
    expiresAt,
  });
}

async function getShopSession(req: { headers: { authorization?: string } }): Promise<ShopSessionData | null> {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return null;
  const token = auth.slice(7);

  // Check memory cache first
  const cached = shopSessionCache.get(token);
  if (cached) {
    if (cached.expiresAt > Date.now()) return cached.data;
    shopSessionCache.delete(token);
  }

  // Fall back to DB (handles server restart — cache was lost but DB row persists)
  const [row] = await db.select().from(shopSessionsTable)
    .where(and(eq(shopSessionsTable.token, token), gt(shopSessionsTable.expiresAt, new Date())));
  if (!row) return null;

  const data: ShopSessionData = { customerId: row.customerId, name: row.name, email: row.email, mobile: row.mobile, username: row.username };
  shopSessionCache.set(token, { data, expiresAt: row.expiresAt.getTime() });
  return data;
}

async function deleteShopSession(token: string): Promise<void> {
  shopSessionCache.delete(token);
  await db.delete(shopSessionsTable).where(eq(shopSessionsTable.token, token));
}

const router: IRouter = Router();

async function buildProduct(p: typeof productsTable.$inferSelect) {
  const [brand] = p.brandId ? await db.select({ name: brandsTable.name }).from(brandsTable).where(eq(brandsTable.id, p.brandId)) : [null];
  const [cat] = p.categoryId ? await db.select({ name: categoriesTable.name }).from(categoriesTable).where(eq(categoriesTable.id, p.categoryId)) : [null];

  let gallery: string[] = [];
  if (p.galleryImages) {
    try { gallery = JSON.parse(p.galleryImages); } catch { gallery = []; }
  }

  return {
    ...p,
    brandName: brand?.name ?? null,
    categoryName: cat?.name ?? null,
    price: parseFloat(String(p.price)),
    salePrice: p.salePrice ? parseFloat(String(p.salePrice)) : null,
    costPrice: p.costPrice ? parseFloat(String(p.costPrice)) : null,
    shortDescription: p.shortDescription ?? null,
    longDescription: p.longDescription ?? null,
    featuredImage: p.featuredImage ?? null,
    galleryImages: gallery,
    tags: p.tags ? p.tags.split(",").map(t => t.trim()).filter(Boolean) : [],
    brandId: p.brandId ?? null,
    categoryId: p.categoryId ?? null,
    stockCount: p.stockQty ?? 0,
    sku: p.sku ?? null,
    barcode: p.barcode ?? null,
    metaTitle: p.metaTitle ?? null,
    metaDescription: p.metaDescription ?? null,
    createdAt: p.createdAt.toISOString(),
  };
}

// Public: list published products
router.get("/shop/products", async (req, res): Promise<void> => {
  const page = parseInt(String(req.query.page ?? "1"), 10);
  const limit = parseInt(String(req.query.limit ?? "20"), 10);
  const offset = (page - 1) * limit;
  const search = String(req.query.search ?? "");
  const featured = req.query.featured;
  const brandId = req.query.brandId ? parseInt(String(req.query.brandId), 10) : undefined;
  const categoryId = req.query.categoryId ? parseInt(String(req.query.categoryId), 10) : undefined;
  const sort = String(req.query.sort ?? "newest");

  const conditions = [eq(productsTable.published, true)];
  if (search) conditions.push(ilike(productsTable.title, `%${search}%`));
  if (featured === "true") conditions.push(eq(productsTable.featured, true));
  if (brandId) conditions.push(eq(productsTable.brandId, brandId));
  if (categoryId) conditions.push(eq(productsTable.categoryId, categoryId));
  const where = and(...conditions);

  const [{ total }] = await db.select({ total: count() }).from(productsTable).where(where);

  let orderBy;
  if (sort === "price_asc") orderBy = sql`${productsTable.price}::numeric asc`;
  else if (sort === "price_desc") orderBy = sql`${productsTable.price}::numeric desc`;
  else orderBy = sql`${productsTable.createdAt} desc`;

  // Single JOIN query — eliminates N+1 (was: 2 extra queries per product)
  const rawProducts = await db
    .select({ product: productsTable, brandName: brandsTable.name, categoryName: categoriesTable.name })
    .from(productsTable)
    .leftJoin(brandsTable, eq(productsTable.brandId, brandsTable.id))
    .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
    .where(where)
    .limit(limit)
    .offset(offset)
    .orderBy(orderBy);

  const products = rawProducts.map(({ product: p, brandName, categoryName }) => {
    let gallery: string[] = [];
    if (p.galleryImages) { try { gallery = JSON.parse(p.galleryImages); } catch { gallery = []; } }
    return {
      ...p,
      brandName: brandName ?? null,
      categoryName: categoryName ?? null,
      price: parseFloat(String(p.price)),
      salePrice: p.salePrice ? parseFloat(String(p.salePrice)) : null,
      costPrice: p.costPrice ? parseFloat(String(p.costPrice)) : null,
      shortDescription: p.shortDescription ?? null,
      longDescription: p.longDescription ?? null,
      featuredImage: p.featuredImage ?? null,
      galleryImages: gallery,
      tags: p.tags ? p.tags.split(",").map(t => t.trim()).filter(Boolean) : [],
      brandId: p.brandId ?? null,
      categoryId: p.categoryId ?? null,
      stockCount: p.stockQty ?? 0,
      sku: p.sku ?? null,
      barcode: p.barcode ?? null,
      metaTitle: p.metaTitle ?? null,
      metaDescription: p.metaDescription ?? null,
      createdAt: p.createdAt.toISOString(),
    };
  });

  res.json({ products, total, page });
});

// Public: get product by slug
router.get("/shop/products/:slug", async (req, res): Promise<void> => {
  const slug = Array.isArray(req.params.slug) ? req.params.slug[0] : req.params.slug;
  const [product] = await db.select().from(productsTable).where(and(eq(productsTable.slug, slug), eq(productsTable.published, true)));
  if (!product) { res.status(404).json({ error: "Product not found" }); return; }
  res.json(await buildProduct(product));
});

// Public: XML Sitemap for search engines
// Public: fetch SEO/Google config (GA Measurement ID, Search Console verification)
router.get("/shop/seo-config", async (req, res): Promise<void> => {
  const [gaRow] = await db.select().from(integrationSettingsTable).where(eq(integrationSettingsTable.type, "google_analytics"));
  const [scRow] = await db.select().from(integrationSettingsTable).where(eq(integrationSettingsTable.type, "google_search_console"));
  const [company] = await db.select({ companyName: companySettingsTable.companyName, logo: companySettingsTable.logo, gLogo: companySettingsTable.gLogo, favicon: companySettingsTable.favicon, banner: companySettingsTable.banner, primaryColor: companySettingsTable.primaryColor, borderRadius: companySettingsTable.borderRadius }).from(companySettingsTable);

  let gaId: string | null = null;
  let scVerification: string | null = null;

  if (gaRow?.enabled && gaRow.config) {
    try { const cfg = JSON.parse(gaRow.config) as Record<string, string>; gaId = cfg.measurementId ?? null; } catch { /* ignore */ }
  }
  if (scRow?.enabled && scRow.config) {
    try { const cfg = JSON.parse(scRow.config) as Record<string, string>; scVerification = cfg.verificationTag ?? null; } catch { /* ignore */ }
  }

  res.json({
    gaId,
    scVerification,
    companyName: company?.companyName ?? "Geem",
    logo: company?.logo ?? null,
    gLogo: company?.gLogo ?? null,
    favicon: company?.favicon ?? null,
    banner: company?.banner ?? null,
    primaryColor: company?.primaryColor ?? "#2563eb",
    borderRadius: company?.borderRadius ?? "md",
  });
});

router.get("/sitemap.xml", async (req, res): Promise<void> => {
  const products = await db.select({ slug: productsTable.slug, createdAt: productsTable.createdAt }).from(productsTable).where(eq(productsTable.published, true));
  const categories = await db.select({ id: categoriesTable.id }).from(categoriesTable).where(eq(categoriesTable.active, true));

  const base = "https://geem.pk";
  const staticUrls = [
    { loc: `${base}/`, priority: "1.0", changefreq: "daily" },
    { loc: `${base}/shop`, priority: "1.0", changefreq: "daily" },
    { loc: `${base}/shop/products`, priority: "0.9", changefreq: "daily" },
    { loc: `${base}/shop/track`, priority: "0.6", changefreq: "monthly" },
    { loc: `${base}/about`, priority: "0.5", changefreq: "monthly" },
    { loc: `${base}/contact`, priority: "0.5", changefreq: "monthly" },
    { loc: `${base}/faq`, priority: "0.5", changefreq: "monthly" },
    { loc: `${base}/privacy`, priority: "0.3", changefreq: "yearly" },
    { loc: `${base}/terms`, priority: "0.3", changefreq: "yearly" },
    { loc: `${base}/returns`, priority: "0.4", changefreq: "monthly" },
    { loc: `${base}/shipping`, priority: "0.4", changefreq: "monthly" },
  ];

  const productUrls = products.map(p => ({
    loc: `${base}/shop/products/${p.slug}`,
    lastmod: p.createdAt.toISOString().split("T")[0],
    priority: "0.8",
    changefreq: "weekly",
  }));

  const categoryUrls = categories.map(c => ({
    loc: `${base}/shop/category/${c.id}`,
    priority: "0.7",
    changefreq: "weekly",
  }));

  const allUrls = [...staticUrls, ...productUrls, ...categoryUrls];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allUrls.map(u => `  <url>
    <loc>${u.loc}</loc>${"lastmod" in u ? `\n    <lastmod>${u.lastmod}</lastmod>` : ""}
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join("\n")}
</urlset>`;

  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.send(xml);
});

// Public: place order
router.post("/shop/orders", async (req, res): Promise<void> => {
  const { customerName, customerMobile, customerEmail, customerAddress, customerCity, paymentMethod, transactionId, items, visitorFp, recaptchaToken } = req.body;
  if (!customerName || !customerMobile || !customerAddress || !items?.length) {
    res.status(400).json({ error: "Name, mobile, address, and items required" });
    return;
  }

  const captcha = await verifyRecaptcha(recaptchaToken as string | undefined, "order");
  if (!captcha.ok) { res.status(400).json({ error: captcha.error ?? "Security check failed" }); return; }
  const subtotal = items.reduce((s: number, i: { qty: number; price: number }) => s + i.qty * i.price, 0);
  const shipping = 200;
  const orderTotal = subtotal + shipping;

  // Wallet payment: verify session and check balance
  let walletCrmCustomerId: number | null = null;
  if (paymentMethod === "wallet") {
    const session = await getShopSession(req);
    if (!session) { res.status(401).json({ error: "Please sign in to pay with wallet" }); return; }
    const conditions = [];
    if (session.email)  conditions.push(eq(customersTable.email,  session.email));
    if (session.mobile) conditions.push(eq(customersTable.mobile, session.mobile));
    if (conditions.length === 0) { res.status(400).json({ error: "No wallet linked to this account" }); return; }
    const [crm] = await db.select({ id: customersTable.id, walletBalance: customersTable.walletBalance })
      .from(customersTable).where(or(...conditions));
    if (!crm) { res.status(400).json({ error: "No wallet linked to this account" }); return; }
    const balance = parseFloat(String(crm.walletBalance ?? "0"));
    if (balance < orderTotal) {
      res.status(400).json({ error: `Insufficient wallet balance (Rs ${balance.toLocaleString()})` });
      return;
    }
    walletCrmCustomerId = crm.id;
  }

  const orderNumber = `ORD-${Date.now().toString().slice(-8)}`;
  const [wo] = await db.insert(webOrdersTable).values({
    orderNumber,
    customerName,
    customerMobile,
    customerEmail,
    customerAddress,
    customerCity: customerCity || "",
    paymentMethod: paymentMethod || "cod",
    transactionId,
    status: "new",
    paymentStatus: paymentMethod === "cod" ? "cod" : paymentMethod === "wallet" ? "paid" : "pending",
    subtotal: String(subtotal),
    shipping: String(shipping),
    total: String(orderTotal),
    visitorFp: visitorFp || null,
  }).returning();

  // Deduct wallet balance after order is created
  if (paymentMethod === "wallet" && walletCrmCustomerId !== null) {
    const [crm] = await db.select({ walletBalance: customersTable.walletBalance })
      .from(customersTable).where(eq(customersTable.id, walletCrmCustomerId));
    const currentBalance = parseFloat(String(crm?.walletBalance ?? "0"));
    const newBalance = currentBalance - orderTotal;
    await db.update(customersTable).set({ walletBalance: String(newBalance) }).where(eq(customersTable.id, walletCrmCustomerId));
    await db.insert(walletTransactionsTable).values({
      customerId: walletCrmCustomerId,
      type: "debit",
      amount: String(orderTotal),
      balanceAfter: String(newBalance),
      description: `Shop order ${orderNumber}`,
      reference: orderNumber,
    });
  }
  for (const item of items) {
    const qty = parseFloat(String(item.qty ?? 1));
    const price = parseFloat(String(item.price));
    let description = `Product #${item.productId}`;
    if (item.productId) {
      const [prod] = await db.select({ title: productsTable.title }).from(productsTable).where(eq(productsTable.id, item.productId));
      if (prod) description = prod.title;
    }
    await db.insert(webOrderItemsTable).values({
      webOrderId: wo.id,
      productId: item.productId,
      description,
      qty: String(qty),
      price: String(price),
      amount: String(qty * price),
    });
  }
  const orderItems = await db.select().from(webOrderItemsTable).where(eq(webOrderItemsTable.webOrderId, wo.id));

  sendPushToAdmins({
    title: "🛒 New Shop Order",
    body: `${customerName} — Rs ${(subtotal + shipping).toLocaleString()} (${orderNumber})`,
    url: "/web-orders",
    tag: "new-order",
  }).catch(() => {});
  if (customerEmail) {
    sendPushToUser("shop", customerEmail, {
      title: "✅ Order Placed!",
      body: `Your order ${orderNumber} has been received. We'll confirm it soon.`,
      url: "/shop/account",
      tag: `order-${orderNumber}`,
    }).catch(() => {});
  }
  res.status(201).json({
    id: wo.id,
    orderNumber: wo.orderNumber,
    status: wo.status,
    total: parseFloat(String(wo.total)),
    items: orderItems.map(i => ({ description: i.description, qty: parseFloat(String(i.qty)), price: parseFloat(String(i.price)), amount: parseFloat(String(i.amount)) })),
  });
});

// Public: get orders by customer email
router.get("/shop/orders/by-email", async (req, res): Promise<void> => {
  const email = String(req.query.email ?? "").trim();
  if (!email || !email.includes("@")) {
    res.status(400).json({ error: "Valid email required" });
    return;
  }
  const orders = await db.select().from(webOrdersTable).where(eq(webOrdersTable.customerEmail, email)).orderBy(sql`${webOrdersTable.createdAt} desc`);
  const result = await Promise.all(orders.map(async wo => {
    const items = await db.select().from(webOrderItemsTable).where(eq(webOrderItemsTable.webOrderId, wo.id));
    return {
      id: wo.id,
      orderNumber: wo.orderNumber,
      status: wo.status,
      paymentStatus: wo.paymentStatus,
      customerName: wo.customerName,
      total: parseFloat(String(wo.total)),
      courierCn: wo.courierCn ?? null,
      createdAt: wo.createdAt.toISOString(),
      items: items.map(i => ({
        description: i.description, qty: parseFloat(String(i.qty)), amount: parseFloat(String(i.amount)),
      })),
    };
  }));
  res.json(result);
});

// Public: track order by order number
router.get("/shop/orders/:orderNumber", async (req, res): Promise<void> => {
  const orderNumber = Array.isArray(req.params.orderNumber) ? req.params.orderNumber[0] : req.params.orderNumber;
  const [wo] = await db.select().from(webOrdersTable).where(eq(webOrdersTable.orderNumber, orderNumber));
  if (!wo) { res.status(404).json({ error: "Order not found" }); return; }
  const items = await db.select().from(webOrderItemsTable).where(eq(webOrderItemsTable.webOrderId, wo.id));
  res.json({
    id: wo.id,
    orderNumber: wo.orderNumber,
    status: wo.status,
    paymentStatus: wo.paymentStatus,
    customerName: wo.customerName,
    customerMobile: wo.customerMobile,
    customerCity: wo.customerCity,
    total: parseFloat(String(wo.total)),
    courierCn: wo.courierCn ?? null,
    courierName: null,
    createdAt: wo.createdAt.toISOString(),
    items: items.map(i => ({
      description: i.description, qty: parseFloat(String(i.qty)), price: parseFloat(String(i.price)), amount: parseFloat(String(i.amount)),
    })),
  });
});

// ─── Shop Customer Auth ───────────────────────────────────────────────────────

const pendingRegistrations = new Map<string, { name: string; username: string | null; email: string | null; mobile: string | null; passwordHash: string; channel: string }>();

// Step 1: Initiate registration — validate inputs, check duplicates, store pending, send OTP
router.post("/shop/auth/register/initiate", async (req, res): Promise<void> => {
  const { name, username, email, mobile, password, channel, recaptchaToken } = req.body as Record<string, string>;

  const captcha = await verifyRecaptcha(recaptchaToken, "register");
  if (!captcha.ok) { res.status(400).json({ error: captcha.error ?? "Security check failed" }); return; }

  if (!name?.trim() || !password) { res.status(400).json({ error: "Name and password are required" }); return; }
  if (!email?.trim() && !mobile?.trim()) { res.status(400).json({ error: "Email or mobile number is required" }); return; }
  if (password.length < 6) { res.status(400).json({ error: "Password must be at least 6 characters" }); return; }
  const c = channel as "email" | "sms" | "whatsapp";
  if (!c || !["email","sms","whatsapp"].includes(c)) { res.status(400).json({ error: "Please select a channel: email, sms, or whatsapp" }); return; }

  const emailLower = email?.trim().toLowerCase() || null;
  const mobileTrimmed = mobile?.trim() || null;
  const usernameLower = username?.trim().toLowerCase() || null;

  if (emailLower) {
    const [ex] = await db.select({ id: shopCustomersTable.id }).from(shopCustomersTable).where(eq(shopCustomersTable.email, emailLower));
    if (ex) { res.status(409).json({ error: "Email already registered" }); return; }
  }
  if (mobileTrimmed) {
    const [ex] = await db.select({ id: shopCustomersTable.id }).from(shopCustomersTable).where(eq(shopCustomersTable.mobile, mobileTrimmed));
    if (ex) { res.status(409).json({ error: "Mobile number already registered" }); return; }
  }
  if (usernameLower) {
    const [ex] = await db.select({ id: shopCustomersTable.id }).from(shopCustomersTable).where(eq(shopCustomersTable.username, usernameLower));
    if (ex) { res.status(409).json({ error: "Username already taken" }); return; }
  }

  const otp = generateOtp();
  const key = `reg:${emailLower ?? mobileTrimmed ?? usernameLower}`;
  const passwordHash = hashPassword(password);

  storeOtp(key, otp, "shop-register", { name: name.trim(), username: usernameLower, email: emailLower, mobile: mobileTrimmed, passwordHash });
  pendingRegistrations.set(key, { name: name.trim(), username: usernameLower, email: emailLower, mobile: mobileTrimmed, passwordHash, channel: c });

  const sendResult = await sendOtpViaChannel({
    channel: c, toEmail: emailLower, toMobile: mobileTrimmed, name: name.trim(), otp, purpose: "shop-register", expiryMinutes: 15,
  });

  if (!sendResult.ok) {
    res.status(500).json({ error: `Failed to send OTP via ${c}: ${sendResult.error}` });
    return;
  }

  res.json({ ok: true, sentVia: sendResult.sentVia, message: `Verification code sent via ${sendResult.sentVia}` });
});

// Step 2: Verify OTP and create account
router.post("/shop/auth/register/verify", async (req, res): Promise<void> => {
  const { code, email, mobile } = req.body as Record<string, string>;
  if (!code) { res.status(400).json({ error: "Verification code required" }); return; }

  const idLower = (email?.trim().toLowerCase() || mobile?.trim()) ?? "";
  if (!idLower) { res.status(400).json({ error: "Email or mobile required" }); return; }

  const key = `reg:${idLower}`;
  const result = verifyOtp(key, code.trim());
  if (!result.ok) { res.status(400).json({ error: result.error }); return; }

  const meta = result.metadata as { name: string; username: string | null; email: string | null; mobile: string | null; passwordHash: string };
  const [customer] = await db.insert(shopCustomersTable).values({
    name: meta.name, username: meta.username, email: meta.email, mobile: meta.mobile, passwordHash: meta.passwordHash,
  }).returning();

  pendingRegistrations.delete(key);

  const token = generateToken();
  const sessionData = { customerId: customer.id, name: customer.name, email: customer.email, mobile: customer.mobile, username: customer.username };
  await storeShopSession(token, sessionData);
  res.json({ token, customer: { id: customer.id, name: customer.name, username: customer.username, email: customer.email, mobile: customer.mobile } });
});

router.post("/shop/auth/login", async (req, res): Promise<void> => {
  const { identifier, password, recaptchaToken } = req.body as Record<string, string>;
  if (!identifier?.trim() || !password) { res.status(400).json({ error: "Identifier and password are required" }); return; }

  const captcha = await verifyRecaptcha(recaptchaToken, "login");
  if (!captcha.ok) { res.status(400).json({ error: captcha.error ?? "Security check failed" }); return; }

  const id = identifier.trim().toLowerCase();
  const idRaw = identifier.trim();
  let customer: typeof shopCustomersTable.$inferSelect | undefined;

  const rows = await db.select().from(shopCustomersTable).where(
    or(eq(shopCustomersTable.email, id), eq(shopCustomersTable.mobile, idRaw), eq(shopCustomersTable.username, id))
  );
  customer = rows[0];

  if (!customer || !verifyPassword(password, customer.passwordHash)) {
    res.status(401).json({ error: "Invalid credentials. Check your email/mobile/username and password." }); return;
  }

  const token = generateToken();
  const sessionData = { customerId: customer.id, name: customer.name, email: customer.email, mobile: customer.mobile, username: customer.username };
  await storeShopSession(token, sessionData);
  res.json({ token, customer: { id: customer.id, name: customer.name, username: customer.username, email: customer.email, mobile: customer.mobile } });
});

router.post("/shop/auth/google", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth?.userId) { res.status(401).json({ error: "Google sign-in failed. Please try again." }); return; }
  try {
    const clerkUser = await clerkClient.users.getUser(auth.userId);
    const email = (clerkUser.primaryEmailAddress?.emailAddress ?? clerkUser.emailAddresses[0]?.emailAddress ?? "").toLowerCase();
    if (!email) { res.status(400).json({ error: "Your Google account has no email address." }); return; }
    const name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ").trim() || email.split("@")[0];

    let [customer] = await db.select().from(shopCustomersTable).where(eq(shopCustomersTable.email, email));
    if (!customer) {
      const [created] = await db.insert(shopCustomersTable).values({
        name,
        email,
        passwordHash: hashPassword(generateToken()),
      }).returning();
      customer = created;
    }

    const token = generateToken();
    await storeShopSession(token, { customerId: customer.id, name: customer.name, email: customer.email, mobile: customer.mobile, username: customer.username });
    res.json({ token, customer: { id: customer.id, name: customer.name, username: customer.username, email: customer.email, mobile: customer.mobile } });
  } catch (err) {
    res.status(500).json({ error: "Google sign-in failed. Please try again." });
  }
});

router.get("/shop/auth/me", async (req, res): Promise<void> => {
  const session = await getShopSession(req);
  if (!session) { res.status(401).json({ error: "Unauthorized" }); return; }
  res.json({ id: session.customerId, name: session.name, email: session.email, mobile: session.mobile, username: session.username });
});

router.post("/shop/auth/logout", async (req, res): Promise<void> => {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) await deleteShopSession(auth.slice(7));
  res.json({ ok: true });
});

// Change password for logged-in shop customer
router.post("/shop/auth/change-password", async (req, res): Promise<void> => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) { res.status(401).json({ error: "Unauthorized" }); return; }
  const session = await getShopSession(req);
  if (!session) { res.status(401).json({ error: "Session expired — please sign in again" }); return; }

  const { currentPassword, newPassword } = req.body as Record<string, string>;
  if (!currentPassword || !newPassword) { res.status(400).json({ error: "Current and new password required" }); return; }
  if (String(newPassword).length < 6) { res.status(400).json({ error: "New password must be at least 6 characters" }); return; }

  const [customer] = await db.select().from(shopCustomersTable).where(eq(shopCustomersTable.id, session.customerId));
  if (!customer) { res.status(404).json({ error: "Account not found" }); return; }
  if (!verifyPassword(String(currentPassword), customer.passwordHash)) {
    res.status(400).json({ error: "Current password is incorrect" }); return;
  }
  await db.update(shopCustomersTable).set({ passwordHash: hashPassword(String(newPassword)) }).where(eq(shopCustomersTable.id, session.customerId));
  res.json({ ok: true });
});

// In-memory store for shop password reset tokens
const shopResetTokens = new Map<string, { customerId: number; expires: number }>();

// Step 1: Initiate password reset — find user, send OTP via chosen channel
router.post("/shop/auth/forgot-password", async (req, res): Promise<void> => {
  const { identifier, channel } = req.body as Record<string, string>;
  if (!identifier?.trim()) { res.status(400).json({ error: "Email or mobile number required" }); return; }
  const c = channel as "email" | "sms" | "whatsapp";
  if (!c || !["email","sms","whatsapp"].includes(c)) { res.status(400).json({ error: "Please select a channel: email, sms, or whatsapp" }); return; }

  const id = identifier.trim();
  const idLower = id.toLowerCase();

  const [customer] = await db.select().from(shopCustomersTable).where(
    or(eq(shopCustomersTable.email, idLower), eq(shopCustomersTable.mobile, id))
  );

  if (!customer) {
    res.json({ ok: true, sent: false });
    return;
  }

  const otp = generateOtp();
  const key = `rst:${customer.id}`;
  storeOtp(key, otp, "shop-reset", { customerId: customer.id });

  const sendResult = await sendOtpViaChannel({
    channel: c, toEmail: customer.email, toMobile: customer.mobile, name: customer.name, otp, purpose: "shop-reset", expiryMinutes: 15,
  });

  if (!sendResult.ok) {
    req.log?.error?.({ err: sendResult.error, channel: c, customerId: customer.id }, "Failed to send shop reset OTP") ?? void 0;
    res.status(500).json({ error: `Failed to send OTP via ${c}: ${sendResult.error}` });
    return;
  }

  req.log?.info?.({ customerId: customer.id, sentVia: sendResult.sentVia }, "Shop password reset OTP sent") ?? void 0;
  res.json({ ok: true, sent: true, sentVia: sendResult.sentVia });
});

// Step 2: Verify OTP and get a reset token
router.post("/shop/auth/forgot-password/verify", async (req, res): Promise<void> => {
  const { identifier, code } = req.body as Record<string, string>;
  if (!identifier || !code) { res.status(400).json({ error: "Identifier and verification code required" }); return; }

  const id = identifier.trim().toLowerCase();
  const [customer] = await db.select().from(shopCustomersTable).where(
    or(eq(shopCustomersTable.email, id), eq(shopCustomersTable.mobile, identifier.trim()))
  );
  if (!customer) { res.status(400).json({ error: "Account not found" }); return; }

  const key = `rst:${customer.id}`;
  const result = verifyOtp(key, code.trim());
  if (!result.ok) { res.status(400).json({ error: result.error }); return; }

  // Issue a short-lived reset token (5 minutes)
  const token = generateToken();
  shopResetTokens.set(token, { customerId: customer.id, expires: Date.now() + 5 * 60 * 1000 });

  res.json({ ok: true, resetToken: token });
});

// Reset password using token from forgot-password
router.post("/shop/auth/reset-password", async (req, res): Promise<void> => {
  const { resetToken, newPassword } = req.body as Record<string, string>;
  if (!resetToken || !newPassword) { res.status(400).json({ error: "Reset token and new password required" }); return; }
  if (String(newPassword).length < 8) { res.status(400).json({ error: "Password must be at least 8 characters" }); return; }

  const entry = shopResetTokens.get(resetToken);
  if (!entry || entry.expires < Date.now()) {
    shopResetTokens.delete(resetToken);
    res.status(400).json({ error: "Invalid or expired reset token. Please request a new one." });
    return;
  }

  await db.update(shopCustomersTable).set({ passwordHash: hashPassword(String(newPassword)) }).where(eq(shopCustomersTable.id, entry.customerId));
  shopResetTokens.delete(resetToken);
  res.json({ ok: true });
});

// Get full profile (includes address)
router.get("/shop/auth/profile", async (req, res): Promise<void> => {
  const session = await getShopSession(req);
  if (!session) { res.status(401).json({ error: "Unauthorized" }); return; }
  const [c] = await db.select().from(shopCustomersTable).where(eq(shopCustomersTable.id, session.customerId));
  if (!c) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ id: c.id, name: c.name, email: c.email, mobile: c.mobile, username: c.username, address: c.address ?? "", city: c.city ?? "", country: c.country ?? "Pakistan" });
});

// Update profile (name, mobile, address, city, country)
router.patch("/shop/auth/profile", async (req, res): Promise<void> => {
  const session = await getShopSession(req);
  if (!session) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { name, mobile, address, city, country } = req.body as Record<string, string>;
  if (name !== undefined && !name?.trim()) { res.status(400).json({ error: "Name cannot be empty" }); return; }
  const patch: Record<string, string> = {};
  if (name?.trim())    patch["name"]    = name.trim();
  if (mobile !== undefined) patch["mobile"]  = mobile.trim() || "";
  if (address !== undefined) patch["address"] = address.trim();
  if (city !== undefined)    patch["city"]    = city.trim();
  if (country !== undefined) patch["country"] = country.trim() || "Pakistan";
  await db.update(shopCustomersTable).set(patch).where(eq(shopCustomersTable.id, session.customerId));
  // Refresh session name if changed
  if (patch["name"]) session.name = patch["name"];
  const [c] = await db.select().from(shopCustomersTable).where(eq(shopCustomersTable.id, session.customerId));
  res.json({ id: c.id, name: c.name, email: c.email, mobile: c.mobile, username: c.username, address: c.address ?? "", city: c.city ?? "", country: c.country ?? "Pakistan" });
});

// Wallet balance — linked via email or mobile to the CRM customer
router.get("/shop/auth/wallet", async (req, res): Promise<void> => {
  const session = await getShopSession(req);
  if (!session) { res.status(401).json({ error: "Unauthorized" }); return; }

  const conditions = [];
  if (session.email) conditions.push(eq(customersTable.email, session.email));
  if (session.mobile) conditions.push(eq(customersTable.mobile, session.mobile));

  if (conditions.length === 0) { res.json({ balance: 0, transactions: [] }); return; }

  const [crm] = await db.select({ id: customersTable.id, walletBalance: customersTable.walletBalance })
    .from(customersTable).where(or(...conditions));

  if (!crm) { res.json({ balance: 0, transactions: [] }); return; }

  const transactions = await db.select().from(walletTransactionsTable)
    .where(eq(walletTransactionsTable.customerId, crm.id))
    .orderBy(walletTransactionsTable.createdAt)
    .limit(50);

  res.json({
    balance: parseFloat(String(crm.walletBalance ?? "0")),
    transactions: transactions.map(t => ({
      id: t.id, type: t.type, amount: parseFloat(String(t.amount)),
      balanceAfter: parseFloat(String(t.balanceAfter)),
      description: t.description, reference: t.reference ?? null,
      createdAt: t.createdAt.toISOString(),
    })),
  });
});

// Submit a return request for a delivered order
router.post("/shop/auth/return-request", async (req, res): Promise<void> => {
  const session = await getShopSession(req);
  if (!session) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { orderNumber, reason, description } = req.body as Record<string, string>;
  if (!orderNumber?.trim() || !reason?.trim() || !description?.trim()) {
    res.status(400).json({ error: "orderNumber, reason, and description are required" }); return;
  }
  // Verify the order belongs to this customer
  const conditions = [];
  if (session.email) conditions.push(eq(webOrdersTable.customerEmail, session.email));
  if (session.mobile) conditions.push(eq(webOrdersTable.customerMobile, session.mobile));
  if (conditions.length === 0) { res.status(400).json({ error: "No identity on session" }); return; }
  const [order] = await db.select().from(webOrdersTable)
    .where(and(eq(webOrdersTable.orderNumber, orderNumber.trim()), or(...conditions)));
  if (!order) { res.status(404).json({ error: "Order not found or does not belong to your account" }); return; }
  if (order.status !== "delivered") { res.status(400).json({ error: "Only delivered orders can be returned" }); return; }
  // Check for duplicate pending request
  const [existing] = await db.select({ id: webOrderReturnsTable.id })
    .from(webOrderReturnsTable)
    .where(and(eq(webOrderReturnsTable.orderNumber, orderNumber.trim()), eq(webOrderReturnsTable.status, "pending")));
  if (existing) { res.status(409).json({ error: "A return request for this order is already pending" }); return; }
  const [row] = await db.insert(webOrderReturnsTable).values({
    orderNumber: orderNumber.trim(),
    customerName: session.name,
    customerEmail: session.email,
    customerMobile: session.mobile ?? "",
    reason: reason.trim(),
    description: description.trim(),
  }).returning();
  sendPushToAdmins({
    title: "↩️ New Return Request",
    body: `${session.name} — Order ${orderNumber.trim()} (${reason.trim().replace(/_/g, " ")})`,
    url: "/web-orders",
    tag: "return-request",
    requireInteraction: true,
  }).catch(() => {});
  res.status(201).json(row);
});

// Get return requests for logged-in shop customer
router.get("/shop/auth/return-requests", async (req, res): Promise<void> => {
  const session = await getShopSession(req);
  if (!session) { res.status(401).json({ error: "Unauthorized" }); return; }
  const conditions = [];
  if (session.email) conditions.push(eq(webOrderReturnsTable.customerEmail, session.email));
  if (session.mobile) conditions.push(eq(webOrderReturnsTable.customerMobile, session.mobile));
  if (conditions.length === 0) { res.json([]); return; }
  const rows = await db.select().from(webOrderReturnsTable).where(or(...conditions))
    .orderBy(webOrderReturnsTable.createdAt);
  res.json(rows.reverse());
});

// Unified notification feed for logged-in shop customer
router.get("/shop/auth/notifications", async (req, res): Promise<void> => {
  const session = await getShopSession(req);
  if (!session) { res.status(401).json({ error: "Unauthorized" }); return; }

  const conditions: ReturnType<typeof eq>[] = [];
  if (session.email) conditions.push(eq(webOrdersTable.customerEmail, session.email));
  if (session.mobile) conditions.push(eq(webOrdersTable.customerMobile, session.mobile));

  const retConditions: ReturnType<typeof eq>[] = [];
  if (session.email) retConditions.push(eq(webOrderReturnsTable.customerEmail, session.email));
  if (session.mobile) retConditions.push(eq(webOrderReturnsTable.customerMobile, session.mobile));

  const [orders, returns_] = await Promise.all([
    conditions.length > 0
      ? db.select({
          id: webOrdersTable.id, orderNumber: webOrdersTable.orderNumber, status: webOrdersTable.status,
          total: webOrdersTable.total, createdAt: webOrdersTable.createdAt,
        }).from(webOrdersTable).where(or(...conditions)).orderBy(webOrdersTable.createdAt)
      : Promise.resolve([]),
    retConditions.length > 0
      ? db.select({ id: webOrderReturnsTable.id, orderNumber: webOrderReturnsTable.orderNumber, status: webOrderReturnsTable.status, reason: webOrderReturnsTable.reason, createdAt: webOrderReturnsTable.createdAt })
          .from(webOrderReturnsTable).where(or(...retConditions)).orderBy(webOrderReturnsTable.createdAt)
      : Promise.resolve([]),
  ]);

  // Look up invoice IDs for shipped/delivered orders
  const orderNumbers = orders.map(o => o.orderNumber);
  const invoiceMap = new Map<string, number>();
  if (orderNumbers.length) {
    const invoiceRows = await db.select({ invoiceNumber: invoicesTable.invoiceNumber, id: invoicesTable.id })
      .from(invoicesTable).where(or(...orderNumbers.map(n => eq(invoicesTable.invoiceNumber, n))));
    for (const r of invoiceRows) invoiceMap.set(r.invoiceNumber, r.id);
  }

  const orderNotifs = orders.map(o => ({
    id: `order-${o.id}`,
    type: "order" as const,
    orderNumber: o.orderNumber,
    title: orderTitle(o.status),
    subtitle: `Order ${o.orderNumber} · Rs ${parseFloat(String(o.total)).toLocaleString()}`,
    status: o.status,
    createdAt: o.createdAt.toISOString(),
    invoiceId: invoiceMap.get(o.orderNumber) ?? null,
  }));

  const returnNotifs = returns_.map(r => ({
    id: `return-${r.id}`,
    type: "return" as const,
    orderNumber: r.orderNumber,
    title: returnTitle(r.status),
    subtitle: `Return for ${r.orderNumber} · ${r.reason}`,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
  }));

  const all = [...orderNotifs, ...returnNotifs].sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  res.json(all);
});

function orderTitle(status: string): string {
  const map: Record<string, string> = {
    new: "Order placed — awaiting confirmation",
    confirmed: "Order confirmed",
    shipped: "Order shipped",
    delivered: "Order delivered",
    cancelled: "Order cancelled",
  };
  return map[status] ?? `Order ${status}`;
}

function returnTitle(status: string): string {
  const map: Record<string, string> = {
    pending: "Return request submitted",
    approved: "Return request approved",
    rejected: "Return request rejected",
    completed: "Return completed",
  };
  return map[status] ?? `Return ${status}`;
}

// Orders for logged-in shop customer (by email OR mobile)
router.get("/shop/auth/orders", async (req, res): Promise<void> => {
  const session = await getShopSession(req);
  if (!session) { res.status(401).json({ error: "Unauthorized" }); return; }

  const conditions = [];
  if (session.email) conditions.push(eq(webOrdersTable.customerEmail, session.email));
  if (session.mobile) conditions.push(eq(webOrdersTable.customerMobile, session.mobile));

  if (conditions.length === 0) { res.json([]); return; }

  const orders = await db.select().from(webOrdersTable).where(or(...conditions)).orderBy(webOrdersTable.createdAt);
  const result = await Promise.all(orders.map(async wo => {
    const items = await db.select().from(webOrderItemsTable).where(eq(webOrderItemsTable.webOrderId, wo.id));
    // Look up CRM invoice: by webOrderId first (reliable), then by matching invoice number
    const [crmInv] = await db.select({ id: invoicesTable.id })
      .from(invoicesTable).where(or(eq(invoicesTable.webOrderId, wo.id), eq(invoicesTable.invoiceNumber, wo.orderNumber)));
    const invoiceUrl = crmInv?.id ? `${(process.env.PUBLIC_URL ?? "https://geem.pk").replace(/\/$/, "")}/api/invoices/${crmInv.id}/print` : null;
    return {
      id: wo.id, orderNumber: wo.orderNumber, status: wo.status, paymentStatus: wo.paymentStatus,
      customerName: wo.customerName, customerEmail: wo.customerEmail ?? null, customerMobile: wo.customerMobile,
      customerAddress: wo.customerAddress, customerCity: wo.customerCity,
      paymentMethod: wo.paymentMethod, transactionId: wo.transactionId ?? null,
      subtotal: parseFloat(String(wo.subtotal)), shipping: parseFloat(String(wo.shipping ?? 0)),
      total: parseFloat(String(wo.total)), courierCn: wo.courierCn ?? null,
      rejectionReason: wo.rejectionReason ?? null, createdAt: wo.createdAt.toISOString(),
      invoiceUrl,
      items: items.map(i => ({ description: i.description, qty: parseFloat(String(i.qty)), price: parseFloat(String(i.price)), amount: parseFloat(String(i.amount)) })),
    };
  }));
  res.json(result.reverse());
});

export default router;
