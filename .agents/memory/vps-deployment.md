---
name: VPS Deployment
description: Contabo VPS deployment setup for Geem CRM & Shop — how services run, env files, and deploy workflow.
---

## VPS: Contabo, root@164.68.120.130

## Project location
`/var/www/geempk/Inventory-Commerce-Hub` — the monorepo

## Master env file
`/var/www/geem/.env` — used by systemd services (has DATABASE_URL, Clerk keys, etc.)
The monorepo also has `.env` but systemd services use `/var/www/geem/.env`.

## Services (systemd, not PM2)
- `geem-api.service` — API server, port 8080, WorkingDirectory: `.../artifacts/api-server`, runs `node --enable-source-maps ./dist/index.mjs`
- `geem-webhook.service` — GitHub deploy webhook, port 9001, runs `node scripts/webhook.cjs`

**Why:** PM2 was tried but systemd was already in place and working. Kept systemd.

## Nginx
- `erp.geem.pk` → ERP frontend: `/var/www/geem/erp/public`, API proxy → 127.0.0.1:8080
- `geem.pk` → Shop frontend: `/var/www/geem/shop/public`, API proxy → 127.0.0.1:8080

## Frontend builds
- Shop: `APP_MODE=shop BASE_PATH=/ pnpm --filter @workspace/geem run build` → copy `artifacts/geem/dist/public` → `/var/www/geem/shop/public`
- Admin/ERP: `APP_MODE=admin BASE_PATH=/ pnpm --filter @workspace/geem run build` → copy → `/var/www/geem/erp/public`

## Full deploy command (on VPS)
```bash
bash /var/www/geempk/Inventory-Commerce-Hub/scripts/deploy.sh
```

## Webhook
`scripts/webhook.cjs` (CommonJS — must be .cjs because scripts/ has "type": "module")
Listens on port 9001, triggered by GitHub push to main.
