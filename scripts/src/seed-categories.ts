import { db, categoriesTable } from "@workspace/db";
import { sql } from "drizzle-orm";

const CATEGORIES = [
  "Smartphones",
  "Tablets",
  "Laptops",
  "Smartwatches & Wearables",
  "Headphones & Earbuds",
  "Accessories",
  "Chargers & Cables",
  "Cases & Covers",
  "Power Banks",
  "Gaming Accessories",
  "Refurbished Devices",
  "Memory Cards & Storage",
  "Networking Equipment",
  "Smart Home",
  "Spy Cameras & Surveillance",
  "GPS Trackers",
  "Security Equipment",
  "Drones",
];

async function main() {
  for (const name of CATEGORIES) {
    await db.insert(categoriesTable)
      .values({ name })
      .onConflictDoNothing();
  }
  const all = await db.select().from(categoriesTable).orderBy(categoriesTable.name);
  console.log("Categories now in DB:", all.map(c => c.name).join(", "));
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
