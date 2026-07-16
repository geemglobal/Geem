import { Router } from "express";
import { db, activityLogsTable } from "@workspace/db";
import { desc, ilike, or } from "drizzle-orm";

export async function logActivity(opts: {
  userId?: number | null;
  userEmail?: string | null;
  action: string;
  entity?: string;
  entityId?: string | number;
  details?: string;
  ipAddress?: string;
  userAgent?: string;
  status?: "success" | "failed";
  // GPS
  latitude?: string | null;
  longitude?: string | null;
  locationName?: string | null;
  // Device
  browser?: string | null;
  os?: string | null;
  deviceType?: string | null;
}): Promise<void> {
  try {
    await db.insert(activityLogsTable).values({
      userId: opts.userId ?? null,
      userEmail: opts.userEmail ?? null,
      action: opts.action,
      entity: opts.entity ?? null,
      entityId: opts.entityId ? String(opts.entityId) : null,
      details: opts.details ?? null,
      ipAddress: opts.ipAddress ?? null,
      userAgent: opts.userAgent ? opts.userAgent.slice(0, 300) : null,
      status: opts.status ?? "success",
      latitude: opts.latitude ?? null,
      longitude: opts.longitude ?? null,
      locationName: opts.locationName ?? null,
      browser: opts.browser ?? null,
      os: opts.os ?? null,
      deviceType: opts.deviceType ?? null,
    });
  } catch {
    // never throw from logging
  }
}

const router = Router();

router.get("/activity", async (req, res): Promise<void> => {
  const limit = Math.min(parseInt(String(req.query.limit ?? "100")), 500);
  const offset = parseInt(String(req.query.offset ?? "0"));
  const search = String(req.query.search ?? "").trim();

  const logs = await db
    .select()
    .from(activityLogsTable)
    .where(
      search
        ? or(
            ilike(activityLogsTable.action, `%${search}%`),
            ilike(activityLogsTable.userEmail, `%${search}%`),
            ilike(activityLogsTable.entity, `%${search}%`),
            ilike(activityLogsTable.details, `%${search}%`),
            ilike(activityLogsTable.locationName, `%${search}%`),
            ilike(activityLogsTable.browser, `%${search}%`),
            ilike(activityLogsTable.os, `%${search}%`),
          )
        : undefined,
    )
    .orderBy(desc(activityLogsTable.createdAt))
    .limit(limit)
    .offset(offset);

  res.json({ logs });
});

export default router;
