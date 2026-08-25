import { db, categoriesTable } from "@workspace/db";
import { sql } from "drizzle-orm";

async function main() {
  // Delete duplicates keeping lowest id per name (case-insensitive)
  await db.execute(sql`
    DELETE FROM categories a
    USING categories b
    WHERE a.id > b.id AND lower(a.name) = lower(b.name)
  `);
  const all = await db.select().from(categoriesTable).orderBy(categoriesTable.name);
  console.log("Categories after dedup:", all.map(c => `${c.id}:${c.name}`).join(", "));
  process.exit(0);
}
main().catch(err => { console.error(err); process.exit(1); });
