import { db, couriersTable } from "@workspace/db";
import { sql } from "drizzle-orm";

/**
 * Pakistani courier tracking URL templates.
 * Use {cn} as the consignment-number placeholder.
 *
 * Idempotent: upserts on api_provider (unique index). Safe to run multiple
 * times — each run will refresh the tracking URL and name if they have
 * drifted from the defaults without overwriting admin-set apiKey/apiPassword.
 */
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

async function main() {
  console.log("Seeding couriers…");
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
  const all = await db.select().from(couriersTable).orderBy(couriersTable.name);
  console.log("Couriers in DB:");
  all.forEach((c) =>
    console.log(`  [${c.apiProvider ?? "—"}] ${c.name} — ${c.trackingUrl ?? "no URL"}`),
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
