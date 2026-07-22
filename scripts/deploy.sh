#!/usr/bin/env bash
# deploy.sh — Full deploy on Contabo VPS
# Run as root from /var/www/geempk/Inventory-Commerce-Hub
# Usage: bash scripts/deploy.sh

set -e
REPO="/var/www/geempk/Inventory-Commerce-Hub"
ENV_FILE="/var/www/geem/.env"
SHOP_PUBLIC="/var/www/geem/shop/public"
ERP_PUBLIC="/var/www/geem/erp/public"

cd "$REPO"
echo ">>> [1/6] Git pull"
git pull origin main

echo ">>> [2/6] Install dependencies"
pnpm install --frozen-lockfile

echo ">>> [3/6] Build shared libs"
pnpm run typecheck:libs

echo ">>> [4/6] Build API server"
pnpm --filter @workspace/api-server run build

echo ">>> [5/6] Build frontends"
# Shop PWA
APP_MODE=shop BASE_PATH=/ pnpm --filter @workspace/geem run build
rm -rf "$SHOP_PUBLIC" && cp -r artifacts/geem/dist/public "$SHOP_PUBLIC"
echo "  Shop → $SHOP_PUBLIC"

# Admin/ERP PWA
APP_MODE=admin BASE_PATH=/ pnpm --filter @workspace/geem run build
rm -rf "$ERP_PUBLIC" && cp -r artifacts/geem/dist/public "$ERP_PUBLIC"
echo "  Admin → $ERP_PUBLIC"

echo ">>> [6/6] Restart services"
systemctl restart geem-api.service
systemctl is-active geem-api.service && echo "  API: OK"

echo ">>> Deploy complete!"
curl -s http://127.0.0.1:8080/api/healthz && echo ""
