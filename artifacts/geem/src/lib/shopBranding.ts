/**
 * Shared shop branding hook — fetches company branding (logo, gLogo, banner, favicon)
 * from the public seo-config endpoint with module-level caching so all pages
 * share a single network request.
 */
import { useState, useEffect } from "react";

export interface ShopBranding {
  companyName: string;
  /** Full company logo (wordmark / banner logo) — used in headers, footer, auth pages */
  logo: string | null;
  /** G icon — used for app icons, loading splash, PWA install prompts */
  gLogo: string | null;
  /** Browser-tab favicon */
  favicon: string | null;
  /** Hero / cover banner image */
  banner: string | null;
}

const DEFAULT: ShopBranding = { companyName: "Geem", logo: null, gLogo: null, favicon: null, banner: null };

let _cache: ShopBranding | null = null;
const _listeners: Array<(b: ShopBranding) => void> = [];
let _loading = false;

function ensureLoaded(): void {
  if (_cache || _loading) return;
  _loading = true;
  fetch("/api/shop/seo-config")
    .then(r => r.json())
    .then((d: Record<string, unknown>) => {
      _cache = {
        companyName: (d.companyName as string) ?? "Geem",
        logo: (d.logo as string | null) ?? null,
        gLogo: (d.gLogo as string | null) ?? null,
        favicon: (d.favicon as string | null) ?? null,
        banner: (d.banner as string | null) ?? null,
      };
      _listeners.splice(0).forEach(fn => fn(_cache!));
    })
    .catch(() => { _loading = false; });
}

/** React hook — returns branding data, starting with defaults and updating once loaded. */
export function useShopBranding(): ShopBranding {
  const [branding, setBranding] = useState<ShopBranding>(_cache ?? DEFAULT);

  useEffect(() => {
    if (_cache) { setBranding(_cache); return; }
    _listeners.push(setBranding);
    ensureLoaded();
    return () => {
      const idx = _listeners.indexOf(setBranding);
      if (idx !== -1) _listeners.splice(idx, 1);
    };
  }, []);

  return branding;
}
