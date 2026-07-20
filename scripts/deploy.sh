#!/bin/bash
set -e
LOGFILE="/var/log/geem-deploy.log"
exec > >(tee -a "$LOGFILE") 2>&1
echo ""
echo "=========================================="
echo " Geem Deploy — $(date '+%Y-%m-%d %H:%M:%S')"
echo "=========================================="

cd /var/www/geempk/Inventory-Commerce-Hub

echo "[1/7] Pulling latest code..."
git pull origin main

echo "[2/7] Building API server..."
pnpm --filter @workspace/api-server run build 2>&1 | tail -4

echo "[3/7] Restarting API service..."
systemctl restart geem-api
sleep 2
systemctl is-active geem-api && echo "  API: active" || echo "  API: FAILED"

echo "[4/7] Building Shop (APP_MODE=shop)..."
APP_MODE=shop pnpm --filter @workspace/geem run build 2>&1 | tail -4

echo "[5/7] Deploying Shop → /var/www/geem/shop/public/"
cp -r artifacts/geem/dist/public/. /var/www/geem/shop/public/

echo "[6/7] Building ERP (APP_MODE=admin)..."
APP_MODE=admin pnpm --filter @workspace/geem run build 2>&1 | tail -4

echo "[7/7] Deploying ERP → /var/www/geem/erp/public/"
cp -r artifacts/geem/dist/public/. /var/www/geem/erp/public/

# Restore G Logo icons (build overwrites them with the placeholder)
set -a; source /var/www/geem/.env; set +a
GLOGO_PATH=$(PGPASSWORD="${DATABASE_URL##*:}" psql "${DATABASE_URL}" -t -c \
  "SELECT g_logo FROM company_settings LIMIT 1;" 2>/dev/null | xargs || true)
# Also try direct psql with known creds
if [ -z "$GLOGO_PATH" ]; then
  GLOGO_PATH=$(PGPASSWORD=1eaa756b61e11a6a9831061755e2c251922e0f21 \
    psql -h 127.0.0.1 -U geem -d geemdb -t -c \
    "SELECT g_logo FROM company_settings LIMIT 1;" | xargs)
fi

if [[ "$GLOGO_PATH" == /api/storage/objects/uploads/* ]]; then
  UUID="${GLOGO_PATH##*/}"
  SRC="/var/www/geem/uploads/uploads/$UUID"
  if [[ -f "$SRC" ]]; then
    for ICON in icon-192.png icon-512.png icon-512-maskable.png apple-touch-icon.png; do
      cp "$SRC" "/var/www/geem/shop/public/$ICON"
      cp "$SRC" "/var/www/geem/erp/public/$ICON"
    done
    echo "  G Logo icons updated from $UUID"
  else
    echo "  G Logo file not found at $SRC — skipping icon update"
  fi
else
  echo "  No G Logo set in DB — keeping existing icon files"
fi

echo "Reloading nginx..."
nginx -t && systemctl reload nginx

# Self-update webhook listener if it changed in the repo
WEBHOOK_SRC="scripts/webhook.js"
WEBHOOK_DEST="/var/www/geempk/webhook.js"
if ! cmp -s "$WEBHOOK_SRC" "$WEBHOOK_DEST"; then
  cp "$WEBHOOK_SRC" "$WEBHOOK_DEST"
  systemctl restart geem-webhook
  echo "  Webhook listener updated and restarted."
fi

# Self-update deploy script
DEPLOY_SRC="scripts/deploy.sh"
DEPLOY_DEST="/var/www/geempk/deploy.sh"
if ! cmp -s "$DEPLOY_SRC" "$DEPLOY_DEST"; then
  cp "$DEPLOY_SRC" "$DEPLOY_DEST"
  chmod +x "$DEPLOY_DEST"
  echo "  Deploy script updated."
fi

echo ""
echo "=========================================="
echo " Deploy complete — $(date '+%Y-%m-%d %H:%M:%S')"
echo "=========================================="
