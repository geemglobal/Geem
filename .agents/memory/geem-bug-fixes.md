---
name: Geem bug fixes and key constraints
description: SQL injection rule, double-sell guard, Clerk v6 type workaround, image update workflow
---

## SQL injection rule
Never interpolate user input into raw SQL in the Express routes. Always use Drizzle ORM parameterized queries.

**Why:** Production DB is PostgreSQL on Contabo VPS. Drizzle's `.where(eq(...))` handles parameterization safely.

**How to apply:** Always use Drizzle ORM — never `db.execute(sql\`...\`)` with template interpolation of request params.

---

## Double-sell guard
The `stockQty` field is decremented atomically on order placement. Do not decrement in the frontend or multiple places.

**Why:** Race condition risk on popular items.

---

## Clerk v6 type workaround
Clerk v6 broke some TypeScript types. Use `as any` casts on `clerkClient()` return values when the type checker complains about `.users.getUser()`.

**Why:** Clerk v6 changed the client shape but the TS types lag behind.

---

## Image update workflow (product catalog)
- Product images live in `artifacts/geem/public/products/<category>/<product>/img_N.jpg`
- DB stores `featured_image` (string) and `gallery_images` (JSON array string)
- Images are served as static assets from the Vite build output — must be in `public/`
- Production DB is at `127.0.0.1:5432/geemdb` on the Contabo VPS — not reachable from Replit
- To update images: push changes to GitHub, then on VPS: `git pull && psql $DATABASE_URL -f scripts/update-images.sql && pnpm build`
- The `scripts/update-images.sql` file contains all UPDATE statements keyed by product slug
- The `scripts/src/update-product-images.ts` TypeScript version works when run ON the VPS (where DATABASE_URL points to localhost)

**Why:** Database is localhost-only on VPS. Scripts cannot reach it from Replit. SQL file is the portable delivery mechanism.

---

## Category filtering
Works correctly end-to-end. ShopCategory.tsx sends `?categoryId=<id>` to `/shop/products`. The API route at `artifacts/api-server/src/routes/products.ts` filters with `eq(productsTable.categoryId, categoryId)`. No bugs here.
