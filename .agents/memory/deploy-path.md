---
name: VPS deploy path for ERP
description: The nginx root for erp.geem.pk and how deploy.sh must be configured
---

## Rule
nginx serves `erp.geem.pk` from `/var/www/geem/erp/` (NOT `/var/www/geem/erp/public/`).

**Why:** An earlier session set `ERP_PUBLIC=/var/www/geem/erp/public` in deploy.sh but nginx was configured to `/var/www/geem/erp`. Every deploy was putting files in the wrong place. Fixed by setting `ERP_PUBLIC=/var/www/geem/erp`.

## Shop path
nginx serves `geem.pk` (shop) from `/var/www/geem/shop/public` — that one IS correct and should stay as-is.

## Deploy command
`bash /var/www/geempk/Inventory-Commerce-Hub/scripts/deploy.sh` on VPS root@164.68.120.130
