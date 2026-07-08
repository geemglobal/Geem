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
