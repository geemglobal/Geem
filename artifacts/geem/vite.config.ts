import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import fs from "fs";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { VitePWA } from "vite-plugin-pwa";

// PORT is only needed for the dev/preview server, not for `vite build`
const rawPort = process.env.PORT;
const port = rawPort ? Number(rawPort) : 3000;

// BASE_PATH defaults to "/" when building for VPS (not required during build)
const basePath = process.env.BASE_PATH ?? "/";

// APP_MODE=shop → customer shop PWA   (default)
// APP_MODE=admin → staff ERP PWA
const appMode = process.env.APP_MODE === "admin" ? "admin" : "shop";

const pwaManifest =
  appMode === "admin"
    ? {
        name: "Geem ERP — Management System",
        short_name: "Geem ERP",
        description: "Geem — Staff Admin & POS System",
        theme_color: "#1e40af",
        background_color: "#f1f5f9",
        display: "standalone" as const,
        orientation: "any" as const,
        scope: "/",
        start_url: "/dashboard",
        categories: ["business", "productivity"],
        // Dynamic icon via API — always reflects the logo uploaded in Settings.
        // /api/shop/app-icon redirects (302) to the object-storage URL for the
        // current gLogo; browsers follow the redirect automatically.
        // The maskable variant keeps a static file because safe-zone padding
        // must be baked in at generate time.
        icons: [
          { src: "/api/shop/app-icon", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/api/shop/app-icon", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      }
    : {
        name: "Geem.pk — GPS Trackers Pakistan",
        short_name: "Geem Shop",
        description: "Pakistan's most trusted GPS tracker store — vehicle trackers, OBD2, personal trackers & SIM cards",
        theme_color: "#dc2626",
        background_color: "#0a0a0a",
        display: "standalone" as const,
        orientation: "any" as const,
        scope: "/",
        start_url: "/",
        categories: ["shopping", "lifestyle"],
        icons: [
          { src: "/api/shop/app-icon", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/api/shop/app-icon", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      };

const pwaWorkbox =
  appMode === "admin"
    ? {
        // 10 MB — allow larger JS chunks & assets to be precached for full offline ERP
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2,woff,ttf}"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          // ── All ERP API routes ─────────────────────────────────────────────
          // NetworkFirst: always try network; if unreachable within 4 s fall back
          // to the most recent cached copy so the app stays usable offline.
          {
            urlPattern: ({ url }: { url: URL }) =>
              url.pathname.startsWith("/api/inventory") ||
              url.pathname.startsWith("/api/customers") ||
              url.pathname.startsWith("/api/products") ||
              url.pathname.startsWith("/api/invoices") ||
              url.pathname.startsWith("/api/quotations") ||
              url.pathname.startsWith("/api/brands") ||
              url.pathname.startsWith("/api/categories") ||
              url.pathname.startsWith("/api/master") ||
              url.pathname.startsWith("/api/procurement") ||
              url.pathname.startsWith("/api/shop-orders") ||
              url.pathname.startsWith("/api/service-tickets") ||
              url.pathname.startsWith("/api/visitors") ||
              url.pathname.startsWith("/api/expenses") ||
              url.pathname.startsWith("/api/search") ||
              url.pathname.startsWith("/api/dashboard") ||
              url.pathname.startsWith("/api/settings") ||
              url.pathname.startsWith("/api/returns") ||
              url.pathname.startsWith("/api/reports") ||
              url.pathname.startsWith("/api/company") ||
              url.pathname.startsWith("/api/push-subscriptions"),
            handler: "NetworkFirst" as const,
            options: {
              cacheName: "geem-admin-api-v4",
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 3000, maxAgeSeconds: 60 * 60 * 24 * 30 }, // 30 days
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // ── Storage objects (product images, PDFs, logos) ──────────────────
          // CacheFirst: bitmaps don't change at the same URL; huge offline win.
          {
            urlPattern: ({ url }: { url: URL }) => url.pathname.startsWith("/api/storage/objects"),
            handler: "CacheFirst" as const,
            options: {
              cacheName: "geem-images-v4",
              expiration: { maxEntries: 1000, maxAgeSeconds: 60 * 60 * 24 * 90 }, // 90 days
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      }
    : {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2,woff,ttf}"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            // app-icon and favicon-icon are server-side DB-proxies — never cache them
            // so every page load picks up the latest logo the admin has saved.
            urlPattern: ({ url }: { url: URL }) =>
              url.pathname === "/api/shop/app-icon" ||
              url.pathname === "/api/shop/favicon-icon",
            handler: "NetworkOnly" as const,
          },
          {
            // seo-config carries live branding (logo, favicon, colors) — always network-first
            // so the browser immediately reflects changes the admin saves in Settings.
            urlPattern: ({ url }: { url: URL }) => url.pathname === "/api/shop/seo-config",
            handler: "NetworkFirst" as const,
            options: {
              cacheName: "geem-seo-config-v1",
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 1, maxAgeSeconds: 60 * 5 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ url }: { url: URL }) =>
              url.pathname.startsWith("/api/shop") ||
              url.pathname.startsWith("/api/brands") ||
              url.pathname.startsWith("/api/categories"),
            handler: "StaleWhileRevalidate" as const,
            options: {
              cacheName: "geem-shop-api-v2",
              expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ url }: { url: URL }) => url.pathname.startsWith("/api/storage/objects"),
            handler: "CacheFirst" as const,
            options: {
              cacheName: "geem-shop-images-v2",
              expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      };

/* ─── Post-build HTML patcher: rewrites mode-specific meta after all files written ─── */
const htmlPatchPlugin = {
  name: "geem-html-patch",
  apply: "build" as const,
  enforce: "post" as const,
  async closeBundle() {
    const outDir  = path.resolve(import.meta.dirname, "dist/public");
    const idxPath = path.join(outDir, "index.html");
    const swPath  = path.join(outDir, "sw.js");

    // 1. Patch index.html meta tags + manifest cache-bust
    if (fs.existsSync(idxPath)) {
      let html = fs.readFileSync(idxPath, "utf-8");
      if (appMode === "admin") {
        html = html
          .replace(/<title>[^<]*<\/title>/, "<title>Geem ERP \u2014 Staff Management Portal</title>")
          .replace(/(<meta name="apple-mobile-web-app-title" content=")[^"]*"/, '$1Geem ERP"')
          .replace(/(<meta name="application-name" content=")[^"]*"/, '$1Geem ERP"')
          .replace(/(<meta name="theme-color" content=")[^"]*"/, '$1#1e40af"')
          .replace(/(<meta name="msapplication-TileColor" content=")[^"]*"/, '$1#1e40af"');
      }
      // Add ?v=3 query to the manifest link so Samsung Browser re-fetches it
      // even if it cached the old version with max-age=31536000.
      // The query string is ignored by nginx but forces a new network request.
      html = html.replace(
        /(<link\s[^>]*rel="manifest"\s[^>]*href=")([^"?]+)(")/,
        '$1$2?v=3$3'
      );
      html = html.replace(
        /(<link\s[^>]*href=")([^"?]+manifest\.webmanifest)(")/,
        '$1$2?v=3$3'
      );
      fs.writeFileSync(idxPath, html, "utf-8");
    }

    // 2. Remove manifest.webmanifest from SW precache so Chrome always fetches
    //    it fresh (nginx sends no-store/no-cache). VitePWA injects it internally
    //    so manifestTransforms cannot filter it out.
    if (fs.existsSync(swPath)) {
      let sw = fs.readFileSync(swPath, "utf-8");
      sw = sw.replace(/,?\{url:"manifest\.webmanifest",revision:"[^"]*"\}/g, "");

      // 3. Merge push-sw.js handlers INTO sw.js so there is only ever ONE service
      //    worker at scope "/".  Registering a separate /push-sw.js at the same
      //    scope causes the two SWs to race: each activation fires controllerchange
      //    → window.location.reload() creating an infinite refresh loop.  Merging
      //    them means the Vite PWA SW also handles push + notificationclick events.
      const pushSwSrc = path.join(import.meta.dirname, "public/push-sw.js");
      if (fs.existsSync(pushSwSrc)) {
        const pushHandlers = fs.readFileSync(pushSwSrc, "utf-8");
        if (!sw.includes("/* Geem Push Notification Service Worker */")) {
          sw += "\n\n" + pushHandlers;
        }
      }

      fs.writeFileSync(swPath, sw, "utf-8");
    }

    // 4. Verify brand icons are present in dist.
    //    public/geem-icon-source.png is the canonical transparent G logo.
    //    Vite copies everything in public/ → dist/public/ automatically, so the
    //    pre-generated icon-192.png, icon-512.png, icon-512-maskable.png and
    //    apple-touch-icon.png are already in place after the Vite build step.
    //    Nothing extra to do — just log confirmation.
    const iconNames = ["icon-192.png", "icon-512.png", "icon-512-maskable.png", "apple-touch-icon.png"];
    const iconsMissing = iconNames.filter(n => !fs.existsSync(path.join(outDir, n)));
    if (iconsMissing.length === 0) {
      const sz = fs.statSync(path.join(outDir, "icon-192.png")).size;
      console.log(`[geem] brand icons ready in dist (icon-192 = ${sz} B, transparent G logo)`);
    } else {
      // One or more icons are absent — try fetching from API as last resort
      console.warn(`[geem] missing icons: ${iconsMissing.join(", ")} — trying API fallback`);
      try {
        const iconResp = await fetch("http://localhost:8080/api/shop/app-icon", {
          redirect: "follow",
          signal: AbortSignal.timeout(5000),
        });
        if (iconResp.ok) {
          const iconBuf = Buffer.from(await iconResp.arrayBuffer());
          if (iconBuf.length > 1024) {
            for (const name of iconsMissing) {
              fs.writeFileSync(path.join(outDir, name), iconBuf);
            }
            console.log(`[geem] missing icons filled from API (${iconBuf.length} B)`);
          }
        }
      } catch {
        console.warn("[geem] API fallback also failed — icons may be missing from build");
      }
    }
  },
};

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss({ optimize: false }),
    runtimeErrorOverlay(),
    htmlPatchPlugin,
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "icon-192.png", "icon-512.png", "icon-512-maskable.png", "apple-touch-icon.png"],
      manifest: pwaManifest,
      workbox: {
        ...pwaWorkbox,
        skipWaiting: true,
        clientsClaim: true,
        // Never let the SW cache the manifest — nginx already sends no-store/no-cache
        // for *.webmanifest so Chrome always fetches it fresh from the network.
        // This prevents stale "Geem Shop" name appearing after a bad deploy.
        manifestTransforms: [
          async (entries: Array<{ url: string; revision: string | null; integrity?: string }>) => ({
            manifest: entries.filter((e) => !e.url.includes("manifest.webmanifest")),
            warnings: [] as string[],
          }),
        ],
      },
    }),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
