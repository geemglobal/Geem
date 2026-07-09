---
name: Geem bug fixes
description: Key constraints and decisions made during initial bug-fix session for Geem CRM & Shop.
---

## Rules

**Why:** These bugs were caught during code review and should not be re-introduced.

**Never use `sql.raw()` with request-body values.**  
Use `inArray()` or parameterised `$1` binding instead. The invoice pre-check (`POST /invoices`) already had this fixed — keep it parameterised.

**How to apply:** Any time a route receives an array of IDs from the request body and queries them, use `inArray(table.col, ids)` from drizzle-orm.

---

**Double-sell guard is two-layer.**  
1. `POST /invoices`: pre-check via `inArray` that all `inventoryItemId`s are currently `in_stock`; returns 409 if any are already sold.  
2. `PATCH /web-orders/:id` (→ shipped): only marks items sold if `status = in_stock` (atomic conditional update), and only passes the IDs that *actually* flipped to sold into the invoice. IDs that failed the check are silently skipped but do NOT appear in the invoice.

**Why:** Race-condition on concurrent invoice creation / order shipping could double-sell the same IMEI unit.

---

**`/inventory/sync-shop` uses inventory groups, not `productsTable.modelId`.**  
The `productsTable` has no `modelId` column (only `brandId`). The sync route groups `inventoryItemsTable` by `(brandId, modelId)` and calls `upsertProductFromInventory` per group.

**Why:** TypeScript error — `productsTable.modelId` does not exist.

---

**Clerk React v6 `useSignIn()` uses `as any` cast in `ShopSignIn.tsx`.**  
Clerk v6 changed `useSignIn()` return type to `SignInSignalValue` which lacks `isLoaded`. Replaced `{ signIn, isLoaded: clerkLoaded }` with `{ signIn } = useSignIn() as any` and changed button `disabled` check from `!clerkLoaded` to `!signIn`.

**Why:** Clerk v6 preact-signals-based API type mismatch; `authenticateWithRedirect` still works at runtime.

---

**OpenAI model name:** `gpt-4o-mini` (not `gpt-5-mini` which does not exist).  
Applied in both `inventory.ts` and `product_ai.ts`.

---

**Courier insert has no `code` field.**  
`couriersTable` schema has: `name`, `apiProvider`, `apiKey`, `apiPassword`, `trackingUrl`, `ledgerBalance`, `active`. There is no `code` column.

---

**`return res.status(N).json(...)` pattern is a TypeScript error in Express 5.**  
Routes typed as `Promise<void>` cannot return a `Response`. Always split: `res.status(N).json(...); return;`

---

**`/system/backup` backs up ALL public tables dynamically (not a hardcoded list).**  
`getAllTables()` queries `information_schema.tables` (schema=public, type=BASE TABLE) and skips `drizzle_migrations`. Backup manifest version bumped to `"2.0"`.

**Why:** The old `BACKUP_TABLES` list used stale table names (pre_orders, vault_items, courier_accounts…) that don't exist in the current schema — backups were mostly empty.

---

**`/system/restore` safe-restore rules (all must hold):**
1. Check out a single `pool.connect()` client for the whole restore transaction.
2. **Do NOT use `session_replication_role`** — Replit's managed PostgreSQL denies it (not a superuser).
3. **Do NOT use `TRUNCATE ... CASCADE`** — it propagates to FK-related tables NOT in the backup and deletes data that can't be recovered.
4. Correct approach: `topologicalTableOrder()` (Kahn's algo on FK graph from `information_schema`), then DELETE in *reverse* topo order (children first), then INSERT in *forward* topo order (parents first). Wrap the entire DELETE + INSERT loop in a single `BEGIN/COMMIT`; `ROLLBACK` on any error.
5. Table names allowlisted against `getAllTables()`, column names validated with `assertSafeIdentifier()` before building any SQL.
6. After `COMMIT`, reset sequences: `information_schema.columns WHERE column_default LIKE 'nextval(%'` → `setval(..., max+1, false)`.

**Why:** Managed PG = no superuser. TRUNCATE CASCADE wiped tables outside the backup set. DELETE + topo order satisfies FK constraints without any privilege escalation.

---

**SIM routes (`sim.ts`) require `SIM_APP_KEY` and `SIM_APP_SECRET`.**  
Both default to `""` at module load to avoid crashing the server on startup. `requireSimKeys()` is called inside `callApi()` so every SIM route fails fast with a clear config error, not a generic upstream 502.

**Why:** Module-level throw crashed the entire API server when SIM credentials were absent.
