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
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      }
    : {
        name: "Geem.pk — GPS Trackers Pakistan",
        short_name: "Geem ERP",
        description: "Pakistan's most trusted GPS tracker store — vehicle trackers, OBD2, personal trackers & SIM cards",
        theme_color: "#dc2626",
        background_color: "#0a0a0a",
        display: "standalone" as const,
        orientation: "any" as const,
        scope: "/",
        start_url: "/",
        categories: ["shopping", "lifestyle"],
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      };

const pwaWorkbox =
  appMode === "admin"
    ? {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2,woff,ttf}"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
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
              url.pathname.startsWith("/api/search"),
            handler: "StaleWhileRevalidate" as const,
            options: {
              cacheName: "geem-admin-api-v3",
              expiration: { maxEntries: 2000, maxAgeSeconds: 60 * 60 * 24 * 14 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ url }: { url: URL }) => url.pathname.startsWith("/api/dashboard"),
            handler: "StaleWhileRevalidate" as const,
            options: {
              cacheName: "geem-dashboard-v3",
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ url }: { url: URL }) => url.pathname.startsWith("/api/storage/objects"),
            handler: "CacheFirst" as const,
            options: {
              cacheName: "geem-images-v3",
              expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 60 },
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
  closeBundle() {
    const outDir  = path.resolve(import.meta.dirname, "dist/public");
    const idxPath = path.join(outDir, "index.html");
    const swPath  = path.join(outDir, "sw.js");

    // 1. Patch index.html meta tags
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
      fs.writeFileSync(idxPath, html, "utf-8");
    }

    // 2. Remove manifest.webmanifest from SW precache so Chrome always fetches
    //    it fresh (nginx sends no-store/no-cache). VitePWA injects it internally
    //    so manifestTransforms cannot filter it out.
    if (fs.existsSync(swPath)) {
      let sw = fs.readFileSync(swPath, "utf-8");
      sw = sw.replace(/,?\{url:"manifest\.webmanifest",revision:"[^"]*"\}/g, "");
      fs.writeFileSync(swPath, sw, "utf-8");
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
      includeAssets: ["favicon.svg", "geem-logo.png", "geem-logo.svg", "icon-192.png", "icon-512.png", "icon-512-maskable.png", "apple-touch-icon.png"],
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
