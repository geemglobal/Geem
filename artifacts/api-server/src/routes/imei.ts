import { Router, type IRouter } from "express";
import { eq, and, count, sql } from "drizzle-orm";
import { db, imeiPoolTable, inventoryItemsTable, imeiHistoryTable } from "@workspace/db";

const router: IRouter = Router();

/** Luhn check digit for a 14-digit string */
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

/** Generate 15-digit IMEI: prefix12 (12) + 2-digit counter (00-99) + Luhn */
function makeImei(prefix12: string, counter2: number): string {
  const digits14 = prefix12 + String(counter2).padStart(2, "0");
  return digits14 + luhnDigit(digits14);
}

// GET /imei-pool — list generated IMEIs
router.get("/imei-pool", async (req, res): Promise<void> => {
  const prefix = req.query.prefix ? String(req.query.prefix).slice(0, 12) : undefined;
  const used = req.query.used;
  const limit  = Math.min(500, Math.max(1, parseInt(String(req.query.limit ?? "100"), 10) || 100));
  const offset = Math.max(0, parseInt(String(req.query.offset ?? "0"), 10) || 0);

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

// GET /imei-pool/prefix-summary — unique machine prefixes with stats (for Quick Generate)
router.get("/imei-pool/prefix-summary", async (req, res): Promise<void> => {
  const rows = await db
    .select({
      prefix12:  imeiPoolTable.prefix12,
      total:     sql<number>`count(*)`,
      used:      sql<number>`sum(case when ${imeiPoolTable.isUsed} then 1 else 0 end)`,
      free:      sql<number>`sum(case when not ${imeiPoolTable.isUsed} then 1 else 0 end)`,
      maxSerial: sql<number>`max(${imeiPoolTable.serialNumber})`,
    })
    .from(imeiPoolTable)
    .groupBy(imeiPoolTable.prefix12)
    .orderBy(imeiPoolTable.prefix12);
  res.json(rows);
});

// POST /imei-pool/generate — generate batch of IMEIs
//   Body option A (dialog):       { prefix13: "8665610100050", quantity: 10 }
//     → 13-digit prefix, 1-digit serial (0-9), stored as 2-digit = digit13*10 + serial
//   Body option B (quick button): { prefix12: "866561010005",  quantity: 10 }
//     → 12-digit prefix, 2-digit counter continues from last maxSerial
router.post("/imei-pool/generate", async (req, res): Promise<void> => {
  const { prefix12: p12raw, prefix13: p13raw, quantity } = req.body;

  let p12: string;
  let serialMin: number;
  let serialMax: number;

  if (p13raw) {
    // ── 13-digit prefix mode (from dialog) ──────────────────────────────────
    if (typeof p13raw !== "string" || p13raw.length !== 13 || !/^\d{13}$/.test(p13raw)) {
      res.status(400).json({ error: "prefix13 must be exactly 13 digits" });
      return;
    }
    p12 = p13raw.slice(0, 12);
    const digit13 = parseInt(p13raw[12], 10); // 13th digit: 0-9
    serialMin = digit13 * 10;                 // e.g. digit13=0 → range 0-9
    serialMax = serialMin + 9;
  } else if (p12raw) {
    // ── 12-digit prefix mode (from Quick Generate button) ───────────────────
    if (typeof p12raw !== "string" || p12raw.length !== 12 || !/^\d{12}$/.test(p12raw)) {
      res.status(400).json({ error: "prefix12 must be exactly 12 digits" });
      return;
    }
    p12 = p12raw;
    serialMin = 0;
    serialMax = 99;
  } else {
    res.status(400).json({ error: "Either prefix13 (13 digits) or prefix12 (12 digits) is required" });
    return;
  }

  const qty = parseInt(String(quantity ?? 10), 10);
  const maxQty = serialMax - serialMin + 1; // 10 for prefix13 mode, 100 for prefix12 mode
  if (qty < 1 || qty > maxQty) {
    res.status(400).json({ error: `quantity must be 1–${maxQty}` });
    return;
  }

  // Find highest existing 2-digit counter in the applicable range
  const existing = await db
    .select({ maxSerial: sql<number>`max(${imeiPoolTable.serialNumber})` })
    .from(imeiPoolTable)
    .where(
      and(
        eq(imeiPoolTable.prefix12, p12),
        sql`${imeiPoolTable.serialNumber} >= ${serialMin}`,
        sql`${imeiPoolTable.serialNumber} <= ${serialMax}`
      )
    );
  const lastSerial = existing[0]?.maxSerial;
  const startSerial = lastSerial != null ? lastSerial + 1 : serialMin;

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
    .where(eq(imeiPoolTable.prefix12, p12));
  const poolSet = new Set(poolExisting.map(r => r.imei15));

  const inserts = [];
  for (let i = 0; i < qty; i++) {
    const counter2 = startSerial + i;
    if (counter2 > serialMax) break;
    const imei15 = makeImei(p12, counter2);
    if (poolSet.has(imei15) || inventorySet.has(imei15)) continue;
    inserts.push({ prefix12: p12, imei15, serialNumber: counter2 });
  }

  if (!inserts.length) {
    const rangeLabel = p13raw
      ? `All serials (0–9) already used for prefix ${p13raw}`
      : `All counters (00–99) already used for this machine`;
    res.status(400).json({ error: `${rangeLabel}, or all generated IMEIs already exist.` });
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
  if (prefix) conditions.push(eq(imeiPoolTable.prefix12, prefix));

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

  const [poolEntry] = await db.select().from(imeiPoolTable).where(eq(imeiPoolTable.id, poolId));
  if (!poolEntry) { res.status(404).json({ error: "Pool entry not found" }); return; }
  if (poolEntry.isUsed) { res.status(409).json({ error: "This IMEI is already used" }); return; }

  const [current] = await db.select().from(inventoryItemsTable).where(eq(inventoryItemsTable.id, inventoryItemId));
  if (!current) { res.status(404).json({ error: "Inventory item not found" }); return; }

  const restoreStatus = current.status === "pta_blocked" ? "available" : current.status;

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

  const assignReason =
    typeof req.body.reason === "string" && req.body.reason.trim()
      ? req.body.reason.trim()
      : "Auto-assigned from IMEI pool (PTA Blocked)";
  await db.insert(imeiHistoryTable).values({
    inventoryItemId,
    oldImei: current.imei,
    newImei: poolEntry.imei15,
    previousStatus: current.status === "pta_blocked" ? current.status : null,
    restoredStatus: restoreStatus,
    reason: assignReason,
    source: "pool",
  });

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
