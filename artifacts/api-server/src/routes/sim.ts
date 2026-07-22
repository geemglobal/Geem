import { Router, type IRouter } from "express";
import crypto from "crypto";
import {
  db, simCustomersTable, simPlansTable, simCustomerSimsTable,
  simTopupsTable, simSmsMessagesTable, simOrderHistoryTable, usersTable,
  simAlertSettingsTable, simNotificationsTable, simPlanRequestsTable,
  simSessionsTable,
} from "@workspace/db";
import { and, or, eq, desc, asc, sql, gte, lt } from "drizzle-orm";
import { hashPassword, verifyPassword, generateToken } from "../lib/auth";
import { getAuth, clerkClient } from "@clerk/express";
import { runExpiryAlertJob } from "../lib/sim-expiry-alerts";

const router: IRouter = Router();

/* eslint-disable-next-line @typescript-eslint/no-unnecessary-condition */
// Lazy — only blow up when a SIM route is actually called, not at startup.
const APP_KEY: string = process.env.SIM_APP_KEY ?? "";
const APP_SECRET: string = process.env.SIM_APP_SECRET ?? "";

function requireSimKeys(): void {
  if (!APP_KEY || !APP_SECRET) {
    throw new Error("SIM_APP_KEY and SIM_APP_SECRET environment variables are required for SIM routes");
  }
}
const API_BASE = "https://api.yourchat.top";

interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data: T;
}

function serializeValue(v: unknown): string {
  if (Array.isArray(v)) return `[${v.join(", ")}]`;
  return String(v);
}

function createSign(params: Record<string, unknown>, timestamp: string): string {
  const entries = Object.entries(params)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .sort(([a], [b]) => a.localeCompare(b));
  let sb = "";
  for (const [k, v] of entries) sb += `${k}=${serializeValue(v)}&`;
  sb += `key=${APP_KEY}`;
  const kMessage = crypto.createHmac("sha256", Buffer.from(APP_SECRET, "utf8")).update(sb, "utf8").digest();
  const kTimestamp = crypto.createHmac("sha256", kMessage).update(timestamp, "utf8").digest();
  return kTimestamp.toString("hex").toLowerCase();
}

async function callApi<T>(endpoint: string, params: Record<string, unknown> = {}): Promise<ApiResponse<T>> {
  requireSimKeys();
  const timestamp = Date.now().toString();
  const sign = createSign(params, timestamp);
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", AppKey: APP_KEY, Sign: sign, Timestamp: timestamp },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(`IoT API HTTP error: ${res.status} ${res.statusText}`);
  return res.json() as Promise<ApiResponse<T>>;
}

// ─── Session TTLs ─────────────────────────────────────────────────────────
const ADMIN_SESSION_TTL_MS    = 24 * 60 * 60 * 1000;       // 24 hours
const CUSTOMER_SESSION_TTL_MS = 7  * 24 * 60 * 60 * 1000;  // 7 days
// Default PIN assigned to new SIM accounts (IoT convention: ICCID + this PIN).
// Override via SIM_DEFAULT_PASSWORD env var if a stricter default is needed.
const DEFAULT_PASSWORD = process.env.SIM_DEFAULT_PASSWORD ?? "123456";

/**
 * Currency-aware balance check + deduction.
 * Returns an error message string on failure, or null on success.
 * Deduction is applied atomically before the provider call so the
 * customer cannot place multiple concurrent orders against the same balance.
 */
async function checkAndDeductBalance(
  customerId: number, currency: string, amount: number
): Promise<string | null> {
  const cur = currency.toUpperCase();
  let result: { affected: number }[];
  if (cur === "PKR") {
    result = await db.execute(
      sql`UPDATE sim_customers SET balance_pkr = balance_pkr - ${amount} WHERE id = ${customerId} AND balance_pkr >= ${amount} RETURNING id`
    ) as unknown as { affected: number }[];
  } else if (cur === "USD") {
    result = await db.execute(
      sql`UPDATE sim_customers SET balance_usd = balance_usd - ${amount} WHERE id = ${customerId} AND balance_usd >= ${amount} RETURNING id`
    ) as unknown as { affected: number }[];
  } else {
    result = await db.execute(
      sql`UPDATE sim_customers SET balance_cny = balance_cny - ${amount} WHERE id = ${customerId} AND balance_cny >= ${amount} RETURNING id`
    ) as unknown as { affected: number }[];
  }
  const rows = Array.isArray(result) ? result : (result as any).rows ?? [];
  if (rows.length === 0) {
    const [c] = await db.select().from(simCustomersTable).where(eq(simCustomersTable.id, customerId)).limit(1);
    if (!c) return "Customer not found";
    const current = parseFloat(cur === "PKR" ? c.balancePkr : cur === "USD" ? c.balanceUsd : c.balanceCny) || 0;
    return `Insufficient ${cur} balance (available: ${current.toFixed(2)}, required: ${amount})`;
  }
  return null;
}

/** Refund balance when provider call fails after a deduction. */
async function refundBalance(customerId: number, currency: string, amount: number): Promise<void> {
  const cur = currency.toUpperCase();
  if (cur === "PKR") {
    await db.update(simCustomersTable).set({ balancePkr: sql`balance_pkr + ${amount}` }).where(eq(simCustomersTable.id, customerId));
  } else if (cur === "USD") {
    await db.update(simCustomersTable).set({ balanceUsd: sql`balance_usd + ${amount}` }).where(eq(simCustomersTable.id, customerId));
  } else {
    await db.update(simCustomersTable).set({ balanceCny: sql`balance_cny + ${amount}` }).where(eq(simCustomersTable.id, customerId));
  }
}

function getToken(req: { headers: { authorization?: string } }): string {
  return (req.headers.authorization ?? "").replace("Bearer ", "").trim();
}

async function getCustomerFromToken(token: string) {
  const now = new Date();
  const [sess] = await db.select().from(simSessionsTable).where(
    and(eq(simSessionsTable.token, token), eq(simSessionsTable.role, "customer"))
  ).limit(1);
  if (!sess || sess.expiresAt < now) return null;
  if (!sess.customerId) return null;
  const [c] = await db.select().from(simCustomersTable).where(eq(simCustomersTable.id, sess.customerId)).limit(1);
  return c ?? null;
}

async function getAdminFromToken(token: string) {
  const now = new Date();
  const [sess] = await db.select().from(simSessionsTable).where(
    and(eq(simSessionsTable.token, token), eq(simSessionsTable.role, "admin"))
  ).limit(1);
  if (!sess || sess.expiresAt < now) return null;
  if (!sess.userId) return null;
  const [u] = await db.select().from(usersTable).where(eq(usersTable.id, sess.userId)).limit(1);
  return u ?? null;
}

/** Prune expired sim_sessions rows (best-effort, non-blocking). */
function pruneExpiredSessions(): void {
  db.delete(simSessionsTable).where(lt(simSessionsTable.expiresAt, new Date())).catch(() => { /* ignore */ });
}

function simAdminAuth(handler: (req: Parameters<typeof router.get>[1] extends (...a: infer A) => unknown ? Parameters<(...a: A) => unknown>[0] : never, res: any) => Promise<void>) {
  return async (req: any, res: any): Promise<void> => {
    const token = getToken(req);
    const admin = await getAdminFromToken(token);
    if (!admin) { res.status(401).json({ code: 401, message: "Unauthorized", data: null }); return; }
    req.adminUser = admin;
    return handler(req, res);
  };
}

function simCustomerAuth(handler: (req: any, res: any) => Promise<void>) {
  return async (req: any, res: any): Promise<void> => {
    const token = getToken(req);
    const customer = await getCustomerFromToken(token);
    if (!customer) { res.status(401).json({ code: 401, message: "Unauthorized", data: null }); return; }
    if (!customer.isActive) { res.status(403).json({ code: 403, message: "Account deactivated", data: null }); return; }
    req.simCustomer = customer;
    return handler(req, res);
  };
}

/** Returns the SIM row if it belongs to the customer, or sends 403/404 and returns null. */
async function requireSimOwnership(
  iccid: string, customerId: number, res: any
): Promise<typeof simCustomerSimsTable.$inferSelect | null> {
  const [row] = await db.select().from(simCustomerSimsTable)
    .where(and(eq(simCustomerSimsTable.iccid, iccid), eq(simCustomerSimsTable.customerId, customerId)))
    .limit(1);
  if (!row) {
    res.status(403).json({ code: 403, message: "SIM not found in your account", data: null });
    return null;
  }
  return row;
}

// ─── Admin Auth ────────────────────────────────────────────────────────────

router.post("/sim/admin/login", async (req, res): Promise<void> => {
  try {
    const { identifier, password } = req.body as { identifier?: string; password?: string };
    if (!identifier || !password) {
      res.status(400).json({ code: 400, message: "Username and password required", data: null }); return;
    }
    const id = identifier.trim();
    const [user] = await db.select().from(usersTable).where(
      or(eq(usersTable.username, id), eq(usersTable.email, id))
    ).limit(1);
    if (!user || !user.active) {
      res.status(401).json({ code: 401, message: "Invalid credentials", data: null }); return;
    }
    if (!verifyPassword(password.trim(), user.passwordHash)) {
      res.status(401).json({ code: 401, message: "Invalid credentials", data: null }); return;
    }
    await db.update(usersTable).set({ lastLogin: new Date() }).where(eq(usersTable.id, user.id));
    const token = generateToken();
    const expiresAt = new Date(Date.now() + ADMIN_SESSION_TTL_MS);
    await db.insert(simSessionsTable).values({ token, role: "admin", userId: user.id, expiresAt });
    pruneExpiredSessions();
    res.json({ code: 200, message: "OK", data: { token, admin: { id: user.id, name: user.name, email: user.email, role: user.role } } });
  } catch (err) {
    req.log.error({ err }, "SIM admin login failed");
    res.status(500).json({ code: 500, message: "Login failed", data: null });
  }
});

router.post("/sim/admin/logout", simAdminAuth(async (req, res): Promise<void> => {
  const token = getToken(req);
  await db.delete(simSessionsTable).where(eq(simSessionsTable.token, token));
  res.json({ code: 200, message: "Logged out", data: null });
}));

router.get("/sim/admin/me", simAdminAuth(async (req: any, res): Promise<void> => {
  const a = req.adminUser;
  res.json({ code: 200, message: "OK", data: { id: a.id, name: a.name, email: a.email, role: a.role } });
}));

// ─── Admin: Dashboard ─────────────────────────────────────────────────────

router.get("/sim/admin/dashboard", simAdminAuth(async (req, res): Promise<void> => {
  try {
    const [balance, customers, plans, recentOrders, simCounts] = await Promise.all([
      callApi<{ balance: number; balanceUsd: number }>("/queryBalance"),
      db.select({ count: sql<number>`count(*)` }).from(simCustomersTable),
      db.select({ count: sql<number>`count(*)` }).from(simPlansTable).where(eq(simPlansTable.isActive, true)),
      db.select().from(simOrderHistoryTable).orderBy(desc(simOrderHistoryTable.createdAt)).limit(10),
      db.select({
        total: sql<number>`count(*)`,
        active: sql<number>`count(*) filter (where is_active = true)`,
        inactive: sql<number>`count(*) filter (where is_active = false)`,
      }).from(simCustomersTable),
    ]);
    // Attempt live card-state counts from IoT provider (non-blocking)
    let cardStats: { total?: number; active?: number; inactive?: number; suspended?: number } = {};
    try {
      const [activeCards, inactiveCards] = await Promise.all([
        callApi<{ total?: number; list?: unknown[] }>("/queryCardList", { status: 1, pageNum: 1, pageSize: 1 }),
        callApi<{ total?: number; list?: unknown[] }>("/queryCardList", { status: 0, pageNum: 1, pageSize: 1 }),
      ]);
      cardStats = {
        active: (activeCards.data as any)?.total ?? undefined,
        inactive: (inactiveCards.data as any)?.total ?? undefined,
      };
    } catch { /* live card stats unavailable — not fatal */ }

    res.json({
      code: 200, message: "OK", data: {
        balance: balance.data,
        customerCount: Number(customers[0]?.count ?? 0),
        activePlanCount: Number(plans[0]?.count ?? 0),
        recentOrders,
        simCounts: {
          totalCustomers: Number(simCounts[0]?.total ?? 0),
          activeCustomers: Number(simCounts[0]?.active ?? 0),
          inactiveCustomers: Number(simCounts[0]?.inactive ?? 0),
        },
        cardStats,
      },
    });
  } catch (err) {
    req.log.error({ err }, "SIM admin dashboard failed");
    res.status(500).json({ code: 500, message: "Failed", data: null });
  }
}));

// ─── Admin: Provider Balance ───────────────────────────────────────────────

router.get("/sim/admin/balance", simAdminAuth(async (req, res): Promise<void> => {
  try {
    res.json(await callApi("/queryBalance"));
  } catch (err) {
    req.log.error({ err }, "SIM balance fetch failed");
    res.status(502).json({ code: 502, message: "Failed to reach IoT API", data: null });
  }
}));

// ─── Admin: Regions & Coupons ─────────────────────────────────────────────

router.get("/sim/admin/regions", simAdminAuth(async (req, res): Promise<void> => {
  try {
    const params: Record<string, unknown> = {};
    if (req.query.name) params.name = String(req.query.name);
    res.json(await callApi("/queryRegionList", params));
  } catch (err) {
    req.log.error({ err }, "SIM regions fetch failed");
    res.status(502).json({ code: 502, message: "Failed to reach IoT API", data: null });
  }
}));

router.get("/sim/admin/provider-plans", simAdminAuth(async (req, res): Promise<void> => {
  try {
    const plans = await db.select().from(simPlansTable)
      .where(eq(simPlansTable.isActive, true))
      .orderBy(asc(simPlansTable.sortOrder), asc(simPlansTable.id));
    res.json({ code: 200, message: "OK", data: plans });
  } catch (err) {
    req.log.error({ err }, "SIM provider plans fetch failed");
    res.status(500).json({ code: 500, message: "Failed to fetch plans", data: null });
  }
}));

router.post("/sim/admin/cards/batch-order", simAdminAuth(async (req: any, res): Promise<void> => {
  try {
    const { iccids, planId, currency, regionId, remark } = req.body as {
      iccids: string[]; planId: number; currency?: string; regionId?: number; remark?: string;
    };
    if (!Array.isArray(iccids) || iccids.length === 0) {
      res.status(400).json({ code: 400, message: "iccids array is required", data: null }); return;
    }
    if (!planId) { res.status(400).json({ code: 400, message: "planId is required", data: null }); return; }
    // Resolve local DB plan → provider plan code
    const [plan] = await db.select().from(simPlansTable).where(eq(simPlansTable.id, planId)).limit(1);
    const providerPlanId = plan?.planCode ? Number(plan.planCode) : planId;
    const results: { iccid: string; code: number; orderNumber?: string; message?: string }[] = [];
    for (const iccid of iccids) {
      try {
        const params: Record<string, unknown> = { iccid, planId: providerPlanId };
        if (currency) params.currency = currency;
        if (regionId) params.regionId = regionId;
        if (remark) params.remark = remark;
        const r = await callApi<string>("/orderPlan", params);
        if (r.code === 200) {
          await db.insert(simOrderHistoryTable).values({
            iccid, action: "order", planId: String(providerPlanId),
            planName: plan?.planName ?? null, orderNumber: r.data, currency: currency ?? "CNY",
          }).catch(() => {});
        }
        results.push({ iccid, code: r.code, orderNumber: r.data ?? undefined, message: r.message });
      } catch {
        results.push({ iccid, code: 502, message: "Provider error" });
      }
    }
    const success = results.filter(r => r.code === 200).length;
    res.json({ code: 200, message: `${success}/${iccids.length} succeeded`, data: results });
  } catch (err) {
    req.log.error({ err }, "SIM batch order failed");
    res.status(500).json({ code: 500, message: "Batch order failed", data: null });
  }
}));

router.get("/sim/admin/coupons", simAdminAuth(async (req, res): Promise<void> => {
  try {
    const params: Record<string, unknown> = {};
    if (req.query.carrier) params.carrier = Number(req.query.carrier);
    if (req.query.planId) params.planId = Number(req.query.planId);
    res.json(await callApi("/queryCouponList", params));
  } catch (err) {
    req.log.error({ err }, "SIM coupons fetch failed");
    res.status(502).json({ code: 502, message: "Failed to reach IoT API", data: null });
  }
}));

// ─── Admin: SIM Cards (provider) ─────────────────────────────────────────

router.get("/sim/admin/cards", simAdminAuth(async (req, res): Promise<void> => {
  try {
    const { carrier, status, pageNum = 1, pageSize = 20 } = req.query as {
      carrier?: string; status?: string; pageNum?: string | number; pageSize?: string | number;
    };
    const params: Record<string, unknown> = { pageNum: Number(pageNum), pageSize: Number(pageSize) };
    if (carrier && carrier !== "all") params.carrier = Number(carrier);
    if (status && status !== "all") params.status = Number(status);
    res.json(await callApi("/queryCardList", params));
  } catch (err) {
    req.log.error({ err }, "SIM card list fetch failed");
    res.status(502).json({ code: 502, message: "Failed to reach IoT API", data: null });
  }
}));

router.get("/sim/admin/cards/:iccid", simAdminAuth(async (req, res): Promise<void> => {
  try {
    res.json(await callApi("/queryCard", { iccid: req.params.iccid }));
  } catch (err) {
    req.log.error({ err }, "SIM card detail fetch failed");
    res.status(502).json({ code: 502, message: "Failed to reach IoT API", data: null });
  }
}));

router.post("/sim/admin/cards/:iccid/refresh", simAdminAuth(async (req, res): Promise<void> => {
  try {
    res.json(await callApi("/refreshCard", { iccid: req.params.iccid }));
  } catch (err) {
    req.log.error({ err }, "SIM refresh failed");
    res.status(502).json({ code: 502, message: "Failed to reach IoT API", data: null });
  }
}));

router.post("/sim/admin/cards/:iccid/order-plan", simAdminAuth(async (req: any, res): Promise<void> => {
  try {
    const { planId, currency, regionId, region, couponIds, remark, planName } = req.body as {
      planId: number; currency?: string; regionId?: number; region?: string; couponIds?: string; remark?: string; planName?: string;
    };
    // Resolve local DB plan → provider plan code
    const [plan] = await db.select().from(simPlansTable).where(eq(simPlansTable.id, planId)).limit(1);
    const providerPlanId = plan?.planCode ? Number(plan.planCode) : planId;
    const resolvedRegionId = regionId ?? (region && /^\d+$/.test(region.trim()) ? Number(region.trim()) : undefined);
    const params: Record<string, unknown> = { iccid: req.params.iccid, planId: providerPlanId };
    if (currency) params.currency = currency;
    if (resolvedRegionId) params.regionId = resolvedRegionId;
    if (couponIds) params.couponIds = couponIds;
    if (remark) params.remark = remark;
    const result = await callApi<string>("/orderPlan", params);
    if (result.code === 200) {
      await db.insert(simOrderHistoryTable).values({
        iccid: req.params.iccid, action: "order", planId: String(providerPlanId),
        planName: plan?.planName ?? planName ?? null, orderNumber: result.data, currency: currency ?? "CNY",
      });
    }
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "SIM admin order plan failed");
    res.status(502).json({ code: 502, message: "Failed to reach IoT API", data: null });
  }
}));

router.post("/sim/admin/cards/:iccid/renew", simAdminAuth(async (req: any, res): Promise<void> => {
  try {
    const { currency, month, remark } = req.body as { currency?: string; month?: number; remark?: string };
    const params: Record<string, unknown> = { iccid: req.params.iccid };
    if (currency) params.currency = currency;
    if (month) params.month = month;
    if (remark) params.remark = remark;
    const result = await callApi<string>("/renewPlan", params);
    if (result.code === 200) {
      await db.insert(simOrderHistoryTable).values({
        iccid: req.params.iccid, action: "renew", orderNumber: result.data, currency: currency ?? "CNY",
      });
    }
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "SIM admin renew failed");
    res.status(502).json({ code: 502, message: "Failed to reach IoT API", data: null });
  }
}));

router.post("/sim/admin/cards/:iccid/change-plan", simAdminAuth(async (req: any, res): Promise<void> => {
  try {
    const { planId, currency, regionId, region, remark, planName } = req.body as {
      planId: number; currency?: string; regionId?: number; region?: string; remark?: string; planName?: string;
    };
    const [plan] = await db.select().from(simPlansTable).where(eq(simPlansTable.id, planId)).limit(1);
    const providerPlanId = plan?.planCode ? Number(plan.planCode) : planId;
    const resolvedRegionId = regionId ?? (region && /^\d+$/.test(region.trim()) ? Number(region.trim()) : undefined);
    const params: Record<string, unknown> = { iccid: req.params.iccid, planId: providerPlanId };
    if (currency) params.currency = currency;
    if (resolvedRegionId) params.regionId = resolvedRegionId;
    if (remark) params.remark = remark;
    const result = await callApi<string>("/changePlan", params);
    if (result.code === 200) {
      await db.insert(simOrderHistoryTable).values({
        iccid: req.params.iccid, action: "change", planId: String(planId),
        planName: planName ?? null, orderNumber: result.data, currency: currency ?? "CNY",
      });
    }
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "SIM admin change plan failed");
    res.status(502).json({ code: 502, message: "Failed to reach IoT API", data: null });
  }
}));

// ─── Admin: Plan Catalog CRUD ─────────────────────────────────────────────

router.get("/sim/admin/plans", simAdminAuth(async (_req, res): Promise<void> => {
  try {
    const plans = await db.select().from(simPlansTable).orderBy(asc(simPlansTable.sortOrder), asc(simPlansTable.id));
    res.json({ code: 200, message: "OK", data: plans });
  } catch {
    res.status(500).json({ code: 500, message: "Failed to fetch plans", data: null });
  }
}));

router.post("/sim/admin/plans", simAdminAuth(async (req, res): Promise<void> => {
  try {
    const body = req.body as {
      planCode?: string; planName: string; description?: string; carrier?: string; planType?: string;
      dataLimitMb?: number; validDays?: number; priceCny?: string; priceUsd?: string; pricePkr?: string;
      isActive?: boolean; sortOrder?: number;
    };
    const [plan] = await db.insert(simPlansTable).values({
      planCode: body.planCode ?? null, planName: body.planName, description: body.description ?? null,
      carrier: body.carrier ?? null, planType: body.planType ?? null, dataLimitMb: body.dataLimitMb ?? null,
      validDays: body.validDays ?? null, priceCny: body.priceCny ?? null, priceUsd: body.priceUsd ?? null,
      pricePkr: body.pricePkr ?? null, isActive: body.isActive ?? true, sortOrder: body.sortOrder ?? 0,
    }).returning();
    res.json({ code: 200, message: "Plan created", data: plan });
  } catch (err) {
    req.log.error({ err }, "SIM admin create plan failed");
    res.status(500).json({ code: 500, message: "Failed to create plan", data: null });
  }
}));

router.put("/sim/admin/plans/:id", simAdminAuth(async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const body = req.body as Partial<{
      planCode: string; planName: string; description: string; carrier: string; planType: string;
      dataLimitMb: number; validDays: number; priceCny: string; priceUsd: string; pricePkr: string;
      isActive: boolean; sortOrder: number;
    }>;
    const [plan] = await db.update(simPlansTable).set({ ...body, updatedAt: new Date() })
      .where(eq(simPlansTable.id, id)).returning();
    if (!plan) { res.status(404).json({ code: 404, message: "Plan not found", data: null }); return; }
    res.json({ code: 200, message: "Plan updated", data: plan });
  } catch (err) {
    req.log.error({ err }, "SIM admin update plan failed");
    res.status(500).json({ code: 500, message: "Failed to update plan", data: null });
  }
}));

router.delete("/sim/admin/plans/:id", simAdminAuth(async (req, res): Promise<void> => {
  try {
    await db.delete(simPlansTable).where(eq(simPlansTable.id, Number(req.params.id)));
    res.json({ code: 200, message: "Plan deleted", data: null });
  } catch (err) {
    req.log.error({ err }, "SIM admin delete plan failed");
    res.status(500).json({ code: 500, message: "Failed to delete plan", data: null });
  }
}));

// ─── Admin: Discover plans from existing cards ─────────────────────────────

router.get("/sim/admin/discover-plans", simAdminAuth(async (req, res): Promise<void> => {
  try {
    // Fetch up to 1000 cards from provider; extract unique planId+planName pairs
    const first = await callApi<{ total?: number; list?: unknown[] }>("/queryCardList", { pageNum: 1, pageSize: 200 });
    const total = (first.data as { total?: number })?.total ?? 0;
    const allCards: unknown[] = [...((first.data as { list?: unknown[] })?.list ?? [])];

    if (total > 200) {
      const pages = Math.min(Math.ceil(total / 200), 5); // cap at 1000 cards
      const rest = await Promise.all(
        Array.from({ length: pages - 1 }, (_, i) =>
          callApi<{ list?: unknown[] }>("/queryCardList", { pageNum: i + 2, pageSize: 200 })
        )
      );
      for (const r of rest) {
        allCards.push(...((r.data as { list?: unknown[] })?.list ?? []));
      }
    }

    // Deduplicate by planId
    const seen = new Map<string, { planId: string; planName: string }>();
    for (const card of allCards) {
      const c = card as Record<string, unknown>;
      const planId = c.planId != null ? String(c.planId) : null;
      const planName = typeof c.planName === "string" ? c.planName : null;
      if (planId && !seen.has(planId)) {
        seen.set(planId, { planId, planName: planName ?? `Plan ${planId}` });
      }
    }

    res.json({ code: 200, message: "OK", data: Array.from(seen.values()) });
  } catch (err) {
    req.log.error({ err }, "SIM discover plans failed");
    res.status(500).json({ code: 500, message: "Failed to discover plans", data: null });
  }
}));

// ─── Admin: Customer Management ───────────────────────────────────────────

router.get("/sim/admin/customers", simAdminAuth(async (_req, res): Promise<void> => {
  try {
    const [customers, sims, settingsRows] = await Promise.all([
      db.select().from(simCustomersTable).orderBy(desc(simCustomersTable.createdAt)),
      db.select().from(simCustomerSimsTable),
      db.select().from(simAlertSettingsTable).where(eq(simAlertSettingsTable.id, 1)).limit(1),
    ]);
    const settings = settingsRows[0];

    const simsByCustomer = sims.reduce<Record<number, typeof sims>>((acc, s) => {
      if (!acc[s.customerId]) acc[s.customerId] = [];
      acc[s.customerId].push(s);
      return acc;
    }, {});

    const sevenDaysFromNow = new Date(Date.now() + 7 * 86_400_000);
    const now = new Date();
    const thresholdPkr = parseFloat(settings?.lowBalancePkr ?? "0") || 0;
    const thresholdCny = parseFloat(settings?.lowBalanceCny ?? "0") || 0;
    const thresholdUsd = parseFloat(settings?.lowBalanceUsd ?? "0") || 0;
    const dataThresholdPct = settings?.dataUsageThresholdPct ?? 80;

    const result = customers.map(c => {
      const customerSims = simsByCustomer[c.id] ?? [];
      const simCount = customerSims.length > 0 ? customerSims.length : (c.iccid ? 1 : 0);
      const alerts: Array<{ type: string; iccid: string | null; message: string }> = [];

      for (const sim of customerSims) {
        if (sim.expireTime) {
          const expires = new Date(sim.expireTime);
          if (!isNaN(expires.getTime()) && expires <= sevenDaysFromNow && expires > now) {
            const daysLeft = Math.ceil((expires.getTime() - Date.now()) / 86_400_000);
            const label = sim.nickname ?? sim.iccid.slice(-8);
            alerts.push({ type: "expiry", iccid: sim.iccid, message: `SIM ${label} expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"} (${expires.toLocaleDateString("en-PK", { timeZone: "Asia/Karachi" })})` });
          }
        }
      }

      const balPkr = parseFloat(c.balancePkr) || 0;
      const balCny = parseFloat(c.balanceCny) || 0;
      const balUsd = parseFloat(c.balanceUsd) || 0;
      if (thresholdPkr > 0 && balPkr < thresholdPkr)
        alerts.push({ type: "low_balance", iccid: null, message: `PKR balance (Rs ${balPkr.toLocaleString()}) is below warning threshold of Rs ${thresholdPkr.toLocaleString()}` });
      if (thresholdCny > 0 && balCny < thresholdCny)
        alerts.push({ type: "low_balance", iccid: null, message: `CNY balance (¥${balCny.toFixed(2)}) is below warning threshold of ¥${thresholdCny.toFixed(2)}` });
      if (thresholdUsd > 0 && balUsd < thresholdUsd)
        alerts.push({ type: "low_balance", iccid: null, message: `USD balance ($${balUsd.toFixed(2)}) is below warning threshold of $${thresholdUsd.toFixed(2)}` });

      if (dataThresholdPct > 0) {
        for (const sim of customerSims) {
          const usageMb = parseFloat(sim.dataUsageMb ?? "0") || 0;
          const limitMb = parseFloat(sim.planLimitMb ?? "0") || 0;
          if (limitMb > 0 && usageMb > 0) {
            const usedPct = (usageMb / limitMb) * 100;
            if (usedPct >= dataThresholdPct) {
              const label = sim.nickname ?? sim.iccid.slice(-8);
              const limitStr = limitMb >= 1024 ? `${(limitMb / 1024).toFixed(1)} GB` : `${limitMb.toFixed(0)} MB`;
              const usageStr = usageMb >= 1024 ? `${(usageMb / 1024).toFixed(1)} GB` : `${usageMb.toFixed(0)} MB`;
              alerts.push({ type: "data_usage", iccid: sim.iccid, message: `SIM ${label} has used ${Math.round(usedPct)}% of data plan (${usageStr} / ${limitStr})` });
            }
          }
        }
      }

      return { ...c, passwordHash: undefined, simCount, alerts };
    });
    res.json({ code: 200, message: "OK", data: result });
  } catch (err) {
    res.status(500).json({ code: 500, message: "Failed to fetch customers", data: null });
  }
}));

router.post("/sim/admin/customers", simAdminAuth(async (req, res): Promise<void> => {
  try {
    const { username, fullName, email, phone, iccid, msisdn, accountType, password } = req.body as {
      username?: string; fullName?: string; email?: string; phone?: string;
      iccid?: string; msisdn?: string; accountType?: string; password?: string;
    };
    const [customer] = await db.insert(simCustomersTable).values({
      username: username?.trim() ?? null,
      fullName: fullName?.trim() ?? null,
      email: email?.trim() ?? null,
      phone: phone?.trim() ?? null,
      iccid: iccid?.trim() ?? null,
      msisdn: msisdn?.trim() ?? null,
      passwordHash: hashPassword(password ?? DEFAULT_PASSWORD),
      accountType: accountType ?? "single",
      mustChangePassword: !password,
    }).returning();
    if (iccid) {
      await db.insert(simCustomerSimsTable).values({
        customerId: customer.id, iccid: iccid.trim(), msisdn: msisdn?.trim() ?? null, isPrimary: true,
      }).onConflictDoNothing();
    }
    res.json({ code: 200, message: "Customer created", data: { ...customer, passwordHash: undefined } });
  } catch (err) {
    req.log.error({ err }, "SIM admin create customer failed");
    res.status(500).json({ code: 500, message: "Failed to create customer", data: null });
  }
}));

router.get("/sim/admin/customers/:id", simAdminAuth(async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const [customer] = await db.select().from(simCustomersTable).where(eq(simCustomersTable.id, id)).limit(1);
    if (!customer) { res.status(404).json({ code: 404, message: "Customer not found", data: null }); return; }
    const [sims, topups, orders] = await Promise.all([
      db.select().from(simCustomerSimsTable).where(eq(simCustomerSimsTable.customerId, id)),
      db.select().from(simTopupsTable).where(eq(simTopupsTable.customerId, id)).orderBy(desc(simTopupsTable.createdAt)).limit(20),
      db.select().from(simOrderHistoryTable).where(eq(simOrderHistoryTable.customerId, id)).orderBy(desc(simOrderHistoryTable.createdAt)).limit(20),
    ]);
    res.json({ code: 200, message: "OK", data: { ...customer, passwordHash: undefined, sims, topups, orders } });
  } catch {
    res.status(500).json({ code: 500, message: "Failed to fetch customer", data: null });
  }
}));

router.put("/sim/admin/customers/:id", simAdminAuth(async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const { fullName, email, phone, username, accountType, isActive, password } = req.body as {
      fullName?: string; email?: string; phone?: string; username?: string;
      accountType?: string; isActive?: boolean; password?: string;
    };
    const updates: Partial<typeof simCustomersTable.$inferInsert> = {};
    if (fullName !== undefined) updates.fullName = fullName;
    if (email !== undefined) updates.email = email;
    if (phone !== undefined) updates.phone = phone;
    if (username !== undefined) updates.username = username;
    if (accountType !== undefined) updates.accountType = accountType;
    if (isActive !== undefined) updates.isActive = isActive;
    if (password) { updates.passwordHash = hashPassword(password); updates.mustChangePassword = false; }
    const [updated] = await db.update(simCustomersTable).set(updates).where(eq(simCustomersTable.id, id)).returning();
    if (!updated) { res.status(404).json({ code: 404, message: "Customer not found", data: null }); return; }
    res.json({ code: 200, message: "Customer updated", data: { ...updated, passwordHash: undefined } });
  } catch (err) {
    req.log.error({ err }, "SIM admin update customer failed");
    res.status(500).json({ code: 500, message: "Failed to update customer", data: null });
  }
}));

router.post("/sim/admin/customers/:id/topup", simAdminAuth(async (req: any, res): Promise<void> => {
  try {
    const customerId = Number(req.params.id);
    const { amountPkr, amountCny, amountUsd, note } = req.body as {
      amountPkr?: number; amountCny?: number; amountUsd?: number; note?: string;
    };
    const [topup] = await db.insert(simTopupsTable).values({
      customerId,
      amountPkr: String(amountPkr ?? 0),
      amountCny: String(amountCny ?? 0),
      amountUsd: String(amountUsd ?? 0),
      note: note ?? null,
      appliedBy: req.adminUser.id,
      status: "completed",
    }).returning();
    await db.update(simCustomersTable).set({
      balancePkr: sql`balance_pkr + ${amountPkr ?? 0}`,
      balanceCny: sql`balance_cny + ${amountCny ?? 0}`,
      balanceUsd: sql`balance_usd + ${amountUsd ?? 0}`,
    }).where(eq(simCustomersTable.id, customerId));
    res.json({ code: 200, message: "Top-up applied", data: topup });
  } catch (err) {
    req.log.error({ err }, "SIM admin topup failed");
    res.status(500).json({ code: 500, message: "Failed to apply top-up", data: null });
  }
}));

// ─── Admin: Topup Requests (customer-submitted pending requests) ──────────

router.get("/sim/admin/topup-requests", simAdminAuth(async (req: any, res): Promise<void> => {
  try {
    const { status } = req.query as { status?: string };
    const baseQuery = db
      .select({
        id: simTopupsTable.id,
        customerId: simTopupsTable.customerId,
        amountPkr: simTopupsTable.amountPkr,
        amountCny: simTopupsTable.amountCny,
        amountUsd: simTopupsTable.amountUsd,
        note: simTopupsTable.note,
        appliedBy: simTopupsTable.appliedBy,
        status: simTopupsTable.status,
        createdAt: simTopupsTable.createdAt,
        reviewedAt: simTopupsTable.reviewedAt,
        customerName: simCustomersTable.fullName,
        customerUsername: simCustomersTable.username,
        customerIccid: simCustomersTable.iccid,
        reviewerName: usersTable.name,
      })
      .from(simTopupsTable)
      .leftJoin(simCustomersTable, eq(simTopupsTable.customerId, simCustomersTable.id))
      .leftJoin(usersTable, eq(simTopupsTable.appliedBy, usersTable.id));

    const requests = await (status && status !== "all"
      ? baseQuery.where(eq(simTopupsTable.status, status))
      : baseQuery
    )
      .orderBy(desc(simTopupsTable.createdAt))
      .limit(200);
    res.json({ code: 200, message: "OK", data: requests });
  } catch (err) {
    req.log.error({ err }, "Admin topup-requests list failed");
    res.status(500).json({ code: 500, message: "Failed", data: null });
  }
}));

router.post("/sim/admin/topup-requests/:id/approve", simAdminAuth(async (req: any, res): Promise<void> => {
  try {
    const requestId = Number(req.params.id);
    const adminId: number = req.adminUser.id;

    // Atomic: status flip + balance credit in one transaction.
    // The UPDATE's WHERE status='pending' is the guard — only one concurrent
    // caller can succeed; the other gets no rows back and receives a 409.
    let claimed: typeof simTopupsTable.$inferSelect | undefined;
    try {
      claimed = await db.transaction(async (tx) => {
        const [row] = await tx.update(simTopupsTable)
          .set({ status: "completed", appliedBy: adminId, reviewedAt: new Date() })
          .where(and(eq(simTopupsTable.id, requestId), eq(simTopupsTable.status, "pending")))
          .returning();
        if (!row) throw Object.assign(new Error("NOT_PENDING"), { isPending: false });
        await tx.update(simCustomersTable).set({
          balancePkr: sql`balance_pkr + ${Number(row.amountPkr)}`,
          balanceCny: sql`balance_cny + ${Number(row.amountCny)}`,
          balanceUsd: sql`balance_usd + ${Number(row.amountUsd)}`,
        }).where(eq(simCustomersTable.id, row.customerId));
        return row;
      });
    } catch (err: unknown) {
      if (err instanceof Error && (err as any).isPending === false) {
        res.status(409).json({ code: 409, message: "Request not found or is not pending", data: null }); return;
      }
      throw err;
    }

    await db.insert(simNotificationsTable).values({
      customerId: claimed.customerId,
      type: "topup_approved",
      iccid: null,
      message: `Your top-up of PKR ${Number(claimed.amountPkr).toLocaleString()} has been approved and credited to your account.`,
    }).catch(() => {});

    res.json({ code: 200, message: "Top-up approved and credited to customer", data: claimed });
  } catch (err) {
    req.log.error({ err }, "Admin topup-request approve failed");
    res.status(500).json({ code: 500, message: "Failed to approve", data: null });
  }
}));

router.post("/sim/admin/topup-requests/:id/reject", simAdminAuth(async (req: any, res): Promise<void> => {
  try {
    const requestId = Number(req.params.id);
    // Atomic: only succeeds if status is currently 'pending'
    const adminId: number = req.adminUser.id;
    const [updated] = await db.update(simTopupsTable)
      .set({ status: "rejected", appliedBy: adminId, reviewedAt: new Date() })
      .where(and(eq(simTopupsTable.id, requestId), eq(simTopupsTable.status, "pending")))
      .returning();
    if (!updated) {
      res.status(409).json({ code: 409, message: "Request not found or is not pending", data: null }); return;
    }

    await db.insert(simNotificationsTable).values({
      customerId: updated.customerId,
      type: "topup_rejected",
      iccid: null,
      message: `Your top-up request of PKR ${Number(updated.amountPkr).toLocaleString()} was declined.`,
    }).catch(() => {});

    res.json({ code: 200, message: "Top-up request rejected", data: updated });
  } catch (err) {
    req.log.error({ err }, "Admin topup-request reject failed");
    res.status(500).json({ code: 500, message: "Failed to reject", data: null });
  }
}));

// ─── Admin: Plan Requests (customer-submitted plan order requests) ─────────

router.get("/sim/admin/plan-requests", simAdminAuth(async (req: any, res): Promise<void> => {
  try {
    const { status } = req.query as { status?: string };
    const baseQuery = db
      .select({
        id: simPlanRequestsTable.id,
        customerId: simPlanRequestsTable.customerId,
        iccid: simPlanRequestsTable.iccid,
        planId: simPlanRequestsTable.planId,
        planName: simPlanRequestsTable.planName,
        currency: simPlanRequestsTable.currency,
        region: simPlanRequestsTable.region,
        note: simPlanRequestsTable.note,
        status: simPlanRequestsTable.status,
        reviewNote: simPlanRequestsTable.reviewNote,
        orderNumber: simPlanRequestsTable.orderNumber,
        createdAt: simPlanRequestsTable.createdAt,
        reviewedAt: simPlanRequestsTable.updatedAt,
        customerName: simCustomersTable.fullName,
        customerUsername: simCustomersTable.username,
        customerIccid: simCustomersTable.iccid,
        reviewerName: usersTable.name,
      })
      .from(simPlanRequestsTable)
      .leftJoin(simCustomersTable, eq(simPlanRequestsTable.customerId, simCustomersTable.id))
      .leftJoin(usersTable, eq(simPlanRequestsTable.reviewedBy, usersTable.id));

    const requests = await (status && status !== "all"
      ? baseQuery.where(eq(simPlanRequestsTable.status, status))
      : baseQuery
    )
      .orderBy(desc(simPlanRequestsTable.createdAt))
      .limit(200);
    res.json({ code: 200, message: "OK", data: requests });
  } catch (err) {
    req.log.error({ err }, "Admin plan-requests list failed");
    res.status(500).json({ code: 500, message: "Failed", data: null });
  }
}));

router.post("/sim/admin/plan-requests/:id/approve", simAdminAuth(async (req: any, res): Promise<void> => {
  try {
    const requestId = Number(req.params.id);
    const adminId: number = req.adminUser.id;

    // Step 1: Atomically claim the request by transitioning pending → processing.
    // Only one concurrent caller can win this UPDATE; all others see no rows and get 409.
    const [claimed] = await db.update(simPlanRequestsTable)
      .set({ status: "processing", reviewedBy: adminId, updatedAt: new Date() })
      .where(and(eq(simPlanRequestsTable.id, requestId), eq(simPlanRequestsTable.status, "pending")))
      .returning();
    if (!claimed) {
      res.status(409).json({ code: 409, message: "Request not found, not pending, or already being processed", data: null }); return;
    }

    // Step 2: Resolve provider plan ID
    let providerPlanId = claimed.planId ?? undefined;
    let planName = claimed.planName;
    if (claimed.planId) {
      const [plan] = await db.select().from(simPlansTable).where(eq(simPlansTable.id, claimed.planId)).limit(1);
      if (plan) {
        providerPlanId = plan.planCode ? Number(plan.planCode) : claimed.planId;
        planName = plan.planName;
      }
    }
    if (!providerPlanId) {
      // Roll back to pending so admin can fix and retry
      await db.update(simPlanRequestsTable)
        .set({ status: "pending", reviewedBy: null, updatedAt: new Date() })
        .where(eq(simPlanRequestsTable.id, requestId));
      res.status(400).json({ code: 400, message: "No plan ID attached to this request", data: null }); return;
    }

    // Step 3: Call IoT provider (outside any DB transaction — side-effectful)
    const params: Record<string, unknown> = { iccid: claimed.iccid, planId: providerPlanId };
    if (claimed.currency) params.currency = claimed.currency;
    if (claimed.region) params.region = claimed.region;

    let result: Awaited<ReturnType<typeof callApi<string>>>;
    try {
      result = await callApi<string>("/orderPlan", params);
    } catch (provErr) {
      req.log.error({ err: provErr }, "Plan request provider call failed");
      // Roll back to pending so admin can retry
      await db.update(simPlanRequestsTable)
        .set({ status: "pending", reviewedBy: null, updatedAt: new Date() })
        .where(eq(simPlanRequestsTable.id, requestId));
      res.status(502).json({ code: 502, message: "Failed to reach IoT API", data: null }); return;
    }

    // Step 4: Finalize based on provider result
    if (result.code === 200) {
      await db.insert(simOrderHistoryTable).values({
        customerId: claimed.customerId, iccid: claimed.iccid, action: "order",
        planId: String(providerPlanId), planName: planName ?? null,
        orderNumber: result.data, currency: claimed.currency,
      }).catch(() => {});
      const [updated] = await db.update(simPlanRequestsTable)
        .set({ status: "approved", orderNumber: result.data, updatedAt: new Date() })
        .where(eq(simPlanRequestsTable.id, requestId))
        .returning();

      await db.insert(simNotificationsTable).values({
        customerId: claimed.customerId,
        type: "plan_approved",
        iccid: claimed.iccid,
        message: `Your plan request${planName ? ` for "${planName}"` : ""} has been approved and is being activated.`,
      }).catch(() => {});

      res.json({ code: 200, message: "Plan ordered and approved successfully", data: updated });
    } else {
      // Provider rejected — mark as rejected so admin can see the outcome
      const [updated] = await db.update(simPlanRequestsTable)
        .set({ status: "rejected", reviewNote: result.message ?? "Provider rejected", updatedAt: new Date() })
        .where(eq(simPlanRequestsTable.id, requestId))
        .returning();

      await db.insert(simNotificationsTable).values({
        customerId: claimed.customerId,
        type: "plan_rejected",
        iccid: claimed.iccid,
        message: `Your plan request${planName ? ` for "${planName}"` : ""} could not be processed by the provider.`,
      }).catch(() => {});

      res.json({ code: result.code, message: result.message ?? "Provider rejected the order", data: updated });
    }
  } catch (err) {
    req.log.error({ err }, "Admin plan-request approve failed");
    res.status(500).json({ code: 500, message: "Failed to approve plan request", data: null });
  }
}));

router.post("/sim/admin/plan-requests/:id/reject", simAdminAuth(async (req: any, res): Promise<void> => {
  try {
    const requestId = Number(req.params.id);
    const { reason } = req.body as { reason?: string };
    // Atomic: only succeeds if status is currently 'pending'
    const [updated] = await db.update(simPlanRequestsTable)
      .set({ status: "rejected", reviewedBy: req.adminUser.id, reviewNote: reason ?? null, updatedAt: new Date() })
      .where(and(eq(simPlanRequestsTable.id, requestId), eq(simPlanRequestsTable.status, "pending")))
      .returning();
    if (!updated) {
      res.status(409).json({ code: 409, message: "Request not found or is not pending", data: null }); return;
    }

    await db.insert(simNotificationsTable).values({
      customerId: updated.customerId,
      type: "plan_rejected",
      iccid: updated.iccid,
      message: `Your plan request${updated.planName ? ` for "${updated.planName}"` : ""} was rejected${reason ? `: ${reason}` : "."}`,
    }).catch(() => {});

    res.json({ code: 200, message: "Plan request rejected", data: updated });
  } catch (err) {
    req.log.error({ err }, "Admin plan-request reject failed");
    res.status(500).json({ code: 500, message: "Failed to reject", data: null });
  }
}));

router.post("/sim/admin/customers/:id/sims", simAdminAuth(async (req, res): Promise<void> => {
  try {
    const customerId = Number(req.params.id);
    const { iccid, msisdn, nickname } = req.body as { iccid: string; msisdn?: string; nickname?: string };
    if (!iccid) { res.status(400).json({ code: 400, message: "ICCID required", data: null }); return; }
    const [sim] = await db.insert(simCustomerSimsTable).values({
      customerId, iccid: iccid.trim(), msisdn: msisdn?.trim() ?? null, nickname: nickname?.trim() ?? null,
    }).returning();
    res.json({ code: 200, message: "SIM added", data: sim });
  } catch (err) {
    req.log.error({ err }, "SIM admin add SIM failed");
    res.status(500).json({ code: 500, message: "Failed to add SIM", data: null });
  }
}));

router.delete("/sim/admin/customers/:id/sims/:simId", simAdminAuth(async (req, res): Promise<void> => {
  try {
    const customerId = Number(req.params.id);
    const simId = Number(req.params.simId);
    const [existing] = await db.select().from(simCustomerSimsTable)
      .where(and(eq(simCustomerSimsTable.id, simId), eq(simCustomerSimsTable.customerId, customerId)))
      .limit(1);
    if (!existing) { res.status(404).json({ code: 404, message: "SIM not found for this customer", data: null }); return; }
    await db.delete(simCustomerSimsTable).where(eq(simCustomerSimsTable.id, simId));
    res.json({ code: 200, message: "SIM removed", data: null });
  } catch (err) {
    req.log.error({ err }, "SIM admin remove SIM failed");
    res.status(500).json({ code: 500, message: "Failed to remove SIM", data: null });
  }
}));

// ─── Admin: Order History ─────────────────────────────────────────────────

router.get("/sim/admin/orders", simAdminAuth(async (_req, res): Promise<void> => {
  try {
    const orders = await db.select({
      id: simOrderHistoryTable.id,
      customerId: simOrderHistoryTable.customerId,
      iccid: simOrderHistoryTable.iccid,
      action: simOrderHistoryTable.action,
      planId: simOrderHistoryTable.planId,
      planName: simOrderHistoryTable.planName,
      orderNumber: simOrderHistoryTable.orderNumber,
      currency: simOrderHistoryTable.currency,
      amountCny: simOrderHistoryTable.amountCny,
      amountUsd: simOrderHistoryTable.amountUsd,
      amountPkr: simOrderHistoryTable.amountPkr,
      createdAt: simOrderHistoryTable.createdAt,
      customerName: simCustomersTable.fullName,
      customerUsername: simCustomersTable.username,
      customerEmail: simCustomersTable.email,
    }).from(simOrderHistoryTable)
      .leftJoin(simCustomersTable, eq(simOrderHistoryTable.customerId, simCustomersTable.id))
      .orderBy(desc(simOrderHistoryTable.createdAt)).limit(200);
    res.json({ code: 200, message: "OK", data: orders });
  } catch {
    res.status(500).json({ code: 500, message: "Failed to fetch orders", data: null });
  }
}));

// ─── Admin: SMS ───────────────────────────────────────────────────────────

router.get("/sim/admin/sms", simAdminAuth(async (_req, res): Promise<void> => {
  try {
    const msgs = await db.select().from(simSmsMessagesTable)
      .orderBy(desc(simSmsMessagesTable.createdAt)).limit(200);
    res.json({ code: 200, message: "OK", data: msgs });
  } catch {
    res.status(500).json({ code: 500, message: "Failed to fetch SMS", data: null });
  }
}));

router.post("/sim/admin/sms", simAdminAuth(async (req: any, res): Promise<void> => {
  try {
    const { customerId, iccid, toNumber, body: msgBody } = req.body as {
      customerId?: number; iccid: string; toNumber: string; body: string;
    };
    if (!iccid || !toNumber || !msgBody) {
      res.status(400).json({ code: 400, message: "iccid, toNumber, and body are required", data: null }); return;
    }
    if (!customerId || !Number.isInteger(Number(customerId)) || Number(customerId) <= 0) {
      res.status(400).json({ code: 400, message: "A valid customerId is required", data: null }); return;
    }
    // Verify customer exists before inserting to avoid FK violation
    const [cust] = await db.select({ id: simCustomersTable.id }).from(simCustomersTable)
      .where(eq(simCustomersTable.id, Number(customerId))).limit(1);
    if (!cust) {
      res.status(404).json({ code: 404, message: "Customer not found", data: null }); return;
    }
    const [msg] = await db.insert(simSmsMessagesTable).values({
      customerId: cust.id, iccid, direction: "sent", toNumber, body: msgBody,
    }).returning();
    res.json({ code: 200, message: "SMS recorded", data: msg });
  } catch (err) {
    req.log.error({ err }, "SIM admin SMS send failed");
    res.status(500).json({ code: 500, message: "Failed to send SMS", data: null });
  }
}));

// ─── Customer Auth ────────────────────────────────────────────────────────

router.post("/sim/customer/login", async (req, res): Promise<void> => {
  try {
    const { identifier, password } = req.body as { identifier?: string; password?: string };
    if (!identifier || !password) {
      res.status(400).json({ code: 400, message: "Identifier and password required", data: null }); return;
    }
    const id = identifier.trim();
    const pwd = password.trim();

    // Look up by username, iccid, msisdn, imsi, email
    const [customer] = await db.select().from(simCustomersTable).where(
      or(
        eq(simCustomersTable.username, id),
        eq(simCustomersTable.iccid, id),
        eq(simCustomersTable.msisdn, id),
        eq(simCustomersTable.imsi, id),
        eq(simCustomersTable.email, id),
      )
    ).limit(1);

    if (customer) {
      if (!customer.isActive) {
        res.status(403).json({ code: 403, message: "Account deactivated. Contact support.", data: null }); return;
      }
      if (!verifyPassword(pwd, customer.passwordHash)) {
        res.status(401).json({ code: 401, message: "Invalid password", data: null }); return;
      }
      await db.update(simCustomersTable).set({ lastLoginAt: new Date() }).where(eq(simCustomersTable.id, customer.id));
      const token = generateToken();
      const expiresAt = new Date(Date.now() + CUSTOMER_SESSION_TTL_MS);
      await db.insert(simSessionsTable).values({ token, role: "customer", customerId: customer.id, expiresAt });
      pruneExpiredSessions();
      res.json({ code: 200, message: "OK", data: { token, mustChangePassword: customer.mustChangePassword, customer: { id: customer.id, username: customer.username, fullName: customer.fullName, email: customer.email, phone: customer.phone, accountType: customer.accountType, balancePkr: customer.balancePkr, balanceCny: customer.balanceCny, balanceUsd: customer.balanceUsd } } });
      return;
    }

    // Auto-register for first-time ICCID/MSISDN login with default password
    if (pwd !== DEFAULT_PASSWORD) {
      res.status(401).json({ code: 401, message: "Account not found. First time? Use your ICCID and password 123456.", data: null }); return;
    }

    // ICCID: 19-22 digits; IMSI: exactly 15 digits; MSISDN: 10-15 digits
    const looksLikeICCID = /^\d{19,22}$/.test(id);
    const looksLikeIMSI = /^\d{15}$/.test(id) && !looksLikeICCID;
    const looksMSISDN = /^\d{10,14}$/.test(id);
    let params: Record<string, unknown>;
    if (looksLikeICCID) params = { iccid: id };
    else if (looksLikeIMSI) params = { imsi: id };
    else params = { msisdn: id };
    const simData = await callApi<{ iccid?: string; msisdn?: string; imsi?: string }>("/queryCard", params);
    if (simData.code !== 200 || !simData.data) {
      res.status(404).json({ code: 404, message: "No SIM found with this ID. Contact support.", data: null }); return;
    }
    const [newCustomer] = await db.insert(simCustomersTable).values({
      iccid: simData.data.iccid ?? (looksLikeICCID ? id : null),
      msisdn: simData.data.msisdn ?? (looksMSISDN ? id : null),
      imsi: simData.data.imsi ?? null,
      passwordHash: hashPassword(DEFAULT_PASSWORD),
      accountType: "single",
      mustChangePassword: true,
    }).returning();
    await db.insert(simCustomerSimsTable).values({
      customerId: newCustomer.id,
      iccid: simData.data.iccid ?? id,
      msisdn: simData.data.msisdn ?? null,
      isPrimary: true,
    }).onConflictDoNothing();
    const token = generateToken();
    const expiresAt = new Date(Date.now() + CUSTOMER_SESSION_TTL_MS);
    await db.insert(simSessionsTable).values({ token, role: "customer", customerId: newCustomer.id, expiresAt });
    pruneExpiredSessions();
    res.json({ code: 200, message: "Account created", data: { token, mustChangePassword: true, customer: { id: newCustomer.id, username: null, fullName: null, email: null, phone: null, accountType: "single", balancePkr: "0", balanceCny: "0", balanceUsd: "0" } } });
  } catch (err) {
    req.log.error({ err }, "SIM customer login failed");
    res.status(500).json({ code: 500, message: "Login failed", data: null });
  }
});

router.post("/sim/customer/google", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth?.userId) { res.status(401).json({ code: 401, message: "Google sign-in failed. Please try again.", data: null }); return; }
  try {
    const clerkUser = await clerkClient.users.getUser(auth.userId);
    const email = (clerkUser.primaryEmailAddress?.emailAddress ?? clerkUser.emailAddresses[0]?.emailAddress ?? "").toLowerCase();
    if (!email) { res.status(400).json({ code: 400, message: "Your Google account has no email address.", data: null }); return; }
    const fullName = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ").trim() || email.split("@")[0];

    let [customer] = await db.select().from(simCustomersTable).where(eq(simCustomersTable.email, email)).limit(1);
    if (!customer) {
      const [created] = await db.insert(simCustomersTable).values({
        email,
        fullName,
        passwordHash: hashPassword(generateToken()),
        mustChangePassword: false,
      }).returning();
      customer = created;
    }
    if (!customer.isActive) { res.status(403).json({ code: 403, message: "Account deactivated. Contact support.", data: null }); return; }

    await db.update(simCustomersTable).set({ lastLoginAt: new Date() }).where(eq(simCustomersTable.id, customer.id));
    const token = generateToken();
    const expiresAt = new Date(Date.now() + CUSTOMER_SESSION_TTL_MS);
    await db.insert(simSessionsTable).values({ token, role: "customer", customerId: customer.id, expiresAt });
    res.json({ code: 200, message: "OK", data: { token, mustChangePassword: false, customer: { id: customer.id, username: customer.username, fullName: customer.fullName, email: customer.email, phone: customer.phone, accountType: customer.accountType, balancePkr: customer.balancePkr, balanceCny: customer.balanceCny, balanceUsd: customer.balanceUsd } } });
  } catch (err) {
    res.status(500).json({ code: 500, message: "Google sign-in failed. Please try again.", data: null });
  }
});

router.post("/sim/customer/register", async (req, res): Promise<void> => {
  try {
    const { username, email, phone, fullName, password } = req.body as {
      username?: string; email?: string; phone?: string; fullName?: string; password: string;
    };
    if (!password || password.length < 6) {
      res.status(400).json({ code: 400, message: "Password must be at least 6 characters", data: null }); return;
    }
    if (!email && !phone && !username) {
      res.status(400).json({ code: 400, message: "Email, phone, or username required", data: null }); return;
    }
    const [newCustomer] = await db.insert(simCustomersTable).values({
      username: username?.trim() ?? null, email: email?.trim() ?? null,
      phone: phone?.trim() ?? null, fullName: fullName?.trim() ?? null,
      passwordHash: hashPassword(password), accountType: "bulk", mustChangePassword: false,
    }).returning();
    const token = generateToken();
    const expiresAt = new Date(Date.now() + CUSTOMER_SESSION_TTL_MS);
    await db.insert(simSessionsTable).values({ token, role: "customer", customerId: newCustomer.id, expiresAt });
    pruneExpiredSessions();
    res.json({ code: 200, message: "Account registered", data: { token, mustChangePassword: false, customer: { id: newCustomer.id, username: newCustomer.username, fullName: newCustomer.fullName, email: newCustomer.email, phone: newCustomer.phone, accountType: newCustomer.accountType, balancePkr: "0", balanceCny: "0", balanceUsd: "0" } } });
  } catch (err) {
    req.log.error({ err }, "SIM customer register failed");
    res.status(500).json({ code: 500, message: "Registration failed. Email/username may already be in use.", data: null });
  }
});

router.post("/sim/customer/logout", simCustomerAuth(async (req, res): Promise<void> => {
  const token = getToken(req);
  await db.delete(simSessionsTable).where(eq(simSessionsTable.token, token));
  res.json({ code: 200, message: "Logged out", data: null });
}));

// ─── Customer: Profile ────────────────────────────────────────────────────

router.get("/sim/customer/me", simCustomerAuth(async (req: any, res): Promise<void> => {
  const c = req.simCustomer;
  res.json({ code: 200, message: "OK", data: { id: c.id, username: c.username, iccid: c.iccid, msisdn: c.msisdn, imsi: c.imsi, fullName: c.fullName, email: c.email, phone: c.phone, accountType: c.accountType, mustChangePassword: c.mustChangePassword, balancePkr: c.balancePkr, balanceCny: c.balanceCny, balanceUsd: c.balanceUsd } });
}));

router.put("/sim/customer/profile", simCustomerAuth(async (req: any, res): Promise<void> => {
  const c = req.simCustomer;
  const { fullName, email, phone, username, currentPassword, newPassword } = req.body as {
    fullName?: string; email?: string; phone?: string; username?: string; currentPassword?: string; newPassword?: string;
  };
  const updates: Partial<typeof simCustomersTable.$inferInsert> = {};
  if (fullName !== undefined) updates.fullName = fullName;
  if (email !== undefined) updates.email = email;
  if (phone !== undefined) updates.phone = phone;
  if (username !== undefined) updates.username = username;
  if (newPassword) {
    if (!currentPassword || !verifyPassword(currentPassword, c.passwordHash)) {
      res.status(401).json({ code: 401, message: "Current password is incorrect", data: null }); return;
    }
    if (newPassword.length < 6) {
      res.status(400).json({ code: 400, message: "New password must be at least 6 characters", data: null }); return;
    }
    updates.passwordHash = hashPassword(newPassword);
    updates.mustChangePassword = false;
  }
  const [updated] = await db.update(simCustomersTable).set(updates).where(eq(simCustomersTable.id, c.id)).returning();
  res.json({ code: 200, message: "Profile updated", data: { ...updated, passwordHash: undefined } });
}));

router.get("/sim/customer/balance", simCustomerAuth(async (req: any, res): Promise<void> => {
  const c = req.simCustomer;
  res.json({ code: 200, message: "OK", data: { balancePkr: c.balancePkr, balanceCny: c.balanceCny, balanceUsd: c.balanceUsd } });
}));

router.get("/sim/customer/topups", simCustomerAuth(async (req: any, res): Promise<void> => {
  try {
    const topups = await db.select().from(simTopupsTable)
      .where(eq(simTopupsTable.customerId, req.simCustomer.id))
      .orderBy(desc(simTopupsTable.createdAt)).limit(50);
    res.json({ code: 200, message: "OK", data: topups });
  } catch {
    res.status(500).json({ code: 500, message: "Failed", data: null });
  }
}));

// ─── Customer: Plan Requests ──────────────────────────────────────────────

router.post("/sim/customer/plan-request", simCustomerAuth(async (req: any, res): Promise<void> => {
  try {
    const { iccid, planId, planName, currency, region, note } = req.body as {
      iccid: string; planId?: number; planName?: string; currency?: string; region?: string; note?: string;
    };
    if (!iccid) { res.status(400).json({ code: 400, message: "ICCID is required", data: null }); return; }
    if (!planId && !planName) { res.status(400).json({ code: 400, message: "planId or planName is required", data: null }); return; }
    const simRow = await requireSimOwnership(iccid, req.simCustomer.id, res);
    if (!simRow) return;
    let resolvedPlanName = planName;
    if (planId && !resolvedPlanName) {
      const [plan] = await db.select({ planName: simPlansTable.planName }).from(simPlansTable)
        .where(eq(simPlansTable.id, planId)).limit(1);
      resolvedPlanName = plan?.planName;
    }
    const [request] = await db.insert(simPlanRequestsTable).values({
      customerId: req.simCustomer.id,
      iccid,
      planId: planId ?? null,
      planName: resolvedPlanName ?? null,
      currency: (currency ?? "PKR").toUpperCase(),
      region: region ?? null,
      note: note ?? null,
    }).returning();
    res.json({ code: 200, message: "Plan request submitted. Admin will review shortly.", data: request });
  } catch (err) {
    req.log.error({ err }, "Customer plan-request failed");
    res.status(500).json({ code: 500, message: "Failed to submit plan request", data: null });
  }
}));

router.get("/sim/customer/plan-requests", simCustomerAuth(async (req: any, res): Promise<void> => {
  try {
    const requests = await db.select().from(simPlanRequestsTable)
      .where(eq(simPlanRequestsTable.customerId, req.simCustomer.id))
      .orderBy(desc(simPlanRequestsTable.createdAt))
      .limit(50);
    res.json({ code: 200, message: "OK", data: requests });
  } catch {
    res.status(500).json({ code: 500, message: "Failed", data: null });
  }
}));

// Customer submits a top-up request (status: pending — admin must approve via /sim/admin/customers/:id/topup)
router.post("/sim/customer/topup-request", simCustomerAuth(async (req: any, res): Promise<void> => {
  try {
    const { amountPkr, amountCny, amountUsd, note } = req.body as {
      amountPkr?: number; amountCny?: number; amountUsd?: number; note?: string;
    };
    if (!amountPkr && !amountCny && !amountUsd) {
      res.status(400).json({ code: 400, message: "At least one amount (PKR, CNY, or USD) is required", data: null }); return;
    }
    const [request] = await db.insert(simTopupsTable).values({
      customerId: req.simCustomer.id,
      amountPkr: String(amountPkr ?? 0),
      amountCny: String(amountCny ?? 0),
      amountUsd: String(amountUsd ?? 0),
      note: note ?? null,
      status: "pending",
    }).returning();
    res.json({ code: 200, message: "Top-up request submitted. Admin will credit your account shortly.", data: request });
  } catch (err) {
    req.log.error({ err }, "Customer topup request failed");
    res.status(500).json({ code: 500, message: "Failed to submit request", data: null });
  }
}));

router.get("/sim/customer/orders", simCustomerAuth(async (req: any, res): Promise<void> => {
  try {
    const orders = await db.select().from(simOrderHistoryTable)
      .where(eq(simOrderHistoryTable.customerId, req.simCustomer.id))
      .orderBy(desc(simOrderHistoryTable.createdAt)).limit(100);
    res.json({ code: 200, message: "OK", data: orders });
  } catch {
    res.status(500).json({ code: 500, message: "Failed", data: null });
  }
}));

// ─── Customer: SIM Cards ──────────────────────────────────────────────────

router.get("/sim/customer/sims", simCustomerAuth(async (req: any, res): Promise<void> => {
  try {
    const sims = await db.select().from(simCustomerSimsTable)
      .where(eq(simCustomerSimsTable.customerId, req.simCustomer.id));
    // Merge live provider status for each SIM (non-blocking — partial failures degrade gracefully)
    const withStatus = await Promise.all(sims.map(async (sim) => {
      try {
        const live = await callApi<Record<string, unknown>>("/queryCard", { iccid: sim.iccid });
        if (live.code === 200 && live.data) {
          const liveData = live.data as Record<string, unknown>;
          const expireTime = liveData.expireTime as string | undefined;
          const rawUsage = liveData.dataUsage;
          const dataUsageMb = typeof rawUsage === "number" ? rawUsage : (typeof rawUsage === "string" ? parseFloat(rawUsage) : null);
          const rawLimit = liveData.totalVolume ?? liveData.planLimit ?? liveData.dataLimit ?? liveData.flowLimit;
          const planLimitMb = typeof rawLimit === "number" ? rawLimit : (typeof rawLimit === "string" ? parseFloat(rawLimit) : null);
          await db.update(simCustomerSimsTable)
            .set({
              lastSyncedAt: new Date(),
              ...(expireTime ? { expireTime } : {}),
              ...(dataUsageMb != null && !isNaN(dataUsageMb) ? { dataUsageMb: String(dataUsageMb) } : {}),
              ...(planLimitMb != null && !isNaN(planLimitMb) && planLimitMb > 0 ? { planLimitMb: String(planLimitMb) } : {}),
            })
            .where(eq(simCustomerSimsTable.id, sim.id));
        }
        return { ...sim, liveStatus: live.code === 200 ? live.data : null };
      } catch {
        return { ...sim, liveStatus: null };
      }
    }));
    res.json({ code: 200, message: "OK", data: withStatus });
  } catch {
    res.status(500).json({ code: 500, message: "Failed", data: null });
  }
}));

router.post("/sim/customer/sims/add", simCustomerAuth(async (req: any, res): Promise<void> => {
  try {
    const { iccid, nickname } = req.body as { iccid: string; nickname?: string };
    if (!iccid?.trim()) { res.status(400).json({ code: 400, message: "ICCID required", data: null }); return; }
    const simData = await callApi<{ iccid?: string; msisdn?: string; imsi?: string }>("/queryCard", { iccid: iccid.trim() });
    if (simData.code !== 200 || !simData.data?.iccid) {
      res.status(404).json({ code: 404, message: "ICCID not found. Contact support.", data: null }); return;
    }
    const [sim] = await db.insert(simCustomerSimsTable).values({
      customerId: req.simCustomer.id,
      iccid: simData.data.iccid,
      msisdn: simData.data.msisdn ?? null,
      nickname: nickname?.trim() ?? null,
    }).onConflictDoNothing().returning();
    res.json({ code: 200, message: "SIM added", data: sim });
  } catch (err) {
    req.log.error({ err }, "Customer add SIM failed");
    res.status(500).json({ code: 500, message: "Failed to add SIM", data: null });
  }
}));

router.delete("/sim/customer/sims/:simId", simCustomerAuth(async (req: any, res): Promise<void> => {
  try {
    const simId = Number(req.params.simId);
    const [existing] = await db.select().from(simCustomerSimsTable)
      .where(and(eq(simCustomerSimsTable.id, simId), eq(simCustomerSimsTable.customerId, req.simCustomer.id)))
      .limit(1);
    if (!existing) { res.status(403).json({ code: 403, message: "SIM not found in your account", data: null }); return; }
    await db.delete(simCustomerSimsTable).where(eq(simCustomerSimsTable.id, simId));
    res.json({ code: 200, message: "SIM removed", data: null });
  } catch {
    res.status(500).json({ code: 500, message: "Failed", data: null });
  }
}));

// Primary SIM detail route (ownership-verified live data from provider)
router.get("/sim/customer/sims/:iccid", simCustomerAuth(async (req: any, res): Promise<void> => {
  try {
    const iccid = req.params.iccid;
    const simRow = await requireSimOwnership(iccid, req.simCustomer.id, res);
    if (!simRow) return;
    const result = await callApi("/queryCard", { iccid });
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Customer SIM detail failed");
    res.status(502).json({ code: 502, message: "Failed to reach IoT API", data: null });
  }
}));

router.post("/sim/customer/sims/:iccid/refresh", simCustomerAuth(async (req: any, res): Promise<void> => {
  try {
    if (!await requireSimOwnership(req.params.iccid, req.simCustomer.id, res)) return;
    res.json(await callApi("/refreshCard", { iccid: req.params.iccid }));
  } catch (err) {
    req.log.error({ err }, "Customer SIM refresh failed");
    res.status(502).json({ code: 502, message: "Failed to reach IoT API", data: null });
  }
}));

router.get("/sim/customer/sims/:iccid/location", simCustomerAuth(async (req: any, res): Promise<void> => {
  try {
    if (!await requireSimOwnership(req.params.iccid, req.simCustomer.id, res)) return;
    const iccid = req.params.iccid;
    let locationResult = await callApi<Record<string, unknown>>("/queryLocation", { iccid });
    // Fallback: if location unavailable or no coordinates, enrich with queryCard region info
    const locData = locationResult.data as Record<string, unknown> | null;
    if (locationResult.code !== 200 || !locData?.lat) {
      try {
        const cardResult = await callApi<Record<string, unknown>>("/queryCard", { iccid });
        locationResult = {
          ...locationResult,
          data: { ...(locData ?? {}), cardInfo: cardResult.code === 200 ? cardResult.data : null },
        };
      } catch { /* card fallback unavailable — return whatever we have */ }
    }
    res.json(locationResult);
  } catch (err) {
    req.log.error({ err }, "Customer SIM location failed");
    res.status(502).json({ code: 502, message: "Failed to reach IoT API", data: null });
  }
}));

router.post("/sim/customer/sims/:iccid/order-plan", simCustomerAuth(async (req: any, res): Promise<void> => {
  try {
    if (!await requireSimOwnership(req.params.iccid, req.simCustomer.id, res)) return;
    const { planId, currency, regionId, region, planName, amount } = req.body as {
      planId: number; currency?: string; regionId?: number; region?: string; planName?: string; amount?: number;
    };
    if (!planId) { res.status(400).json({ code: 400, message: "planId is required", data: null }); return; }
    const cur = (currency ?? "CNY").toUpperCase();

    // Resolve local DB plan → provider plan code; derive price
    const [plan] = await db.select().from(simPlansTable).where(eq(simPlansTable.id, planId)).limit(1);
    const providerPlanId = plan?.planCode ? Number(plan.planCode) : planId;
    const planPrice = plan
      ? parseFloat(cur === "PKR" ? (plan.pricePkr ?? "0") : cur === "USD" ? (plan.priceUsd ?? "0") : (plan.priceCny ?? "0"))
      : (amount ?? 0);
    const resolvedRegionId = regionId ?? (region && /^\d+$/.test(region.trim()) ? Number(region.trim()) : undefined);

    if (planPrice > 0) {
      const balErr = await checkAndDeductBalance(req.simCustomer.id, cur, planPrice);
      if (balErr) { res.status(402).json({ code: 402, message: balErr, data: null }); return; }
    }

    const params: Record<string, unknown> = { iccid: req.params.iccid, planId: providerPlanId };
    if (currency) params.currency = currency;
    if (resolvedRegionId) params.regionId = resolvedRegionId;
    let result: Awaited<ReturnType<typeof callApi<string>>>;
    try {
      result = await callApi<string>("/orderPlan", params);
    } catch (provErr) {
      if (planPrice > 0) await refundBalance(req.simCustomer.id, cur, planPrice);
      req.log.error({ err: provErr }, "Customer order plan provider call failed");
      res.status(502).json({ code: 502, message: "Failed to reach IoT API", data: null }); return;
    }
    if (result.code !== 200 && planPrice > 0) await refundBalance(req.simCustomer.id, cur, planPrice);
    if (result.code === 200) {
      const amtField = cur === "PKR" ? { amountPkr: String(planPrice) } : cur === "USD" ? { amountUsd: String(planPrice) } : { amountCny: String(planPrice) };
      await db.insert(simOrderHistoryTable).values({
        customerId: req.simCustomer.id, iccid: req.params.iccid, action: "order",
        planId: String(providerPlanId), planName: plan?.planName ?? planName ?? null,
        orderNumber: result.data, currency: cur, ...amtField,
      });
    }
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Customer order plan failed");
    res.status(500).json({ code: 500, message: "Order failed", data: null });
  }
}));

router.post("/sim/customer/sims/:iccid/renew", simCustomerAuth(async (req: any, res): Promise<void> => {
  try {
    if (!await requireSimOwnership(req.params.iccid, req.simCustomer.id, res)) return;
    const { currency, month, amount } = req.body as { currency?: string; month?: number; amount?: number };
    const cur = (currency ?? "CNY").toUpperCase();

    // Derive renew price: caller-supplied amount → last order-plan from history → 0 (admin-managed SIM)
    let renewPrice = amount ?? 0;
    if (renewPrice === 0) {
      // Look up the most recent order/change action for this ICCID to find the plan in our catalog
      const [lastOrder] = await db.select().from(simOrderHistoryTable)
        .where(and(
          eq(simOrderHistoryTable.iccid, req.params.iccid),
          eq(simOrderHistoryTable.customerId, req.simCustomer.id),
          sql`${simOrderHistoryTable.action} IN ('order','change')`
        ))
        .orderBy(desc(simOrderHistoryTable.createdAt))
        .limit(1);
      if (lastOrder?.planId) {
        const [plan] = await db.select().from(simPlansTable)
          .where(eq(simPlansTable.planCode, lastOrder.planId))
          .limit(1);
        if (plan) {
          renewPrice = parseFloat(cur === "PKR" ? (plan.pricePkr ?? "0") : cur === "USD" ? (plan.priceUsd ?? "0") : (plan.priceCny ?? "0")) || 0;
        }
      }
    }

    if (renewPrice > 0) {
      const balErr = await checkAndDeductBalance(req.simCustomer.id, cur, renewPrice);
      if (balErr) { res.status(402).json({ code: 402, message: balErr, data: null }); return; }
    }

    const params: Record<string, unknown> = { iccid: req.params.iccid };
    if (currency) params.currency = currency;
    if (month) params.month = month;
    let result: Awaited<ReturnType<typeof callApi<string>>>;
    try {
      result = await callApi<string>("/renewPlan", params);
    } catch (provErr) {
      if (renewPrice > 0) await refundBalance(req.simCustomer.id, cur, renewPrice);
      req.log.error({ err: provErr }, "Customer renew provider call failed");
      res.status(502).json({ code: 502, message: "Failed to reach IoT API", data: null }); return;
    }
    if (result.code !== 200 && renewPrice > 0) await refundBalance(req.simCustomer.id, cur, renewPrice);
    if (result.code === 200) {
      const amtField = cur === "PKR" ? { amountPkr: String(renewPrice) } : cur === "USD" ? { amountUsd: String(renewPrice) } : { amountCny: String(renewPrice) };
      await db.insert(simOrderHistoryTable).values({
        customerId: req.simCustomer.id, iccid: req.params.iccid,
        action: "renew", orderNumber: result.data, currency: cur, ...amtField,
      });
    }
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Customer renew failed");
    res.status(500).json({ code: 500, message: "Renewal failed", data: null });
  }
}));

router.post("/sim/customer/sims/:iccid/change-plan", simCustomerAuth(async (req: any, res): Promise<void> => {
  try {
    if (!await requireSimOwnership(req.params.iccid, req.simCustomer.id, res)) return;
    const { planId, currency, regionId, region, planName, amount } = req.body as {
      planId: number; currency?: string; regionId?: number; region?: string; planName?: string; amount?: number;
    };
    if (!planId) { res.status(400).json({ code: 400, message: "planId is required", data: null }); return; }
    const cur = (currency ?? "CNY").toUpperCase();

    const [plan] = await db.select().from(simPlansTable).where(eq(simPlansTable.id, planId)).limit(1);
    const providerPlanId = plan?.planCode ? Number(plan.planCode) : planId;
    const planPrice = plan
      ? parseFloat(cur === "PKR" ? (plan.pricePkr ?? "0") : cur === "USD" ? (plan.priceUsd ?? "0") : (plan.priceCny ?? "0"))
      : (amount ?? 0);
    const resolvedRegionId = regionId ?? (region && /^\d+$/.test(region.trim()) ? Number(region.trim()) : undefined);

    if (planPrice > 0) {
      const balErr = await checkAndDeductBalance(req.simCustomer.id, cur, planPrice);
      if (balErr) { res.status(402).json({ code: 402, message: balErr, data: null }); return; }
    }

    const params: Record<string, unknown> = { iccid: req.params.iccid, planId: providerPlanId };
    if (currency) params.currency = currency;
    if (resolvedRegionId) params.regionId = resolvedRegionId;
    let result: Awaited<ReturnType<typeof callApi<string>>>;
    try {
      result = await callApi<string>("/changePlan", params);
    } catch (provErr) {
      if (planPrice > 0) await refundBalance(req.simCustomer.id, cur, planPrice);
      req.log.error({ err: provErr }, "Customer change plan provider call failed");
      res.status(502).json({ code: 502, message: "Failed to reach IoT API", data: null }); return;
    }
    if (result.code !== 200 && planPrice > 0) await refundBalance(req.simCustomer.id, cur, planPrice);
    if (result.code === 200) {
      const amtField = cur === "PKR" ? { amountPkr: String(planPrice) } : cur === "USD" ? { amountUsd: String(planPrice) } : { amountCny: String(planPrice) };
      await db.insert(simOrderHistoryTable).values({
        customerId: req.simCustomer.id, iccid: req.params.iccid, action: "change",
        planId: String(providerPlanId), planName: plan?.planName ?? planName ?? null,
        orderNumber: result.data, currency: cur, ...amtField,
      });
    }
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Customer change plan failed");
    res.status(500).json({ code: 500, message: "Plan change failed", data: null });
  }
}));

// ─── Customer: Alerts ────────────────────────────────────────────────────

router.get("/sim/customer/alerts", simCustomerAuth(async (req: any, res): Promise<void> => {
  try {
    const customer = req.simCustomer;
    const sims = await db.select().from(simCustomerSimsTable)
      .where(eq(simCustomerSimsTable.customerId, customer.id));

    const [settings] = await db.select().from(simAlertSettingsTable).where(eq(simAlertSettingsTable.id, 1)).limit(1);

    const alerts: Array<{ type: string; iccid: string | null; message: string }> = [];

    // Expiry alerts: SIM expires within 7 days
    const sevenDaysFromNow = new Date(Date.now() + 7 * 86_400_000);
    for (const sim of sims) {
      if (sim.expireTime) {
        const expires = new Date(sim.expireTime);
        if (!isNaN(expires.getTime()) && expires <= sevenDaysFromNow && expires > new Date()) {
          const daysLeft = Math.ceil((expires.getTime() - Date.now()) / 86_400_000);
          const label = sim.nickname ?? sim.iccid.slice(-8);
          alerts.push({
            type: "expiry",
            iccid: sim.iccid,
            message: `SIM ${label} expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"} (${expires.toLocaleDateString("en-PK", { timeZone: "Asia/Karachi" })})`,
          });
        }
      }
    }

    // Low balance alerts
    if (settings) {
      const thresholdPkr = parseFloat(settings.lowBalancePkr) || 0;
      const thresholdCny = parseFloat(settings.lowBalanceCny) || 0;
      const thresholdUsd = parseFloat(settings.lowBalanceUsd) || 0;
      const balPkr = parseFloat(customer.balancePkr) || 0;
      const balCny = parseFloat(customer.balanceCny) || 0;
      const balUsd = parseFloat(customer.balanceUsd) || 0;

      if (thresholdPkr > 0 && balPkr < thresholdPkr) {
        alerts.push({ type: "low_balance", iccid: null, message: `PKR balance (Rs ${balPkr.toLocaleString()}) is below the warning threshold of Rs ${thresholdPkr.toLocaleString()}` });
      }
      if (thresholdCny > 0 && balCny < thresholdCny) {
        alerts.push({ type: "low_balance", iccid: null, message: `CNY balance (¥${balCny.toFixed(2)}) is below the warning threshold of ¥${thresholdCny.toFixed(2)}` });
      }
      if (thresholdUsd > 0 && balUsd < thresholdUsd) {
        alerts.push({ type: "low_balance", iccid: null, message: `USD balance ($${balUsd.toFixed(2)}) is below the warning threshold of $${thresholdUsd.toFixed(2)}` });
      }
    }

    // Data usage alerts
    const dataThresholdPct = settings?.dataUsageThresholdPct ?? 80;
    if (dataThresholdPct > 0) {
      for (const sim of sims) {
        const usageMb = parseFloat(sim.dataUsageMb ?? "0") || 0;
        const limitMb = parseFloat(sim.planLimitMb ?? "0") || 0;
        if (limitMb > 0 && usageMb > 0) {
          const usedPct = (usageMb / limitMb) * 100;
          if (usedPct >= dataThresholdPct) {
            const label = sim.nickname ?? sim.iccid.slice(-8);
            const limitStr = limitMb >= 1024 ? `${(limitMb / 1024).toFixed(1)} GB` : `${limitMb.toFixed(0)} MB`;
            const usageStr = usageMb >= 1024 ? `${(usageMb / 1024).toFixed(1)} GB` : `${usageMb.toFixed(0)} MB`;
            alerts.push({
              type: "data_usage",
              iccid: sim.iccid,
              message: `SIM ${label} has used ${Math.round(usedPct)}% of its data plan (${usageStr} / ${limitStr})`,
            });
          }
        }
      }
    }

    // Log new alerts to notifications (dedup: skip if same type+iccid was logged in last 24h)
    const dayAgo = new Date(Date.now() - 86_400_000);
    for (const alert of alerts) {
      const existing = await db.select({ id: simNotificationsTable.id })
        .from(simNotificationsTable)
        .where(
          and(
            eq(simNotificationsTable.customerId, customer.id),
            eq(simNotificationsTable.type, alert.type),
            alert.iccid ? eq(simNotificationsTable.iccid, alert.iccid) : sql`iccid IS NULL`,
            gte(simNotificationsTable.createdAt, dayAgo)
          )
        ).limit(1);
      if (existing.length === 0) {
        await db.insert(simNotificationsTable).values({
          customerId: customer.id,
          type: alert.type,
          iccid: alert.iccid ?? null,
          message: alert.message,
        });
      }
    }

    res.json({ code: 200, message: "OK", data: alerts });
  } catch (err) {
    req.log.error({ err }, "Customer alerts fetch failed");
    res.status(500).json({ code: 500, message: "Failed to fetch alerts", data: null });
  }
}));

// ─── Customer: Notifications log ─────────────────────────────────────────

router.get("/sim/customer/notifications", simCustomerAuth(async (req: any, res): Promise<void> => {
  try {
    const notifications = await db.select().from(simNotificationsTable)
      .where(eq(simNotificationsTable.customerId, req.simCustomer.id))
      .orderBy(desc(simNotificationsTable.createdAt)).limit(100);
    res.json({ code: 200, message: "OK", data: notifications });
  } catch (err) {
    req.log.error({ err }, "Customer notifications fetch failed");
    res.status(500).json({ code: 500, message: "Failed", data: null });
  }
}));

router.post("/sim/customer/notifications/read-all", simCustomerAuth(async (req: any, res): Promise<void> => {
  try {
    await db.update(simNotificationsTable)
      .set({ isRead: true })
      .where(eq(simNotificationsTable.customerId, req.simCustomer.id));
    res.json({ code: 200, message: "All notifications marked as read", data: null });
  } catch (err) {
    req.log.error({ err }, "Customer mark notifications read failed");
    res.status(500).json({ code: 500, message: "Failed", data: null });
  }
}));

// ─── Admin: Alert Settings ────────────────────────────────────────────────

router.get("/sim/admin/alert-settings", simAdminAuth(async (_req, res): Promise<void> => {
  try {
    const [settings] = await db.select().from(simAlertSettingsTable).where(eq(simAlertSettingsTable.id, 1)).limit(1);
    res.json({ code: 200, message: "OK", data: settings ?? { id: 1, lowBalancePkr: "0", lowBalanceCny: "0", lowBalanceUsd: "0", dataUsageThresholdPct: 80 } });
  } catch (err) {
    (_req as any).log?.error({ err }, "Get alert settings failed");
    res.status(500).json({ code: 500, message: "Failed", data: null });
  }
}));

router.put("/sim/admin/alert-settings", simAdminAuth(async (req, res): Promise<void> => {
  try {
    const { lowBalancePkr, lowBalanceCny, lowBalanceUsd, dataUsageThresholdPct } = req.body as {
      lowBalancePkr?: number; lowBalanceCny?: number; lowBalanceUsd?: number; dataUsageThresholdPct?: number;
    };
    const parsedPct = Math.min(100, Math.max(0, Math.round(Number(dataUsageThresholdPct ?? 80))));
    const [updated] = await db.update(simAlertSettingsTable)
      .set({
        lowBalancePkr: String(Math.max(0, Number(lowBalancePkr ?? 0))),
        lowBalanceCny: String(Math.max(0, Number(lowBalanceCny ?? 0))),
        lowBalanceUsd: String(Math.max(0, Number(lowBalanceUsd ?? 0))),
        dataUsageThresholdPct: parsedPct,
        updatedAt: new Date(),
      })
      .where(eq(simAlertSettingsTable.id, 1))
      .returning();
    if (!updated) {
      const [inserted] = await db.insert(simAlertSettingsTable).values({ id: 1,
        lowBalancePkr: String(Math.max(0, Number(lowBalancePkr ?? 0))),
        lowBalanceCny: String(Math.max(0, Number(lowBalanceCny ?? 0))),
        lowBalanceUsd: String(Math.max(0, Number(lowBalanceUsd ?? 0))),
        dataUsageThresholdPct: parsedPct,
      }).returning();
      res.json({ code: 200, message: "Settings saved", data: inserted });
      return;
    }
    res.json({ code: 200, message: "Settings saved", data: updated });
  } catch (err) {
    req.log.error({ err }, "Update alert settings failed");
    res.status(500).json({ code: 500, message: "Failed to update settings", data: null });
  }
}));

// ─── Admin: Trigger expiry alert job ─────────────────────────────────────

router.post("/sim/admin/send-expiry-alerts", simAdminAuth(async (req, res): Promise<void> => {
  try {
    const stats = await runExpiryAlertJob();
    res.json({ code: 200, message: "Expiry alert job complete", data: stats });
  } catch (err) {
    req.log.error({ err }, "SIM expiry alert job failed");
    res.status(500).json({ code: 500, message: "Job failed", data: null });
  }
}));

// ─── Customer: Plans & Regions (public) ──────────────────────────────────

router.get("/sim/customer/plans", async (_req, res): Promise<void> => {
  try {
    const plans = await db.select().from(simPlansTable)
      .where(eq(simPlansTable.isActive, true))
      .orderBy(asc(simPlansTable.sortOrder), asc(simPlansTable.id));
    res.json({ code: 200, message: "OK", data: plans });
  } catch {
    res.status(500).json({ code: 500, message: "Failed to fetch plans", data: null });
  }
});

router.get("/sim/customer/regions", async (req, res): Promise<void> => {
  try {
    const params: Record<string, unknown> = {};
    if (req.query.name) params.name = String(req.query.name);
    res.json(await callApi("/queryRegionList", params));
  } catch {
    res.status(502).json({ code: 502, message: "Failed to reach IoT API", data: null });
  }
});

// ─── Customer: SMS ────────────────────────────────────────────────────────

router.get("/sim/customer/sms", simCustomerAuth(async (req: any, res): Promise<void> => {
  try {
    const { iccid } = req.query as { iccid?: string };
    const customerId: number = req.simCustomer.id;
    const whereClause = iccid
      ? and(eq(simSmsMessagesTable.customerId, customerId), eq(simSmsMessagesTable.iccid, iccid))
      : eq(simSmsMessagesTable.customerId, customerId);
    const msgs = await db.select().from(simSmsMessagesTable)
      .where(whereClause)
      .orderBy(desc(simSmsMessagesTable.createdAt)).limit(100);
    res.json({ code: 200, message: "OK", data: msgs });
  } catch {
    res.status(500).json({ code: 500, message: "Failed", data: null });
  }
}));

router.post("/sim/customer/sms", simCustomerAuth(async (req: any, res): Promise<void> => {
  try {
    const { iccid, toNumber, body: msgBody } = req.body as { iccid: string; toNumber: string; body: string };
    if (!iccid || !toNumber || !msgBody) {
      res.status(400).json({ code: 400, message: "iccid, toNumber, and body are required", data: null }); return;
    }
    // Verify the customer owns this SIM before logging the outbound SMS
    const simRow = await requireSimOwnership(iccid, req.simCustomer.id, res);
    if (!simRow) return;
    const [msg] = await db.insert(simSmsMessagesTable).values({
      customerId: req.simCustomer.id, iccid, direction: "sent", toNumber, body: msgBody,
    }).returning();
    res.json({ code: 200, message: "SMS sent", data: msg });
  } catch (err) {
    req.log.error({ err }, "Customer SMS send failed");
    res.status(500).json({ code: 500, message: "Failed to send SMS", data: null });
  }
}));

// ─── Public: SIM lookup ───────────────────────────────────────────────────

router.post("/sim/lookup", async (req, res): Promise<void> => {
  try {
    const { iccid, msisdn } = req.body as { iccid?: string; msisdn?: string };
    if (!iccid && !msisdn) {
      res.status(400).json({ code: 400, message: "ICCID or MSISDN required", data: null }); return;
    }
    const params: Record<string, unknown> = {};
    if (iccid) params.iccid = iccid.trim();
    if (msisdn) params.msisdn = msisdn.trim();
    res.json(await callApi("/queryCard", params));
  } catch (err) {
    req.log.error({ err }, "SIM public lookup failed");
    res.status(502).json({ code: 502, message: "Failed to reach IoT API", data: null });
  }
});

// ─── Public: Plan catalog ─────────────────────────────────────────────────

router.get("/sim/plans", async (_req, res): Promise<void> => {
  try {
    const plans = await db.select().from(simPlansTable)
      .where(eq(simPlansTable.isActive, true))
      .orderBy(asc(simPlansTable.sortOrder), asc(simPlansTable.id));
    res.json({ code: 200, message: "OK", data: plans });
  } catch {
    res.status(500).json({ code: 500, message: "Failed to fetch plans", data: null });
  }
});

export default router;
