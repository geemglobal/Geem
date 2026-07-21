import { Router, type Request, type Response, type IRouter } from "express";
import AdmZip from "adm-zip";
import multer from "multer";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import { pool } from "@workspace/db";
import { getUserIdFromToken } from "../lib/auth";

const execAsync = promisify(exec);
const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 150 * 1024 * 1024 } });

const WORKSPACE_ROOT = path.resolve("/home/runner/workspace");

// Tables that should never be included in a backup/restore (internal Replit / session state).
const SKIP_TABLES = new Set(["drizzle_migrations"]);

/** Return all public base tables in the connected database. */
async function getAllTables(): Promise<string[]> {
  const result = await pool.query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
     ORDER BY table_name`
  );
  return result.rows.map(r => r.table_name).filter(t => !SKIP_TABLES.has(t));
}

async function getAuthUserId(req: Request): Promise<number | null> {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return null;
  return getUserIdFromToken(auth.slice(7));
}

// GET /system/info — list of all tables and server info
router.get("/system/info", async (req: Request, res: Response): Promise<void> => {
  const userId = await getAuthUserId(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const tables = await getAllTables();
  const rowCounts: Record<string, number> = {};
  for (const t of tables) {
    try {
      const r = await pool.query<{ count: string }>(`SELECT COUNT(*) as count FROM "${t}"`);
      rowCounts[t] = parseInt(r.rows[0].count, 10);
    } catch { rowCounts[t] = -1; }
  }

  res.json({
    tables,
    rowCounts,
    workspace: WORKSPACE_ROOT,
    nodeVersion: process.version,
    uptime: Math.floor(process.uptime()),
    memoryMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
  });
});

// GET /system/backup — download full database backup as ZIP (all tables, dynamic)
router.get("/system/backup", async (req: Request, res: Response): Promise<void> => {
  const userId = await getAuthUserId(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const zip = new AdmZip();
  const tableCounts: Record<string, number> = {};
  const tables = await getAllTables();

  for (const table of tables) {
    try {
      const result = await pool.query(`SELECT * FROM "${table}"`);
      zip.addFile(`data/${table}.json`, Buffer.from(JSON.stringify(result.rows, null, 2), "utf-8"));
      tableCounts[table] = result.rowCount ?? 0;
    } catch {
      // skip views or tables we can't read
    }
  }

  const manifest = {
    version: "2.0",
    app: "Geem CRM",
    createdAt: new Date().toISOString(),
    tables: tableCounts,
  };
  zip.addFile("manifest.json", Buffer.from(JSON.stringify(manifest, null, 2), "utf-8"));

  const date = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Karachi" });
  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="geem-backup-${date}.zip"`);
  res.send(zip.toBuffer());
});

// POST /system/restore — restore database from a backup ZIP
/** Reject identifier strings that are not safe bare PostgreSQL identifiers. */
function assertSafeIdentifier(name: string, kind: string): void {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
    throw new Error(`Unsafe ${kind} identifier rejected: ${JSON.stringify(name)}`);
  }
}

/**
 * Topologically sort tables so parent tables (referenced by FKs) come first.
 * Uses Kahn's algorithm on the FK dependency graph from information_schema.
 * Cyclic tables (shouldn't happen in clean schemas) are appended at the end.
 */
async function topologicalTableOrder(tables: string[]): Promise<string[]> {
  const tableSet = new Set(tables);
  const { rows: fkRows } = await pool.query<{ child: string; parent: string }>(
    `SELECT tc.table_name AS child, ccu.table_name AS parent
     FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu
       ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
     JOIN information_schema.constraint_column_usage ccu
       ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
     WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'`
  );

  const inDegree = new Map<string, number>(tables.map(t => [t, 0]));
  const adj = new Map<string, string[]>(tables.map(t => [t, []]));

  for (const { child, parent } of fkRows) {
    if (!tableSet.has(child) || !tableSet.has(parent) || child === parent) continue;
    inDegree.set(child, (inDegree.get(child) ?? 0) + 1);
    adj.get(parent)!.push(child);
  }

  const queue = tables.filter(t => (inDegree.get(t) ?? 0) === 0);
  const sorted: string[] = [];
  while (queue.length > 0) {
    const t = queue.shift()!;
    sorted.push(t);
    for (const child of adj.get(t) ?? []) {
      const deg = (inDegree.get(child) ?? 0) - 1;
      inDegree.set(child, deg);
      if (deg === 0) queue.push(child);
    }
  }
  // Append any cyclic stragglers
  const seen = new Set(sorted);
  for (const t of tables) { if (!seen.has(t)) sorted.push(t); }
  return sorted;
}

router.post("/system/restore", upload.single("backup"), async (req: Request, res: Response): Promise<void> => {
  const userId = await getAuthUserId(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  if (!req.file) { res.status(400).json({ error: "No file uploaded" }); return; }

  const errors: string[] = [];

  try {
    const zip = new AdmZip(req.file.buffer);
    const manifestEntry = zip.getEntry("manifest.json");
    if (!manifestEntry) {
      res.status(400).json({ error: "Invalid backup: missing manifest.json" });
      return;
    }
    const manifest = JSON.parse(manifestEntry.getData().toString("utf-8")) as { version: string; app: string; createdAt: string };

    // Build allowlist from live schema.
    const allowedTables = new Set(await getAllTables());

    // Parse + validate all ZIP entries before touching the database.
    const tableData = new Map<string, Record<string, unknown>[]>();
    for (const entry of zip.getEntries()) {
      if (!entry.entryName.startsWith("data/") || !entry.entryName.endsWith(".json")) continue;
      const tableName = path.basename(entry.entryName, ".json");
      if (!allowedTables.has(tableName)) {
        errors.push(`${tableName}: not a known table — skipped`);
        continue;
      }
      try { assertSafeIdentifier(tableName, "table"); } catch (e) { errors.push(`${tableName}: ${String(e)}`); continue; }
      let rows: Record<string, unknown>[];
      try { rows = JSON.parse(entry.getData().toString("utf-8")) as Record<string, unknown>[]; }
      catch { errors.push(`${tableName}: failed to parse JSON`); continue; }
      if (rows.length > 0) {
        try { for (const col of Object.keys(rows[0])) assertSafeIdentifier(col, "column"); }
        catch (e) { errors.push(`${tableName}: ${String(e)}`); continue; }
      }
      tableData.set(tableName, rows);
    }

    const tablesToRestore = [...tableData.keys()];
    if (tablesToRestore.length === 0) {
      res.json({ ok: true, restoredTables: 0, restoredRows: 0, errors, manifest });
      return;
    }

    // Topological sort so INSERT respects FK constraints (parents inserted first).
    const topoOrder = await topologicalTableOrder(tablesToRestore);

    // Single atomic transaction:
    //   1. TRUNCATE all restore targets at once — CASCADE handles FK deps
    //      without requiring session_replication_role (no superuser needed).
    //   2. INSERT rows in topological order (parents before children).
    //   3. ROLLBACK on any failure so the database is never left half-wiped.
    const client = await pool.connect();
    let restoredTables = 0, restoredRows = 0;
    const restoredTableNames: string[] = [];
    try {
      await client.query("BEGIN");

      // Delete in REVERSE topological order (children first, parents last)
      // so FK constraints are never violated during deletion.
      // Using DELETE (not TRUNCATE CASCADE) so ONLY the targeted tables are
      // cleared — TRUNCATE CASCADE would propagate to FK-related tables that
      // are NOT part of this backup and erase data that can't be restored.
      for (const tableName of [...topoOrder].reverse()) {
        await client.query(`DELETE FROM "${tableName}"`);
      }

      // Insert in FORWARD topological order (parents first, children last).
      for (const tableName of topoOrder) {
        const rows = tableData.get(tableName) ?? [];
        if (rows.length === 0) { restoredTables++; restoredTableNames.push(tableName); continue; }
        const cols = Object.keys(rows[0]);
        const colList = cols.map(c => `"${c}"`).join(", ");
        for (const row of rows) {
          const vals = cols.map((_, i) => `$${i + 1}`).join(", ");
          await client.query(`INSERT INTO "${tableName}" (${colList}) VALUES (${vals})`, cols.map(c => row[c] ?? null));
        }
        restoredTables++;
        restoredRows += rows.length;
        restoredTableNames.push(tableName);
      }
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      client.release();
      res.status(500).json({ error: `Restore failed and was fully rolled back: ${String(err)}` });
      return;
    }
    client.release();

    // Reset sequences so future inserts don't collide with restored IDs.
    for (const tableName of restoredTableNames) {
      try {
        const seqResult = await pool.query<{ column_name: string }>(
          `SELECT column_name FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = $1
             AND column_default LIKE 'nextval(%'`,
          [tableName]
        );
        for (const { column_name } of seqResult.rows) {
          await pool.query(
            `SELECT setval(pg_get_serial_sequence('"${tableName}"', '${column_name}'),
               COALESCE((SELECT MAX("${column_name}") FROM "${tableName}"), 0) + 1, false)`
          );
        }
      } catch { /* no serial columns on this table */ }
    }

    res.json({ ok: true, restoredTables, restoredRows, errors, manifest });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// POST /system/update — apply a software update ZIP
router.post("/system/update", upload.single("update"), async (req: Request, res: Response): Promise<void> => {
  const userId = await getAuthUserId(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  if (!req.file) { res.status(400).json({ error: "No file uploaded" }); return; }

  try {
    const zip = new AdmZip(req.file.buffer);
    const manifestEntry = zip.getEntry("update-manifest.json");
    if (!manifestEntry) {
      res.status(400).json({ error: "Invalid update package: missing update-manifest.json" });
      return;
    }
    const manifest = JSON.parse(manifestEntry.getData().toString("utf-8")) as {
      version: string; description: string; requiresBuild?: boolean; requiresRestart?: boolean; requiresMigration?: boolean;
    };

    // Extract only code files — skip data/ entries so existing data is NEVER touched
    const extracted: string[] = [];
    const skipped: string[] = [];
    for (const entry of zip.getEntries()) {
      if (entry.entryName === "update-manifest.json" || entry.isDirectory) continue;
      // Safety: never extract anything that looks like a data dump
      if (entry.entryName.startsWith("data/") || entry.entryName.startsWith("backup/")) {
        skipped.push(entry.entryName);
        continue;
      }
      zip.extractEntryTo(entry.entryName, WORKSPACE_ROOT, true, true);
      extracted.push(entry.entryName);
    }

    // Run DB migration ONLY if the manifest requests it — drizzle push only ADDS
    // new columns/tables, it never drops or truncates existing data.
    let migrationOutput = "";
    if (manifest.requiresMigration) {
      try {
        const { stdout, stderr } = await execAsync(
          "pnpm --filter @workspace/db run push",
          { cwd: WORKSPACE_ROOT, timeout: 60_000 }
        );
        migrationOutput = (stdout + stderr).trim();
      } catch (migErr) {
        res.status(500).json({ error: `Migration failed: ${String(migErr)}`, extracted, manifest });
        return;
      }
    }

    let buildOutput = "";
    if (manifest.requiresBuild !== false) {
      try {
        const { stdout, stderr } = await execAsync(
          "pnpm --filter @workspace/api-server run build",
          { cwd: WORKSPACE_ROOT, timeout: 120_000 }
        );
        buildOutput = (stdout + stderr).trim();
      } catch (buildErr) {
        res.status(500).json({ error: `Build failed: ${String(buildErr)}`, extracted, manifest });
        return;
      }
    }

    res.json({ ok: true, manifest, extracted, skipped, migrationOutput, buildOutput });

    if (manifest.requiresRestart !== false) {
      setTimeout(() => process.exit(1), 800);
    }
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// POST /system/deduplicate — find and remove duplicate brands, categories, models, and products
router.post("/system/deduplicate", async (req: Request, res: Response): Promise<void> => {
  const userId = await getAuthUserId(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const report: Record<string, { found: number; removed: number }> = {};

  // 1. Duplicate brands (same name, case-insensitive) — keep lowest id, re-point references
  const dupBrands = await pool.query<{ ids: number[] }>(`
    SELECT array_agg(id ORDER BY id) AS ids
    FROM brands
    GROUP BY LOWER(TRIM(name))
    HAVING COUNT(*) > 1
  `);
  let brandsRemoved = 0;
  for (const row of dupBrands.rows) {
    const [keep, ...remove] = row.ids;
    for (const removeId of remove) {
      await pool.query(`UPDATE products SET brand_id = $1 WHERE brand_id = $2`, [keep, removeId]);
      await pool.query(`UPDATE device_models SET brand_id = $1 WHERE brand_id = $2`, [keep, removeId]);
      await pool.query(`DELETE FROM brands WHERE id = $1`, [removeId]);
      brandsRemoved++;
    }
  }
  report.brands = { found: dupBrands.rows.length, removed: brandsRemoved };

  // 2. Duplicate categories (same name, case-insensitive) — keep lowest id, re-point references
  const dupCats = await pool.query<{ ids: number[] }>(`
    SELECT array_agg(id ORDER BY id) AS ids
    FROM categories
    GROUP BY LOWER(TRIM(name))
    HAVING COUNT(*) > 1
  `);
  let catsRemoved = 0;
  for (const row of dupCats.rows) {
    const [keep, ...remove] = row.ids;
    for (const removeId of remove) {
      await pool.query(`UPDATE products SET category_id = $1 WHERE category_id = $2`, [keep, removeId]);
      await pool.query(`UPDATE categories SET parent_id = $1 WHERE parent_id = $2`, [keep, removeId]);
      await pool.query(`DELETE FROM categories WHERE id = $1`, [removeId]);
      catsRemoved++;
    }
  }
  report.categories = { found: dupCats.rows.length, removed: catsRemoved };

  // 3. Duplicate device models (same brand_id + name, case-insensitive) — keep lowest id
  const dupModels = await pool.query<{ ids: number[] }>(`
    SELECT array_agg(id ORDER BY id) AS ids
    FROM device_models
    GROUP BY brand_id, LOWER(TRIM(name))
    HAVING COUNT(*) > 1
  `);
  let modelsRemoved = 0;
  for (const row of dupModels.rows) {
    const [, ...remove] = row.ids;
    for (const removeId of remove) {
      await pool.query(`DELETE FROM device_models WHERE id = $1`, [removeId]);
      modelsRemoved++;
    }
  }
  report.models = { found: dupModels.rows.length, removed: modelsRemoved };

  // 4. Duplicate products (same title, case-insensitive) — keep lowest id
  const dupProducts = await pool.query<{ ids: number[] }>(`
    SELECT array_agg(id ORDER BY id) AS ids
    FROM products
    GROUP BY LOWER(TRIM(title))
    HAVING COUNT(*) > 1
  `);
  let productsRemoved = 0;
  for (const row of dupProducts.rows) {
    const [, ...remove] = row.ids;
    for (const removeId of remove) {
      await pool.query(`DELETE FROM products WHERE id = $1`, [removeId]);
      productsRemoved++;
    }
  }
  report.products = { found: dupProducts.rows.length, removed: productsRemoved };

  res.json({ ok: true, report });
});

// POST /system/restart — gracefully restart the API server
router.post("/system/restart", async (req: Request, res: Response): Promise<void> => {
  const userId = await getAuthUserId(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  res.json({ ok: true, message: "Server is restarting…" });
  setTimeout(() => process.exit(1), 500);
});

// POST /system/clear-inventory — delete all inventory items (dangerous!)
router.post("/system/clear-inventory", async (req: Request, res: Response): Promise<void> => {
  const userId = await getAuthUserId(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    await pool.query("DELETE FROM imei_pool WHERE assigned_inventory_item_id IS NOT NULL");
    await pool.query("DELETE FROM imei_pool");
    const result = await pool.query("DELETE FROM inventory_items RETURNING id");
    res.json({ ok: true, deleted: result.rowCount ?? 0 });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
