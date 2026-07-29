import { Router, type IRouter } from "express";
import { eq, and, count, sql } from "drizzle-orm";
import { db, imeiPoolTable, inventoryItemsTable, imeiHistoryTable } from "@workspace/db";

const router: IRouter = Router();

/** Luhn check digit for first 14 digits */
function luhnDigit(digits14: string): number {
  const digits = digits14.split("").map(Number);
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = digits[i];
    if ((digits.length - i) % 2 !== 0) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return (10 - (sum % 10)) % 10;
}

/** Generate 15-digit IMEI from 13-digit prefix + 1-digit serial (14 digits total → luhn) */
function makeImei(prefix13: string, serial: number): string {
  const serialStr = String(serial); // single digit: 0-9
  const digits14 = prefix13 + serialStr;
  return digits14 + luhnDigit(digits14);
}

// GET /imei-pool — list generated IMEIs
router.get("/imei-pool", async (req, res): Promise<void> => {
  const prefix = req.query.prefix ? String(req.query.prefix).slice(0, 13) : undefined;
  const used = req.query.used;
  const limit  = Math.min(500, Math.max(1, parseInt(String(req.query.limit ?? "100"), 10) || 100));
  const offset = Math.max(0, parseInt(String(req.query.offset ?? "0"), 10) || 0);

  const conditions = [];
  if (prefix) conditions.push(eq(imeiPoolTable.prefix13, prefix));
  if (used === "true") conditions.push(eq(imeiPoolTable.isUsed, true));
  if (used === "false") conditions.push(eq(imeiPoolTable.isUsed, false));

  const where = conditions.length
    ? conditions.length === 1 ? conditions[0] : and(...conditions)
    : undefined;

  const [{ total }] = await db.select({ total: count() }).from(imeiPoolTable).where(where);
  const rows = await db
    .select()
    .from(imeiPoolTable)
    .where(where)
    .orderBy(imeiPoolTable.serialNumber)
    .limit(limit)
    .offset(offset);

  res.json({ total, rows });
});

// GET /imei-pool/prefix-summary — unique prefixes with stats (for "Generate Next 10" UI)
router.get("/imei-pool/prefix-summary", async (req, res): Promise<void> => {
  const rows = await db
    .select({
      prefix13: imeiPoolTable.prefix13,
      total:    sql<number>`count(*)`,
      used:     sql<number>`sum(case when ${imeiPoolTable.isUsed} then 1 else 0 end)`,
      free:     sql<number>`sum(case when not ${imeiPoolTable.isUsed} then 1 else 0 end)`,
      maxSerial: sql<number>`max(${imeiPoolTable.serialNumber})`,
    })
    .from(imeiPoolTable)
    .groupBy(imeiPoolTable.prefix13)
    .orderBy(imeiPoolTable.prefix13);
  res.json(rows);
});

// POST /imei-pool/generate — generate batch of IMEIs
router.post("/imei-pool/generate", async (req, res): Promise<void> => {
  const { prefix13, quantity } = req.body;
  if (!prefix13 || typeof prefix13 !== "string" || prefix13.length !== 13 || !/^\d{13}$/.test(prefix13)) {
    res.status(400).json({ error: "prefix13 must be exactly 13 digits" });
    return;
  }
  const qty = parseInt(String(quantity ?? 1), 10);
  if (qty < 1 || qty > 10) {
    res.status(400).json({ error: "quantity must be 1–10 (serial digits 0–9)" });
    return;
  }

  // Find highest existing serial for this prefix
  const existing = await db
    .select({ maxSerial: sql<number>`max(${imeiPoolTable.serialNumber})` })
    .from(imeiPoolTable)
    .where(eq(imeiPoolTable.prefix13, prefix13));
  const startSerial = existing[0]?.maxSerial != null ? existing[0].maxSerial + 1 : 0;

  // Gather existing IMEIs in inventory so we skip duplicates
  const inventoryImeis = await db
    .select({ imei: inventoryItemsTable.imei })
    .from(inventoryItemsTable)
    .where(sql`${inventoryItemsTable.imei} IS NOT NULL`);
  const inventorySet = new Set(inventoryImeis.map(r => r.imei).filter(Boolean));

  // Also get existing pool IMEIs for this prefix
  const poolExisting = await db
    .select({ imei15: imeiPoolTable.imei15 })
    .from(imeiPoolTable)
    .where(eq(imeiPoolTable.prefix13, prefix13));
  const poolSet = new Set(poolExisting.map(r => r.imei15));

  const inserts = [];
  for (let i = 0; i < qty; i++) {
    const serial = startSerial + i;
    if (serial > 9) break; // cap at 9 (single digit 0-9)
    const imei15 = makeImei(prefix13, serial);
    // Skip duplicates in both pool and inventory
    if (poolSet.has(imei15) || inventorySet.has(imei15)) continue;
    inserts.push({ prefix13, imei15, serialNumber: serial });
  }

  if (!inserts.length) {
    res.status(400).json({ error: "All serials (0–9) already used for this prefix, or all generated IMEIs already exist." });
    return;
  }

  const rows = await db.insert(imeiPoolTable).values(inserts).returning();
  res.status(201).json({ generated: rows.length, rows });
});

// GET /imei-pool/next-free — get one free IMEI from pool (optionally for a prefix)
router.get("/imei-pool/next-free", async (req, res): Promise<void> => {
  const prefix = req.query.prefix ? String(req.query.prefix) : undefined;
  const conditions = [
    eq(imeiPoolTable.isUsed, false),
    sql`${imeiPoolTable.imei15} NOT IN (SELECT imei FROM inventory_items WHERE imei IS NOT NULL)`,
  ];
  if (prefix) conditions.push(eq(imeiPoolTable.prefix13, prefix));

  const [row] = await db
    .select()
    .from(imeiPoolTable)
    .where(and(...conditions))
    .orderBy(imeiPoolTable.serialNumber)
    .limit(1);

  if (!row) {
    res.status(404).json({ error: "No free IMEIs in pool" });
    return;
  }
  res.json(row);
});

// POST /imei-pool/:id/assign — assign a pool IMEI to an inventory item (IMEI replacement)
router.post("/imei-pool/:id/assign", async (req, res): Promise<void> => {
  const poolId = parseInt(String(req.params.id), 10);
  if (isNaN(poolId) || poolId <= 0) { res.status(400).json({ error: "Invalid pool entry id" }); return; }
  const inventoryItemId = parseInt(String(req.body.inventoryItemId), 10);
  if (isNaN(inventoryItemId) || inventoryItemId <= 0) { res.status(400).json({ error: "Invalid inventoryItemId" }); return; }

  // Get the pool entry
  const [poolEntry] = await db.select().from(imeiPoolTable).where(eq(imeiPoolTable.id, poolId));
  if (!poolEntry) { res.status(404).json({ error: "Pool entry not found" }); return; }
  if (poolEntry.isUsed) { res.status(409).json({ error: "This IMEI is already used" }); return; }

  // Get the current inventory item
  const [current] = await db.select().from(inventoryItemsTable).where(eq(inventoryItemsTable.id, inventoryItemId));
  if (!current) { res.status(404).json({ error: "Inventory item not found" }); return; }

  // Determine status to restore
  const restoreStatus = current.status === "pta_blocked" ? "available" : current.status;

  // Assign the IMEI
  let inv;
  try {
    [inv] = await db
      .update(inventoryItemsTable)
      .set({ imei: poolEntry.imei15, ptaStatus: "approved", status: restoreStatus })
      .where(eq(inventoryItemsTable.id, inventoryItemId))
      .returning();
  } catch (e: unknown) {
    const msg = (e as { message?: string })?.message ?? "";
    if (msg.includes("unique") || msg.includes("duplicate")) {
      await db.update(imeiPoolTable).set({ isUsed: true, usedAt: new Date() }).where(eq(imeiPoolTable.id, poolId));
      res.status(409).json({ error: "This IMEI already exists in inventory — it has been marked as used. Please try again to get the next free IMEI." });
      return;
    }
    throw e;
  }
  if (!inv) { res.status(404).json({ error: "Inventory item not found" }); return; }

  // Log IMEI change to history
  const assignReason =
    typeof req.body.reason === "string" && req.body.reason.trim()
      ? req.body.reason.trim()
      : "Auto-assigned from IMEI pool (PTA Blocked)";
  await db.insert(imeiHistoryTable).values({
    inventoryItemId: inventoryItemId,
    oldImei: current.imei,
    newImei: poolEntry.imei15,
    previousStatus: current.status === "pta_blocked" ? current.status : null,
    restoredStatus: restoreStatus,
    reason: assignReason,
    source: "pool",
  });

  // Mark pool entry as used
  await db
    .update(imeiPoolTable)
    .set({ isUsed: true, assignedInventoryItemId: inventoryItemId, usedAt: new Date() })
    .where(eq(imeiPoolTable.id, poolId));

  res.json({ success: true, newImei: poolEntry.imei15, inventoryItem: inv });
});

// DELETE /imei-pool/:id — delete an unused pool entry
router.delete("/imei-pool/:id", async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id) || id <= 0) { res.status(400).json({ error: "Invalid id" }); return; }
  const [row] = await db.select().from(imeiPoolTable).where(eq(imeiPoolTable.id, id));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  if (row.isUsed) { res.status(409).json({ error: "Cannot delete a used IMEI" }); return; }
  await db.delete(imeiPoolTable).where(eq(imeiPoolTable.id, id));
  res.sendStatus(204);
});

export default router;
