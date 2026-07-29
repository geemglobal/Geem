---
name: Inventory performance architecture
description: How the inventory list endpoint was optimized from N+1 to batch queries
---

## The problem
`enrichItem()` fired 5 DB queries per item. With 50 items/page = 250 queries per page load.
`GET /inventory` also fired 7 separate COUNT queries for the summary bar.
Total: ~260 DB round-trips per page load.

## The fix
- Added `enrichItems(items[])` batch function: fires 5 parallel queries (inArray) for the whole page, regardless of size.
- Merged 7 COUNT queries into one SQL aggregation with `count(*) filter (where ...)` CASE.
- Run count + items + summary all in parallel via `Promise.all`.
- Result: 8 DB queries per page load (was ~260).

**Why:** `invoice_items.inventory_item_id` and `imei_history.inventory_item_id` had no indexes. Also added those indexes on VPS directly via `CREATE INDEX CONCURRENTLY`.

## Indexes added on VPS (geemdb)
- imei_history(inventory_item_id)
- invoice_items(inventory_item_id)
- inventory_items(pta_status)
- ledger_entries(customer_id)
- inventory_items(status, created_at DESC)

**How to apply:** These were applied directly on VPS with `CREATE INDEX CONCURRENTLY`. They are NOT in a Drizzle migration file — if the DB is ever recreated, re-run them manually.
