declare global {
  interface Window {
    grecaptcha: {
      ready: (cb: () => void) => void;
      execute: (siteKey: string, options: { action: string }) => Promise<string>;
    };
  }
}

const SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY as string | undefined;

let _scriptPromise: Promise<void> | null = null;

function loadRecaptchaScript(): Promise<void> {
  if (!SITE_KEY) return Promise.resolve();
  if (_scriptPromise) return _scriptPromise;

  _scriptPromise = new Promise<void>((resolve) => {
    if (document.querySelector(`script[src*="recaptcha"]`)) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = `https://www.google.com/recaptcha/api.js?render=${SITE_KEY}`;
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
 * Returns undefined if VITE_RECAPTCHA_SITE_KEY is not set (graceful degradation).
 */
export async function getRecaptchaToken(action: string): Promise<string | undefined> {
  if (!SITE_KEY) return undefined;
  try {
    await loadRecaptchaScript();
    return await new Promise<string>((resolve, reject) => {
      window.grecaptcha.ready(async () => {
        try {
          const token = await window.grecaptcha.execute(SITE_KEY, { action });
          resolve(token);
        } catch (e) {
          reject(e);
        }
      });
    });
  } catch {
    return undefined;
  }
}
