import { logger } from "./logger.js";
import { db, integrationSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const ENV_SECRET = process.env.RECAPTCHA_SECRET_KEY ?? "";
const SCORE_THRESHOLD = 0.5;

interface RecaptchaResponse {
  success: boolean;
  score?: number;
  action?: string;
  "error-codes"?: string[];
}

/** Returns secret key: env var first, then DB integration settings. */
async function getSecretKey(): Promise<string> {
  if (ENV_SECRET) return ENV_SECRET;
  try {
    const [row] = await db
      .select()
      .from(integrationSettingsTable)
      .where(eq(integrationSettingsTable.type, "recaptcha"));
    if (row?.enabled && row.config) {
      const cfg = JSON.parse(row.config) as Record<string, string>;
      return cfg.secretKey ?? "";
    }
  } catch { /* ignore — no DB row yet */ }
  return "";
}

/**
 * Verify a reCAPTCHA v3 token server-side.
 * Secret key is read from RECAPTCHA_SECRET_KEY env var (highest priority)
 * or from the admin dashboard DB setting as a fallback.
 * Returns { ok: true } when neither source is configured (graceful degradation).
 */
export async function verifyRecaptcha(
  token: string | undefined,
  expectedAction?: string,
): Promise<{ ok: boolean; score?: number; error?: string }> {
  const secret = await getSecretKey();

  if (!secret) return { ok: true };
  if (!token)  return { ok: false, error: "reCAPTCHA token missing" };

  try {
    const params = new URLSearchParams({ secret, response: token });
    const res = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
      signal: AbortSignal.timeout(5000),
    });

    const data = (await res.json()) as RecaptchaResponse;

    if (!data.success) {
      logger.warn({ codes: data["error-codes"] }, "reCAPTCHA verification failed");
      return { ok: false, error: "reCAPTCHA check failed" };
    }

    if (data.score !== undefined && data.score < SCORE_THRESHOLD) {
      logger.warn({ score: data.score }, "reCAPTCHA score too low — bot suspected");
      return { ok: false, score: data.score, error: "Automated request detected. Please try again." };
    }

    if (expectedAction && data.action && data.action !== expectedAction) {
      logger.warn({ expected: expectedAction, got: data.action }, "reCAPTCHA action mismatch");
      return { ok: false, error: "reCAPTCHA action mismatch" };
    }

    return { ok: true, score: data.score };
  } catch (err) {
    logger.error({ err }, "reCAPTCHA network error — allowing request through");
    return { ok: true };
  }
}
