/**
 * Idempotent courier seed — called once on every server start.
 *
 * Inserts the four common Pakistani couriers with their tracking URL
 * templates. Uses onConflictDoUpdate targeting the unique api_provider
 * index so repeated restarts are safe and template updates in code are
 * picked up automatically without duplicating rows.
 *
 * apiKey / apiPassword are intentionally NOT touched by the upsert so
 * admin-entered credentials are preserved.
 */
import { db, couriersTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger";

const DEFAULT_COURIERS = [
  {
    name: "Leopard Courier (LCS)",
    apiProvider: "leopards",
    trackingUrl:
      "https://www.leopardscourier.com/leopards-power-track/?trackid={cn}",
  },
  {
    name: "TCS",
    apiProvider: "tcs",
    trackingUrl: "https://www.tcsexpress.com/track/{cn}",
  },
  {
    name: "M&P (Swyft)",
    apiProvider: "mnp",
    trackingUrl: "https://mp.pk/tracking?cn={cn}",
  },
  {
    name: "Trax",
    apiProvider: "trax",
    trackingUrl: "https://portal.traxlogistics.com/tracking?cn={cn}",
  },
];

export async function seedCouriers() {
  try {
    for (const courier of DEFAULT_COURIERS) {
      await db
        .insert(couriersTable)
        .values({ ...courier, active: true })
        .onConflictDoUpdate({
          target: couriersTable.apiProvider,
          set: {
            name: sql`excluded.name`,
            trackingUrl: sql`excluded.tracking_url`,
          },
        });
    }
    logger.info("Courier seed complete");
  } catch (err) {
    logger.warn({ err }, "Courier seed failed — non-fatal, server will continue");
  }
}
