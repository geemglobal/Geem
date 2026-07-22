---
name: PWA Icon Pipeline
description: How Geem PWA icons are generated, deployed, and updated — including the root cause of the red-blob problem and the permanent fix.
---

## Icon File Locations
- Source: `artifacts/geem/public/geem-icon-source.png` (transparent G logo, ~916×924 RGBA)
- Pre-generated icons in `artifacts/geem/public/`: icon-192.png, icon-512.png, icon-512-maskable.png, apple-touch-icon.png
- Nginx serve dirs: `/var/www/geem/shop/public/` and `/var/www/geem/erp/public/`
- Vite copies `public/` → `dist/public/` automatically at build time

## Root Cause of Red Blob
`artifacts/api-server/src/routes/misc.ts` PATCH `/settings/company` handler:
when `gLogo` changes, it previously did raw `copyFileSync` of the uploaded file
(transparent RGBA PNG) to all icon filenames. Transparent G on dark Android
launcher = red fills entire adaptive icon shape = solid red blob.

## Permanent Fix (applied)
`misc.ts` now uses `sharp` (installed in api-server) to:
1. Resize logo to spec.logo px with white background (flatten alpha)
2. Composite centered on white `spec.canvas × spec.canvas` canvas
3. Output 8-bit RGB PNG to both SHOP_PUBLIC_DIR and ERP_PUBLIC_DIR

Specs: icon-192 (canvas=192, logo=168), icon-512 (512,450), maskable (512,410), apple-touch (180,158)

## Icon Manifest
Manifest points to static `/icon-192.png?v=4` etc. NOT the API redirect.
The API redirect (`/api/shop/app-icon`) is fine for favicon/splash but not
manifest — it serves the raw transparent source which still looks wrong.

## Android Caching Rule
Android caches PWA icons at install time. Icon only updates on uninstall + reinstall.
No code change can update an already-installed icon — user must reinstall the PWA.

**Why:** OS saves the icon bytes locally at install time; never re-reads manifest after.

**How to apply:** Always tell user to reinstall after any icon change.
