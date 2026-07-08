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

const BACKUP_TABLES = [
  "users",
  "brands",
  "categories",
  "device_models",
  "customers",
  "products",
  "inventory_items",
  "imei_pool",
  "invoices",
  "invoice_items",
  "payments",
  "pos_drafts",
  "invoice_settings",
  "quotations",
  "quotation_items",
  "pre_orders",
  "pre_order_items",
  "web_orders",
  "procurement_orders",
  "procurement_items",
  "shipments",
  "service_tickets",
  "chat_messages",
  "vault_items",
  "ledger_entries",
  "visitor_logs",
  "payment_methods",
  "courier_accounts",
  "vendors",
  "app_settings",
];

async function getAuthUserId(req: Request): Promise<number | null> {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return null;
  return getUserIdFromToken(auth.slice(7));
}

// GET /system/info — list of backup tables and server info
router.get("/system/info", async (req: Request, res: Response): Promise<void> => {
  const userId = await getAuthUserId(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const result = await pool.query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name`
  );
  const tables = result.rows.map(r => r.table_name);

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

// GET /system/backup — download full database backup as ZIP
router.get("/system/backup", async (req: Request, res: Response): Promise<void> => {
  const userId = await getAuthUserId(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const zip = new AdmZip();
  const tableCounts: Record<string, number> = {};

  for (const table of BACKUP_TABLES) {
    try {
      const result = await pool.query(`SELECT * FROM "${table}"`);
      zip.addFile(`data/${table}.json`, Buffer.from(JSON.stringify(result.rows, null, 2), "utf-8"));
      tableCounts[table] = result.rowCount ?? 0;
    } catch {
      // skip tables that don't exist yet
    }
  }

  const manifest = {
    version: "1.0",
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
router.post("/system/restore", upload.single("backup"), async (req: Request, res: Response): Promise<void> => {
  const userId = await getAuthUserId(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  if (!req.file) { res.status(400).json({ error: "No file uploaded" }); return; }

  let restoredTables = 0;
  let restoredRows = 0;
  const errors: string[] = [];

  try {
    const zip = new AdmZip(req.file.buffer);
    const manifestEntry = zip.getEntry("manifest.json");
    if (!manifestEntry) {
      res.status(400).json({ error: "Invalid backup: missing manifest.json" });
      return;
    }
    const manifest = JSON.parse(manifestEntry.getData().toString("utf-8")) as { version: string; app: string; createdAt: string };

    const dataEntries = zip.getEntries().filter(e => e.entryName.startsWith("data/") && e.entryName.endsWith(".json"));

    // Disable FK checks
    await pool.query("SET session_replication_role = replica");

    for (const entry of dataEntries) {
      const tableName = path.basename(entry.entryName, ".json");
      let rows: Record<string, unknown>[];
      try {
        rows = JSON.parse(entry.getData().toString("utf-8")) as Record<string, unknown>[];
      } catch {
        errors.push(`${tableName}: failed to parse JSON`);
        continue;
      }

      try {
        await pool.query(`TRUNCATE TABLE "${tableName}" RESTART IDENTITY`);

        if (rows.length > 0) {
          const cols = Object.keys(rows[0]);
          const colList = cols.map(c => `"${c}"`).join(", ");
          for (const row of rows) {
            const vals = cols.map((_, i) => `$${i + 1}`).join(", ");
            await pool.query(
              `INSERT INTO "${tableName}" (${colList}) VALUES (${vals})`,
              cols.map(c => row[c] ?? null)
            );
          }
        }

        restoredTables++;
        restoredRows += rows.length;
      } catch (err) {
        errors.push(`${tableName}: ${String(err).slice(0, 120)}`);
      }
    }

    await pool.query("SET session_replication_role = DEFAULT");
    res.json({ ok: true, restoredTables, restoredRows, errors, manifest });
  } catch (err) {
    await pool.query("SET session_replication_role = DEFAULT").catch(() => {});
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
