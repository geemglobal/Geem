/**
 * Resolves a product image URL so it always points to the correct origin.
 *
 * Product images are stored as root-relative paths like `/products/gps/gt06/img_1.jpg`.
 * On geem.pk nginx serves them correctly, but on erp.geem.pk (admin) the browser
 * tries to load from the wrong domain → broken images.
 *
 * Rules:
 *  - `/products/...`  → prefix with https://geem.pk  (nginx-served static assets)
 *  - `/api/storage/...` → keep relative  (proxied through the API server on same origin)
 *  - http/https absolute URLs → keep as-is
 *  - null/undefined/empty → return null
 */
export function resolveImgUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("/products/")) return `https://geem.pk${url}`;
  return url; // /api/storage/... or other relative paths stay as-is
}
