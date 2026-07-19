import { Router, type IRouter } from "express";
import { eq, sql, sum, count, and, ilike } from "drizzle-orm";
import {
  db, shipmentsTable, serviceTicketsTable, vaultEntriesTable,
  usersTable, companySettingsTable, invoiceSettingsTable,
  chatSessionsTable, chatMessagesTable, couriersTable, customersTable,
  inventoryItemsTable, invoicesTable, invoiceItemsTable, paymentsTable, walletTransactionsTable,
} from "@workspace/db";
import { hashPassword, verifyPassword, getUserIdFromToken } from "../lib/auth";
import { generateOtp, storeOtp, verifyOtp, sendOtpViaChannel } from "../lib/otp";

const router: IRouter = Router();

const pendingAdminUsers = new Map<string, { name: string; username: string | null; email: string; mobile: string | null; passwordHash: string; role: string; active: boolean; permissions: unknown | null; channel: string }>();

// --- SHIPMENTS ---
router.get("/shipments", async (req, res): Promise<void> => {
  const shipments = await db.select().from(shipmentsTable).orderBy(sql`${shipmentsTable.createdAt} desc`);
  const result = await Promise.all(shipments.map(async s => {
    const [courier] = await db.select({ name: couriersTable.name }).from(couriersTable).where(eq(couriersTable.id, s.courierId));
    return {
      ...s,
      courierName: courier?.name ?? "",
      codAmount: parseFloat(String(s.codAmount)),
      shippingCharges: parseFloat(String(s.shippingCharges)),
      invoiceId: s.invoiceId ?? null,
      webOrderId: s.webOrderId ?? null,
      cn: s.cn ?? null,
      slipLink: s.slipLink ?? null,
      weight: s.weight ?? null,
      createdAt: s.createdAt.toISOString(),
    };
  }));
  res.json(result);
});

router.post("/shipments", async (req, res): Promise<void> => {
  const { invoiceId, webOrderId, courierId, destination, weight, pieces, codAmount, shippingCharges } = req.body;
  if (!courierId || !destination) { res.status(400).json({ error: "courierId and destination required" }); return; }
  const [s] = await db.insert(shipmentsTable).values({
    invoiceId, webOrderId, courierId, destination,
    weight: weight ? String(weight) : undefined,
    pieces, codAmount: String(codAmount ?? 0),
    shippingCharges: String(shippingCharges ?? 0), status: "pending",
  }).returning();
  const [courier] = await db.select({ name: couriersTable.name }).from(couriersTable).where(eq(couriersTable.id, courierId));
  res.status(201).json({ ...s, courierName: courier?.name ?? "", codAmount: parseFloat(String(s.codAmount)), shippingCharges: parseFloat(String(s.shippingCharges)), invoiceId: s.invoiceId ?? null, webOrderId: s.webOrderId ?? null, cn: null, slipLink: null, weight: s.weight ?? null, createdAt: s.createdAt.toISOString() });
});

router.get("/shipments/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [s] = await db.select().from(shipmentsTable).where(eq(shipmentsTable.id, id));
  if (!s) { res.status(404).json({ error: "Not found" }); return; }
  const [courier] = await db.select({ name: couriersTable.name }).from(couriersTable).where(eq(couriersTable.id, s.courierId));
  res.json({ ...s, courierName: courier?.name ?? "", codAmount: parseFloat(String(s.codAmount)), shippingCharges: parseFloat(String(s.shippingCharges)), invoiceId: s.invoiceId ?? null, webOrderId: s.webOrderId ?? null, cn: s.cn ?? null, slipLink: s.slipLink ?? null, weight: s.weight ?? null, createdAt: s.createdAt.toISOString() });
});

router.patch("/shipments/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const updates: Record<string, unknown> = {};
  if (req.body.status !== undefined) updates.status = req.body.status;
  if (req.body.cn !== undefined) updates.cn = req.body.cn;
  if (req.body.slipLink !== undefined) updates.slipLink = req.body.slipLink;
  const [s] = await db.update(shipmentsTable).set(updates).where(eq(shipmentsTable.id, id)).returning();
  if (!s) { res.status(404).json({ error: "Not found" }); return; }
  const [courier] = await db.select({ name: couriersTable.name }).from(couriersTable).where(eq(couriersTable.id, s.courierId));
  res.json({ ...s, courierName: courier?.name ?? "", codAmount: parseFloat(String(s.codAmount)), shippingCharges: parseFloat(String(s.shippingCharges)), invoiceId: s.invoiceId ?? null, webOrderId: s.webOrderId ?? null, cn: s.cn ?? null, slipLink: s.slipLink ?? null, weight: s.weight ?? null, createdAt: s.createdAt.toISOString() });
});

// --- SERVICE TICKETS ---
router.get("/service-tickets", async (req, res): Promise<void> => {
  const status = String(req.query.status ?? "");
  let tickets = await db.select().from(serviceTicketsTable).orderBy(sql`${serviceTicketsTable.createdAt} desc`).limit(100);
  if (status) tickets = tickets.filter(t => t.status === status);
  if (req.query.customerId) tickets = tickets.filter(t => t.customerId === parseInt(String(req.query.customerId), 10));
  const result = await Promise.all(tickets.map(async t => {
    const [c] = await db.select({ name: customersTable.name }).from(customersTable).where(eq(customersTable.id, t.customerId));
    return { ...t, customerName: c?.name ?? "", invoiceId: t.invoiceId ?? null, inventoryItemId: t.inventoryItemId ?? null, imei: t.imei ?? null, productName: t.productName ?? null, resolutionNotes: t.resolutionNotes ?? null, replacementItemId: t.replacementItemId ?? null, createdAt: t.createdAt.toISOString() };
  }));
  res.json(result);
});

router.post("/service-tickets", async (req, res): Promise<void> => {
  const { customerId, invoiceId, inventoryItemId, issueDescription } = req.body;
  if (!customerId || !issueDescription) { res.status(400).json({ error: "customerId and issueDescription required" }); return; }
  const num = `TKT-${Date.now().toString().slice(-6)}`;
  const [ticket] = await db.insert(serviceTicketsTable).values({ ticketNumber: num, customerId, invoiceId, inventoryItemId, issueDescription, status: "received", warrantyValid: false }).returning();
  const [c] = await db.select({ name: customersTable.name }).from(customersTable).where(eq(customersTable.id, customerId));
  res.status(201).json({ ...ticket, customerName: c?.name ?? "", invoiceId: ticket.invoiceId ?? null, inventoryItemId: ticket.inventoryItemId ?? null, imei: null, productName: null, resolutionNotes: null, replacementItemId: null, createdAt: ticket.createdAt.toISOString() });
});

router.get("/service-tickets/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [ticket] = await db.select().from(serviceTicketsTable).where(eq(serviceTicketsTable.id, id));
  if (!ticket) { res.status(404).json({ error: "Not found" }); return; }
  const [c] = await db.select({ name: customersTable.name }).from(customersTable).where(eq(customersTable.id, ticket.customerId));
  res.json({ ...ticket, customerName: c?.name ?? "", invoiceId: ticket.invoiceId ?? null, inventoryItemId: ticket.inventoryItemId ?? null, imei: ticket.imei ?? null, productName: ticket.productName ?? null, resolutionNotes: ticket.resolutionNotes ?? null, replacementItemId: ticket.replacementItemId ?? null, createdAt: ticket.createdAt.toISOString() });
});

router.patch("/service-tickets/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const updates: Record<string, unknown> = {};
  if (req.body.status !== undefined) updates.status = req.body.status;
  if (req.body.resolutionNotes !== undefined) updates.resolutionNotes = req.body.resolutionNotes;
  if (req.body.replacementItemId !== undefined) updates.replacementItemId = req.body.replacementItemId;
  const [ticket] = await db.update(serviceTicketsTable).set(updates).where(eq(serviceTicketsTable.id, id)).returning();
  if (!ticket) { res.status(404).json({ error: "Not found" }); return; }
  const [c] = await db.select({ name: customersTable.name }).from(customersTable).where(eq(customersTable.id, ticket.customerId));
  res.json({ ...ticket, customerName: c?.name ?? "", invoiceId: ticket.invoiceId ?? null, inventoryItemId: ticket.inventoryItemId ?? null, imei: ticket.imei ?? null, productName: ticket.productName ?? null, resolutionNotes: ticket.resolutionNotes ?? null, replacementItemId: ticket.replacementItemId ?? null, createdAt: ticket.createdAt.toISOString() });
});

// --- VAULT ---
router.get("/vault", async (req, res): Promise<void> => {
  const entries = await db.select().from(vaultEntriesTable).orderBy(vaultEntriesTable.name);
  res.json(entries.map(e => ({ ...e, loginUrl: e.loginUrl ?? null, ipPort: e.ipPort ?? null, smsApnNotes: e.smsApnNotes ?? null, remarks: e.remarks ?? null, createdAt: e.createdAt.toISOString() })));
});

router.post("/vault", async (req, res): Promise<void> => {
  const { name, url, loginUrl, ipPort, smsApnNotes, remarks, favorite } = req.body;
  if (!name || !url) { res.status(400).json({ error: "name and url required" }); return; }
  const [entry] = await db.insert(vaultEntriesTable).values({ name, url, loginUrl, ipPort, smsApnNotes, remarks, favorite: !!favorite }).returning();
  res.status(201).json({ ...entry, loginUrl: entry.loginUrl ?? null, ipPort: entry.ipPort ?? null, smsApnNotes: entry.smsApnNotes ?? null, remarks: entry.remarks ?? null, createdAt: entry.createdAt.toISOString() });
});

router.patch("/vault/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const updates: Record<string, unknown> = {};
  const fields = ["name", "url", "loginUrl", "ipPort", "smsApnNotes", "remarks", "favorite"];
  for (const f of fields) if (req.body[f] !== undefined) updates[f] = req.body[f];
  const [entry] = await db.update(vaultEntriesTable).set(updates).where(eq(vaultEntriesTable.id, id)).returning();
  if (!entry) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ ...entry, loginUrl: entry.loginUrl ?? null, ipPort: entry.ipPort ?? null, smsApnNotes: entry.smsApnNotes ?? null, remarks: entry.remarks ?? null, createdAt: entry.createdAt.toISOString() });
});

router.delete("/vault/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  await db.delete(vaultEntriesTable).where(eq(vaultEntriesTable.id, id));
  res.sendStatus(204);
});

// --- USERS ---
function serializeUser(u: typeof usersTable.$inferSelect) {
  return {
    id: u.id, name: u.name, username: u.username ?? null, email: u.email,
    mobile: u.mobile ?? null, role: u.role, active: u.active,
    permissions: (u.permissions as Record<string, { view: boolean; add: boolean; edit: boolean; delete: boolean }> | null) ?? null,
    lastLogin: u.lastLogin?.toISOString() ?? null, createdAt: u.createdAt.toISOString(),
  };
}

router.get("/users", async (req, res): Promise<void> => {
  const users = await db.select().from(usersTable).orderBy(usersTable.name);
  res.json(users.map(serializeUser));
});

// Step 1: Initiate admin user creation — send OTP to the new user's contact
router.post("/users/initiate", async (req, res): Promise<void> => {
  const { name, username, email, mobile, password, role, active, permissions, channel } = req.body;
  if (!name || !email || !password || !role) { res.status(400).json({ error: "name, email, password, role required" }); return; }
  const c = channel as "email" | "sms" | "whatsapp";
  if (!c || !["email","sms","whatsapp"].includes(c)) { res.status(400).json({ error: "Please select a channel: email, sms, or whatsapp" }); return; }

  const emailLower = String(email).toLowerCase().trim();
  const [ex] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, emailLower));
  if (ex) { res.status(409).json({ error: "Email already registered" }); return; }

  const otp = generateOtp();
  const key = `usr:${emailLower}`;
  const passwordHash = hashPassword(password);

  storeOtp(key, otp, "admin-create", { name, email: emailLower, role });
  pendingAdminUsers.set(key, {
    name, username: username ?? null, email: emailLower, mobile: mobile ?? null,
    passwordHash, role, active: active !== false, permissions: permissions ?? null, channel: c,
  });

  const sendResult = await sendOtpViaChannel({
    channel: c, toEmail: emailLower, toMobile: mobile ?? null, name: String(name), otp,
    purpose: "admin-create", expiryMinutes: 15,
  });

  if (!sendResult.ok) {
    res.status(500).json({ error: `Failed to send OTP via ${c}: ${sendResult.error}` });
    return;
  }

  res.json({ ok: true, sentVia: sendResult.sentVia, message: `Verification code sent via ${sendResult.sentVia}` });
});

// Step 2: Verify OTP and create the user
router.post("/users/verify", async (req, res): Promise<void> => {
  const { email, code } = req.body;
  if (!email || !code) { res.status(400).json({ error: "email and verification code required" }); return; }

  const emailLower = String(email).toLowerCase().trim();
  const key = `usr:${emailLower}`;
  const result = verifyOtp(key, String(code).trim());
  if (!result.ok) { res.status(400).json({ error: result.error }); return; }

  const pending = pendingAdminUsers.get(key);
  if (!pending) { res.status(400).json({ error: "No pending registration found. Please start over." }); return; }

  const [user] = await db.insert(usersTable).values({
    name: pending.name, username: pending.username, email: pending.email, mobile: pending.mobile,
    passwordHash: pending.passwordHash, role: pending.role, active: pending.active,
    permissions: pending.permissions,
  }).returning();

  pendingAdminUsers.delete(key);
  res.status(201).json(serializeUser(user));
});

// Legacy direct creation (kept for backwards compatibility, but Settings will use OTP flow)
router.post("/users", async (req, res): Promise<void> => {
  const { name, username, email, mobile, password, role, active, permissions } = req.body;
  if (!name || !email || !password || !role) { res.status(400).json({ error: "name, email, password, role required" }); return; }
  const passwordHash = hashPassword(password);
  const [user] = await db.insert(usersTable).values({
    name, username: username ?? null, email, mobile: mobile ?? null,
    passwordHash, role, active: active !== false,
    permissions: permissions ?? null,
  }).returning();
  res.status(201).json(serializeUser(user));
});

router.patch("/users/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const updates: Record<string, unknown> = {};
  if (req.body.name !== undefined) updates.name = req.body.name;
  if (req.body.username !== undefined) updates.username = req.body.username ?? null;
  if (req.body.email !== undefined) updates.email = req.body.email;
  if (req.body.mobile !== undefined) updates.mobile = req.body.mobile ?? null;
  if (req.body.role !== undefined) updates.role = req.body.role;
  if (req.body.active !== undefined) updates.active = req.body.active;
  if (req.body.permissions !== undefined) updates.permissions = req.body.permissions ?? null;
  const [user] = await db.update(usersTable).set(updates).where(eq(usersTable.id, id)).returning();
  if (!user) { res.status(404).json({ error: "Not found" }); return; }
  res.json(serializeUser(user));
});

router.delete("/users/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  await db.delete(usersTable).where(eq(usersTable.id, id));
  res.sendStatus(204);
});

router.post("/users/:id/reset-password", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { newPassword } = req.body;
  if (!newPassword || String(newPassword).length < 8) { res.status(400).json({ error: "newPassword must be at least 8 characters" }); return; }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  await db.update(usersTable).set({ passwordHash: hashPassword(String(newPassword)) }).where(eq(usersTable.id, id));
  res.json({ success: true });
});

// Current user's own profile (from token)
router.get("/auth/me", async (req, res): Promise<void> => {
  const token = (req.headers.authorization ?? "").replace("Bearer ", "").trim();
  if (!token) { res.status(401).json({ error: "Unauthorized" }); return; }
  const userId = await getUserIdFromToken(token);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) { res.status(404).json({ error: "Not found" }); return; }
  res.json(serializeUser(user));
});

router.patch("/auth/me", async (req, res): Promise<void> => {
  const token = (req.headers.authorization ?? "").replace("Bearer ", "").trim();
  if (!token) { res.status(401).json({ error: "Unauthorized" }); return; }
  const userId = await getUserIdFromToken(token);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const updates: Record<string, unknown> = {};
  if (req.body.name !== undefined) updates.name = req.body.name;
  if (req.body.username !== undefined) updates.username = req.body.username ?? null;
  if (req.body.email !== undefined) updates.email = req.body.email;
  if (req.body.mobile !== undefined) updates.mobile = req.body.mobile ?? null;
  const [user] = await db.update(usersTable).set(updates).where(eq(usersTable.id, userId)).returning();
  if (!user) { res.status(404).json({ error: "Not found" }); return; }
  res.json(serializeUser(user));
});

router.post("/auth/change-password", async (req, res): Promise<void> => {
  const token = (req.headers.authorization ?? "").replace("Bearer ", "").trim();
  if (!token) { res.status(401).json({ error: "Unauthorized" }); return; }
  const userId = await getUserIdFromToken(token);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) { res.status(400).json({ error: "currentPassword and newPassword are required" }); return; }
  if (String(newPassword).length < 8) { res.status(400).json({ error: "New password must be at least 8 characters" }); return; }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  if (!verifyPassword(String(currentPassword), user.passwordHash)) { res.status(400).json({ error: "Current password is incorrect" }); return; }
  await db.update(usersTable).set({ passwordHash: hashPassword(String(newPassword)) }).where(eq(usersTable.id, userId));
  res.json({ success: true });
});

// --- SETTINGS ---
router.get("/settings/company", async (req, res): Promise<void> => {
  let [settings] = await db.select().from(companySettingsTable);
  if (!settings) {
    [settings] = await db.insert(companySettingsTable).values({ companyName: "Geem", currency: "PKR", timezone: "Asia/Karachi", address: "Office #1, Yellow Building, Behind TCS Office\nKutchery Rd, Ahmadpur East\nDistt Bahawalpur, Pakistan 63350", phone: "0307-8680005", email: "info@geem.pk", whatsappNumber: "0307-8680005", taxNumber: "6943433" }).returning();
  }
  res.json({ ...settings, logo: settings.logo ?? null, gLogo: settings.gLogo ?? null, favicon: settings.favicon ?? null, banner: settings.banner ?? null, address: settings.address ?? null, phone: settings.phone ?? null, email: settings.email ?? null, taxNumber: settings.taxNumber ?? null, whatsappNumber: settings.whatsappNumber ?? null });
});

router.patch("/settings/company", async (req, res): Promise<void> => {
  let [settings] = await db.select().from(companySettingsTable);
  const updates: Record<string, unknown> = {};
  const fields = ["companyName", "logo", "gLogo", "favicon", "banner", "address", "phone", "fax", "email", "website", "currency", "taxNumber", "whatsappNumber", "primaryColor", "borderRadius"];
  for (const f of fields) if (req.body[f] !== undefined) updates[f] = req.body[f];
  updates.updatedAt = new Date();
  if (!settings) {
    [settings] = await db.insert(companySettingsTable).values({ companyName: "Geem", currency: "PKR", timezone: "Asia/Karachi", address: "Office #1, Yellow Building, Behind TCS Office\nKutchery Rd, Ahmadpur East\nDistt Bahawalpur, Pakistan 63350", phone: "0307-8680005", email: "info@geem.pk", whatsappNumber: "0307-8680005", taxNumber: "6943433", ...updates }).returning();
  } else {
    [settings] = await db.update(companySettingsTable).set(updates).where(eq(companySettingsTable.id, settings.id)).returning();
  }
  res.json({ ...settings, logo: settings.logo ?? null, gLogo: settings.gLogo ?? null, favicon: settings.favicon ?? null, banner: settings.banner ?? null, address: settings.address ?? null, phone: settings.phone ?? null, fax: settings.fax ?? null, email: settings.email ?? null, website: settings.website ?? null, taxNumber: settings.taxNumber ?? null, whatsappNumber: settings.whatsappNumber ?? null });
});

router.get("/settings/invoice", async (req, res): Promise<void> => {
  let [settings] = await db.select().from(invoiceSettingsTable);
  if (!settings) {
    [settings] = await db.insert(invoiceSettingsTable).values({}).returning();
  }
  res.json({ ...settings, defaultTaxRate: parseFloat(String(settings.defaultTaxRate)), defaultNotes: settings.defaultNotes ?? null, defaultFooter: settings.defaultFooter ?? null });
});

router.patch("/settings/invoice", async (req, res): Promise<void> => {
  let [settings] = await db.select().from(invoiceSettingsTable);
  const updates: Record<string, unknown> = {};
  const fields = ["logo", "invoicePrefix", "nextInvoiceNumber", "defaultPaymentTerms", "defaultTaxRate", "defaultNotes", "defaultFooter", "pdfTemplate"];
  for (const f of fields) if (req.body[f] !== undefined) updates[f] = req.body[f];
  if (updates.defaultTaxRate) updates.defaultTaxRate = String(updates.defaultTaxRate);
  updates.updatedAt = new Date();
  if (!settings) {
    [settings] = await db.insert(invoiceSettingsTable).values({ ...updates }).returning();
  } else {
    [settings] = await db.update(invoiceSettingsTable).set(updates).where(eq(invoiceSettingsTable.id, settings.id)).returning();
  }
  res.json({ ...settings, logo: settings.logo ?? null, defaultTaxRate: parseFloat(String(settings.defaultTaxRate)), defaultNotes: settings.defaultNotes ?? null, defaultFooter: settings.defaultFooter ?? null });
});

// --- REPORTS ---
router.get("/reports/sales", async (req, res): Promise<void> => {
  const from = String(req.query.from ?? "");
  const to = String(req.query.to ?? "");
  const invoices = await db.select().from(invoicesTable).where(eq(invoicesTable.status, "paid")).limit(100);
  const totalAmount = invoices.reduce((s, i) => s + parseFloat(String(i.total)), 0);
  res.json({
    totalAmount,
    totalInvoices: invoices.length,
    averageInvoiceValue: invoices.length ? totalAmount / invoices.length : 0,
    items: await Promise.all(invoices.slice(0, 20).map(async i => {
      const [c] = await db.select({ name: customersTable.name }).from(customersTable).where(eq(customersTable.id, i.customerId));
      return { id: i.id, invoiceNumber: i.invoiceNumber, customerName: c?.name ?? "", amount: parseFloat(String(i.total)), status: i.status, date: String(i.date) };
    })),
  });
});

router.get("/reports/stock", async (req, res): Promise<void> => {
  const [totalCount] = await db.select({ c: count() }).from(inventoryItemsTable);
  const [inStock] = await db.select({ c: count() }).from(inventoryItemsTable).where(eq(inventoryItemsTable.status, "in_stock"));
  const [sold] = await db.select({ c: count() }).from(inventoryItemsTable).where(eq(inventoryItemsTable.status, "sold"));
  const [reserved] = await db.select({ c: count() }).from(inventoryItemsTable).where(eq(inventoryItemsTable.status, "reserved"));
  const [damaged] = await db.select({ c: count() }).from(inventoryItemsTable).where(eq(inventoryItemsTable.status, "damaged"));
  res.json({
    totalItems: totalCount.c,
    byStatus: { in_stock: inStock.c, sold: sold.c, reserved: reserved.c, damaged: damaged.c },
    items: [],
  });
});

router.get("/reports/profit-loss", async (req, res): Promise<void> => {
  const allPaid = await db.select().from(invoicesTable).where(eq(invoicesTable.status, "paid"));
  const revenue = allPaid.reduce((s, i) => s + parseFloat(String(i.total)), 0);

  // Real COGS: sum landed_cost of all sold inventory items
  const [cogsRow] = await db
    .select({ total: sql<string>`COALESCE(SUM(${inventoryItemsTable.landedCost}), 0)` })
    .from(inventoryItemsTable).where(eq(inventoryItemsTable.status, "sold"));
  const cogs = parseFloat(String(cogsRow?.total ?? "0"));

  // COD invoices still in "draft" = pending collection
  const codDraft = await db.select({ total: invoicesTable.total })
    .from(invoicesTable)
    .where(and(eq(invoicesTable.status, "draft"), ilike(invoicesTable.notes, "%paid via cod%")));
  const codPendingAmount = codDraft.reduce((s, i) => s + parseFloat(String(i.total)), 0);

  const grossProfit = revenue - cogs;
  res.json({
    revenue, cogs, grossProfit, expenses: 0, courierCharges: 0, netProfit: grossProfit,
    codPendingAmount, codPendingCount: codDraft.length,
    chartData: [],
  });
});

router.get("/reports/accounting-summary", async (req, res): Promise<void> => {
  // Revenue: all paid invoices
  const [revRow] = await db.select({ total: sql<string>`COALESCE(SUM(${invoicesTable.total}), 0)` })
    .from(invoicesTable).where(eq(invoicesTable.status, "paid"));
  const totalRevenue = parseFloat(String(revRow?.total ?? "0"));

  // COD pending collection (draft invoices with COD payment method)
  const codDraft = await db.select({ total: invoicesTable.total })
    .from(invoicesTable)
    .where(and(eq(invoicesTable.status, "draft"), ilike(invoicesTable.notes, "%paid via cod%")));
  const codPendingAmount = codDraft.reduce((s, i) => s + parseFloat(String(i.total)), 0);

  // Partial/overdue receivables (invoices where paid < total, not draft COD)
  const partialInvoices = await db.select({ total: invoicesTable.total, paid: invoicesTable.paid })
    .from(invoicesTable).where(eq(invoicesTable.status, "partial"));
  const receivables = partialInvoices.reduce((s, i) =>
    s + (parseFloat(String(i.total)) - parseFloat(String(i.paid))), 0);

  // Wallet liability
  const [walletRow] = await db.select({ total: sql<string>`COALESCE(SUM(${customersTable.walletBalance}), 0)` })
    .from(customersTable);
  const walletLiability = parseFloat(String(walletRow?.total ?? "0"));

  // Inventory value (in_stock items)
  const [invValRow] = await db.select({
    value: sql<string>`COALESCE(SUM(${inventoryItemsTable.landedCost}), 0)`,
    count: sql<string>`COUNT(*)`,
  }).from(inventoryItemsTable).where(eq(inventoryItemsTable.status, "in_stock"));
  const inventoryValue = parseFloat(String(invValRow?.value ?? "0"));
  const inventoryCount = parseInt(String(invValRow?.count ?? "0"), 10);

  // COGS: sold inventory
  const [cogsRow] = await db.select({ total: sql<string>`COALESCE(SUM(${inventoryItemsTable.landedCost}), 0)` })
    .from(inventoryItemsTable).where(eq(inventoryItemsTable.status, "sold"));
  const cogs = parseFloat(String(cogsRow?.total ?? "0"));

  // Revenue by payment method (from payments table)
  const paymentsByMethod = await db.select({
    method: paymentsTable.method,
    total: sql<string>`SUM(${paymentsTable.amount})`,
    count: sql<number>`COUNT(*)`,
  }).from(paymentsTable).groupBy(paymentsTable.method);

  res.json({
    totalRevenue,
    codPendingAmount,
    codPendingCount: codDraft.length,
    receivables,
    walletLiability,
    inventoryValue,
    inventoryCount,
    cogs,
    grossProfit: totalRevenue - cogs,
    paymentsByMethod: paymentsByMethod.map(r => ({
      method: r.method,
      total: parseFloat(String(r.total ?? "0")),
      count: Number(r.count),
    })),
  });
});

router.get("/reports/customer-dues", async (req, res): Promise<void> => {
  const customers = await db.select().from(customersTable).where(eq(customersTable.active, true)).limit(100);
  const result = customers.map(c => ({
    customerId: c.id, customerName: c.name, customerMobile: c.mobile,
    totalInvoiced: 0, totalPaid: 0, balanceDue: parseFloat(String(c.ledgerBalance)),
  })).filter(c => c.balanceDue !== 0);
  res.json(result);
});

// --- CHAT ---
router.get("/chat/sessions", async (req, res): Promise<void> => {
  const status = String(req.query.status ?? "");
  let sessions = await db.select().from(chatSessionsTable).orderBy(sql`${chatSessionsTable.createdAt} desc`).limit(100);
  if (status) sessions = sessions.filter(s => s.status === status);
  res.json(sessions.map(s => ({ ...s, customerName: s.customerName ?? null, customerEmail: s.customerEmail ?? null, lastMessage: s.lastMessage ?? null, createdAt: s.createdAt.toISOString() })));
});

router.get("/chat/sessions/:id/messages", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const messages = await db.select().from(chatMessagesTable).where(eq(chatMessagesTable.sessionId, id)).orderBy(chatMessagesTable.createdAt);
  res.json(messages.map(m => ({ ...m, createdAt: m.createdAt.toISOString() })));
});

router.post("/chat/sessions/:id/messages", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { content, role } = req.body;
  if (!content) { res.status(400).json({ error: "content required" }); return; }
  const [message] = await db.insert(chatMessagesTable).values({ sessionId: id, content, role: role ?? "agent" }).returning();
  await db.update(chatSessionsTable).set({ lastMessage: content }).where(eq(chatSessionsTable.id, id));
  res.status(201).json({ ...message, createdAt: message.createdAt.toISOString() });
});

export default router;
