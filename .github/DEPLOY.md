# Auto-Deploy Pipeline

Every push to `main` automatically deploys to the VPS via a GitHub webhook.

## How it works
1. Agent pushes code → GitHub receives push on `main`
2. GitHub calls `https://erp.geem.pk/webhook/deploy` (HMAC-verified)
3. VPS runs `/var/www/geempk/deploy.sh`:
   - `git pull origin main`
   - Build API server → restart `geem-api` systemd service
   - Build Shop (`APP_MODE=shop`) → deploy to `/var/www/geem/shop/public/`
   - Build ERP  (`APP_MODE=admin`) → deploy to `/var/www/geem/erp/public/`
   - Restore G Logo icons from DB
   - Reload nginx

## Deploy log
```bash
tail -f /var/log/geem-deploy.log
```
