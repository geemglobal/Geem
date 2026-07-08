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

/** Generate 15-digit IMEI from 12-digit prefix + 2-digit serial (14 digits total → luhn) */
function makeImei(prefix12: string, serial: number): string {
  const serialStr = String(serial).padStart(2, "0");
  const digits14 = prefix12 + serialStr;
  return digits14 + luhnDigit(digits14);
}

// GET /imei-pool — list generated IMEIs
router.get("/imei-pool", async (req, res): Promise<void> => {
  const prefix = req.query.prefix ? String(req.query.prefix) : undefined;
  const used = req.query.used;
  const limit = parseInt(String(req.query.limit ?? "100"), 10);
  const offset = parseInt(String(req.query.offset ?? "0"), 10);

  const conditions = [];
  if (prefix) conditions.push(eq(imeiPoolTable.prefix12, prefix));
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

// POST /imei-pool/generate — generate batch of IMEIs
router.post("/imei-pool/generate", async (req, res): Promise<void> => {
  const { prefix12, quantity } = req.body;
  if (!prefix12 || typeof prefix12 !== "string" || prefix12.length !== 12 || !/^\d{12}$/.test(prefix12)) {
    res.status(400).json({ error: "prefix12 must be exactly 12 digits" });
    return;
  }
  const qty = parseInt(String(quantity ?? 1), 10);
  if (qty < 1 || qty > 99) {
    res.status(400).json({ error: "quantity must be 1-99 (serial 01-99)" });
    return;
  }

  // Find highest existing serial for this prefix
  const existing = await db
    .select({ maxSerial: sql<number>`max(${imeiPoolTable.serialNumber})` })
    .from(imeiPoolTable)
    .where(eq(imeiPoolTable.prefix12, prefix12));
  const startSerial = (existing[0]?.maxSerial ?? 0) + 1;

  const inserts = [];
  for (let i = 0; i < qty; i++) {
    const serial = startSerial + i;
    if (serial > 99) break; // cap at 99 per prefix
    inserts.push({ prefix12, imei15: makeImei(prefix12, serial), serialNumber: serial });
  }
  if (!inserts.length) {
    res.status(400).json({ error: "All serials 01-99 already used for this prefix" });
    return;
  }

  const rows = await db.insert(imeiPoolTable).values(inserts).returning();
  res.status(201).json({ generated: rows.length, rows });
});

// GET /imei-pool/next-free — get one free IMEI from pool (optionally for a prefix)
// Skips any pool IMEI that already exists in inventory_items (handles data inconsistencies)
router.get("/imei-pool/next-free", async (req, res): Promise<void> => {
  const prefix = req.query.prefix ? String(req.query.prefix) : undefined;
  const conditions = [
    eq(imeiPoolTable.isUsed, false),
    sql`${imeiPoolTable.imei15} NOT IN (SELECT imei FROM inventory_items WHERE imei IS NOT NULL)`,
  ];
  if (prefix) conditions.push(eq(imeiPoolTable.prefix12, prefix));

  const [row] = await db
    .select()
    .from(imeiPoolTable)
    .where(and(...conditions))
    .orderBy(imeiPoolTable.createdAt)
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
  const { inventoryItemId } = req.body;
  if (!inventoryItemId) {
    res.status(400).json({ error: "inventoryItemId required" });
    return;
  }

  const [poolEntry] = await db.select().from(imeiPoolTable).where(eq(imeiPoolTable.id, poolId));
  if (!poolEntry) { res.status(404).json({ error: "Pool entry not found" }); return; }
  if (poolEntry.isUsed) { res.status(409).json({ error: "IMEI already used" }); return; }

  // Fetch current inventory item to capture old IMEI and previousStatus
  const [current] = await db.select().from(inventoryItemsTable).where(eq(inventoryItemsTable.id, inventoryItemId));
  if (!current) { res.status(404).json({ error: "Inventory item not found" }); return; }

  // Auto-restore previous status when IMEI is assigned to a pta_blocked item
  // Always set ptaStatus to blocked — new IMEI needs PTA clearance
  const restoreStatus = current.status === "pta_blocked" ? (current.previousStatus ?? "in_stock") : null;
  const itemUpdate: Record<string, unknown> = { imei: poolEntry.imei15, ptaStatus: "unpaid" };
  if (restoreStatus) {
    itemUpdate.status = restoreStatus;
    itemUpdate.previousStatus = null;
  }

  // Update inventory item IMEI (and optionally status)
  let inv;
  try {
    [inv] = await db
      .update(inventoryItemsTable)
      .set(itemUpdate)
      .where(eq(inventoryItemsTable.id, inventoryItemId))
      .returning();
  } catch (e: unknown) {
    const msg = (e as { message?: string })?.message ?? "";
    if (msg.includes("unique") || msg.includes("duplicate")) {
      // Mark pool entry as used anyway (it already exists in inventory)
      await db.update(imeiPoolTable).set({ isUsed: true, usedAt: new Date() }).where(eq(imeiPoolTable.id, poolId));
      res.status(409).json({ error: "This IMEI already exists in inventory — it has been marked as used. Please try again to get the next free IMEI." });
      return;
    }
    throw e;
  }
  if (!inv) { res.status(404).json({ error: "Inventory item not found" }); return; }

  // Log IMEI change to history
  await db.insert(imeiHistoryTable).values({
    inventoryItemId: inventoryItemId,
    oldImei: current.imei,
    newImei: poolEntry.imei15,
    previousStatus: current.status === "pta_blocked" ? current.status : null,
    restoredStatus: restoreStatus,
    reason: "Auto-assigned from IMEI pool",
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
  const [row] = await db.select().from(imeiPoolTable).where(eq(imeiPoolTable.id, id));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  if (row.isUsed) { res.status(409).json({ error: "Cannot delete a used IMEI" }); return; }
  await db.delete(imeiPoolTable).where(eq(imeiPoolTable.id, id));
  res.sendStatus(204);
});

export default router;
