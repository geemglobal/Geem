import { type Request, type Response, type NextFunction } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getUserIdFromToken } from "./auth";

export interface UserPermSet {
  view: boolean;
  add: boolean;
  edit: boolean;
  delete: boolean;
}

export interface UserPermissions {
  [module: string]: UserPermSet;
}

// Map URL prefixes to permission module keys (sorted by length at runtime)
const ROUTE_MODULE_MAP: Record<string, string> = {
  "/dashboard": "reports",
  "/reports": "reports",
  "/activity": "reports",
  "/visitors": "reports",
  "/master/brands": "masterData",
  "/master/models": "masterData",
  "/master/categories": "masterData",
  "/master/vendors": "masterData",
  "/master/couriers": "masterData",
  "/master/payment-methods": "masterData",
  "/master": "masterData",
  "/inventory": "inventory",
  "/imei": "inventory",
  "/customers": "customers",
  "/invoices": "invoices",
  "/quotations": "quotations",
  "/procurement": "procurement",
  "/products": "products",
  "/product-ai": "products",
  "/web-orders": "webOrders",
  "/web-order-returns": "webOrders",
  "/shipments": "shipments",
  "/service-tickets": "serviceTickets",
  "/pre-orders": "preorders",
  "/pos": "pos",
  "/vault": "vault",
  "/expenses": "reports",
  "/expense-categories": "reports",
  "/users": "settings",
  "/settings": "settings",
  "/system": "settings",
  "/integrations": "settings",
  "/sim": "sim",
  "/chat": "settings",
  "/wallet": "vault",
  "/notifications": "reports",
};

// Routes that bypass permission checks entirely (public or auth-only)
const BYPASS_ROUTES = new Set([
  "/health",
  "/auth",
  "/shop",
  "/storage",
  "/search",
  "/push",
  "/visitor",      // shop visitor tracking
  "/imei-pool",    // public IMEI check
]);

function methodToAction(method: string): "view" | "add" | "edit" | "delete" | null {
  switch (method.toUpperCase()) {
    case "GET": return "view";
    case "POST": return "add";
    case "PUT": case "PATCH": return "edit";
    case "DELETE": return "delete";
    default: return null;
  }
}

function getModuleName(pathname: string): string | null {
  const sortedPaths = Object.keys(ROUTE_MODULE_MAP).sort((a, b) => b.length - a.length);
  for (const prefix of sortedPaths) {
    if (pathname === prefix || pathname.startsWith(prefix + "/")) {
      return ROUTE_MODULE_MAP[prefix];
    }
  }
  return null;
}

// Simple in-memory cache to avoid DB hit on every request
const permCache = new Map<number, { role: string; permissions: UserPermissions | null; ts: number }>();
const CACHE_TTL = 30_000; // 30 seconds

async function getUserPermissions(userId: number): Promise<{ role: string; permissions: UserPermissions | null }> {
  const cached = permCache.get(userId);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return { role: cached.role, permissions: cached.permissions };
  }
  const [user] = await db
    .select({ role: usersTable.role, permissions: usersTable.permissions })
    .from(usersTable)
    .where(eq(usersTable.id, userId));
  const result = user
    ? { role: user.role, permissions: (user.permissions as UserPermissions) ?? null }
    : { role: "staff", permissions: null };
  permCache.set(userId, { ...result, ts: Date.now() });
  return result;
}

export async function requirePermission(req: Request, res: Response, next: NextFunction): Promise<void> {
  const pathname = req.path;

  // Skip for bypassed routes
  for (const bypass of BYPASS_ROUTES) {
    if (pathname === bypass || pathname.startsWith(bypass + "/")) {
      return next();
    }
  }

  // Get user from token
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const userId = await getUserIdFromToken(auth.slice(7));
  if (!userId) {
    res.status(401).json({ error: "Invalid token" });
    return;
  }

  // Store userId for downstream use
  (req as unknown as Record<string, unknown>).__userId = userId;

  // Get user permissions
  const { role, permissions } = await getUserPermissions(userId);

  // Admin users have full access
  if (role === "admin") {
    return next();
  }

  // Determine module and action
  const moduleName = getModuleName(pathname);
  const action = methodToAction(req.method);

  // If we can't determine the module/action, allow by default (safety for unknown routes)
  if (!moduleName || !action) {
    return next();
  }

  // Check permission
  const modPerms = permissions?.[moduleName];
  if (!modPerms || !modPerms[action]) {
    res.status(403).json({
      error: "Access denied",
      module: moduleName,
      action,
      message: "You do not have permission to " + action + " " + moduleName,
    });
    return;
  }

  next();
}
