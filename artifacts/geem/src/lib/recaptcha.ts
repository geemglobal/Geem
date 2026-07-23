declare global {
  interface Window {
    grecaptcha: {
      ready: (cb: () => void) => void;
      execute: (siteKey: string, options: { action: string }) => Promise<string>;
    };
  }
}

// Build-time env var (works in local dev or if set on the build server).
// When absent the key is fetched dynamically from the API so the VPS
// never needs a rebuild just because the key is configured via the admin UI.
const ENV_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY as string | undefined;

let _siteKeyPromise: Promise<string | null> | null = null;

/** Returns the reCAPTCHA v3 site key, fetching from the API if needed. */
async function getSiteKey(): Promise<string | null> {
  if (ENV_SITE_KEY) return ENV_SITE_KEY;
  if (!_siteKeyPromise) {
    _siteKeyPromise = fetch("/api/auth/recaptcha-config")
      .then((r) => r.json() as Promise<{ enabled: boolean; siteKey: string | null }>)
      .then((d) => (d.enabled && d.siteKey ? d.siteKey : null))
      .catch(() => null);
  }
  return _siteKeyPromise;
}

let _scriptPromise: Promise<void> | null = null;

function loadRecaptchaScript(siteKey: string): Promise<void> {
  if (_scriptPromise) return _scriptPromise;
  _scriptPromise = new Promise<void>((resolve) => {
    if (document.querySelector(`script[src*="recaptcha"]`)) { resolve(); return; }
    const script = document.createElement("script");
    script.src = `https://www.google.com/recaptcha/api.js?render=${siteKey}`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => resolve();
    document.head.appendChild(script);
  });
  return _scriptPromise;
}

/**
 * Get a reCAPTCHA v3 token for the given action.
 * Returns undefined if reCAPTCHA is not configured (graceful degradation).
 */
export async function getRecaptchaToken(action: string): Promise<string | undefined> {
  const siteKey = await getSiteKey();
  if (!siteKey) return undefined;
  try {
    await loadRecaptchaScript(siteKey);
    return await new Promise<string>((resolve, reject) => {
      window.grecaptcha.ready(async () => {
        try {
          resolve(await window.grecaptcha.execute(siteKey, { action }));
        } catch (e) { reject(e); }
      });
    });
  } catch {
    return undefined;
  }
}
