import { Router, type IRouter, type Request, type Response } from "express";
import nodemailer from "nodemailer";
import { db, integrationSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getUserIdFromToken } from "../lib/auth";

const router: IRouter = Router();

function auth(req: Request): Promise<number | null> {
  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer ")) return Promise.resolve(null);
  return getUserIdFromToken(h.slice(7));
}

interface EmailConfig {
  host: string; port: number; secure: boolean;
  user: string; password: string;
  fromName: string; fromEmail: string;
}
interface SmsConfig {
  provider: "twilio" | "ultramsg" | "generic";
  accountSid?: string; authToken?: string; fromNumber?: string; // Twilio
  instanceId?: string; token?: string;                          // UltraMsg
  apiUrl?: string; apiKey?: string; senderId?: string;          // Generic
}
interface WhatsappConfig {
  provider: "ultramsg" | "whatsapp_business" | "generic";
  instanceId?: string; token?: string;             // UltraMsg
  phoneNumberId?: string; accessToken?: string;    // WhatsApp Business (Meta)
  apiUrl?: string; apiKey?: string;                // Generic
}

async function getConfig<T>(type: string): Promise<{ enabled: boolean; config: T } | null> {
  const [row] = await db.select().from(integrationSettingsTable).where(eq(integrationSettingsTable.type, type));
  if (!row) return null;
  return { enabled: row.enabled, config: JSON.parse(row.config) as T };
}

async function upsertConfig(type: string, enabled: boolean, config: unknown): Promise<void> {
  const [existing] = await db.select().from(integrationSettingsTable).where(eq(integrationSettingsTable.type, type));
  if (existing) {
    await db.update(integrationSettingsTable)
      .set({ enabled, config: JSON.stringify(config), updatedAt: new Date() })
      .where(eq(integrationSettingsTable.id, existing.id));
  } else {
    await db.insert(integrationSettingsTable).values({ type, enabled, config: JSON.stringify(config) });
  }
}

// ── GET /settings/integrations/:type ──────────────────────────────────────
router.get("/settings/integrations/:type", async (req: Request, res: Response): Promise<void> => {
  if (!await auth(req)) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { type } = req.params as { type: string };
  const row = await getConfig(type);
  if (!row) {
    res.json({ enabled: false, config: {} });
    return;
  }
  // Mask passwords / tokens before sending to frontend
  const masked = maskSecrets(row.config as Record<string, unknown>);
  res.json({ enabled: row.enabled, config: masked });
});

// ── PATCH /settings/integrations/:type ────────────────────────────────────
router.patch("/settings/integrations/:type", async (req: Request, res: Response): Promise<void> => {
  if (!await auth(req)) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { type } = req.params as { type: string };
  const { enabled, config } = req.body as { enabled: boolean; config: Record<string, unknown> };

  // Load existing to merge (preserve stored password if frontend sent a masked placeholder)
  const existing = await getConfig<Record<string, unknown>>(type);
  const merged = mergeConfig(existing?.config ?? {}, config);

  await upsertConfig(type, Boolean(enabled), merged);
  res.json({ ok: true });
});

// ── POST /settings/integrations/email/test ────────────────────────────────
router.post("/settings/integrations/email/test", async (req: Request, res: Response): Promise<void> => {
  if (!await auth(req)) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { to } = req.body as { to?: string };
  const row = await getConfig<EmailConfig>("email");
  if (!row?.config?.host) { res.status(400).json({ error: "Email not configured" }); return; }
  const c = row.config;
  try {
    const transport = nodemailer.createTransport({
      host: c.host, port: c.port, secure: c.secure,
      tls: { rejectUnauthorized: false },
      ...(c.user ? { auth: { user: c.user, pass: c.password } } : {}),
    });
    await transport.verify();
    await transport.sendMail({
      from: `"${c.fromName}" <${c.fromEmail}>`,
      to: to ?? c.fromEmail,
      subject: "Geem CRM — Test Email",
      text: "✅ Your email integration is working correctly.",
      html: "<p>✅ <strong>Your email integration is working correctly.</strong></p><p>This test was sent from Geem CRM.</p>",
    });
    res.json({ ok: true, message: `Test email sent to ${to ?? c.fromEmail}` });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ── POST /settings/integrations/sms/test ─────────────────────────────────
router.post("/settings/integrations/sms/test", async (req: Request, res: Response): Promise<void> => {
  if (!await auth(req)) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { to } = req.body as { to?: string };
  const row = await getConfig<SmsConfig>("sms");
  if (!row?.config?.provider) { res.status(400).json({ error: "SMS not configured" }); return; }
  const c = row.config;
  const msg = "Geem CRM test message ✅";

  try {
    if (c.provider === "twilio") {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${c.accountSid}/Messages.json`;
      const body = new URLSearchParams({ From: c.fromNumber!, To: to!, Body: msg });
      const resp = await fetch(url, {
        method: "POST", body,
        headers: { Authorization: "Basic " + Buffer.from(`${c.accountSid}:${c.authToken}`).toString("base64") },
      });
      if (!resp.ok) throw new Error(await resp.text());
    } else if (c.provider === "ultramsg") {
      const url = `https://api.ultramsg.com/${c.instanceId}/messages/sms`;
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: c.token, to, body: msg }),
      });
      if (!resp.ok) throw new Error(await resp.text());
    } else {
      // Generic HTTP POST gateway
      const resp = await fetch(c.apiUrl!, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${c.apiKey}` },
        body: JSON.stringify({ to, message: msg, sender: c.senderId }),
      });
      if (!resp.ok) throw new Error(await resp.text());
    }
    res.json({ ok: true, message: `Test SMS sent to ${to}` });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ── POST /settings/integrations/whatsapp/test ─────────────────────────────
router.post("/settings/integrations/whatsapp/test", async (req: Request, res: Response): Promise<void> => {
  if (!await auth(req)) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { to } = req.body as { to?: string };
  const row = await getConfig<WhatsappConfig>("whatsapp");
  if (!row?.config?.provider) { res.status(400).json({ error: "WhatsApp not configured" }); return; }
  const c = row.config;
  const msg = "Geem CRM test message ✅";

  try {
    if (c.provider === "ultramsg") {
      const url = `https://api.ultramsg.com/${c.instanceId}/messages/chat`;
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: c.token, to, body: msg }),
      });
      if (!resp.ok) throw new Error(await resp.text());
    } else if (c.provider === "whatsapp_business") {
      // Meta WhatsApp Business Cloud API
      const url = `https://graph.facebook.com/v18.0/${c.phoneNumberId}/messages`;
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${c.accessToken}` },
        body: JSON.stringify({
          messaging_product: "whatsapp", to,
          type: "text", text: { body: msg },
        }),
      });
      if (!resp.ok) throw new Error(await resp.text());
    } else {
      const resp = await fetch(c.apiUrl!, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${c.apiKey}` },
        body: JSON.stringify({ to, message: msg }),
      });
      if (!resp.ok) throw new Error(await resp.text());
    }
    res.json({ ok: true, message: `Test WhatsApp message sent to ${to}` });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ── helpers ────────────────────────────────────────────────────────────────
const SECRET_KEYS = new Set(["password", "authToken", "token", "accessToken", "apiKey", "accountSid"]);
const MASK = "••••••••";

function maskSecrets(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k, SECRET_KEYS.has(k) && v ? MASK : v])
  );
}

function mergeConfig(stored: Record<string, unknown>, incoming: Record<string, unknown>): Record<string, unknown> {
  const result = { ...stored };
  for (const [k, v] of Object.entries(incoming)) {
    // Don't overwrite stored secret with the masked placeholder
    if (SECRET_KEYS.has(k) && v === MASK) continue;
    result[k] = v;
  }
  return result;
}

export default router;
