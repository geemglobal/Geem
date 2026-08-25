import { db, integrationSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

interface SmsConfig {
  provider: "twilio" | "ultramsg" | "generic";
  accountSid?: string; authToken?: string; fromNumber?: string;
  instanceId?: string; token?: string;
  apiUrl?: string; apiKey?: string; senderId?: string;
}

interface WaConfig {
  provider: "ultramsg" | "whatsapp_business" | "generic";
  instanceId?: string; token?: string;
  phoneNumberId?: string; accessToken?: string;
  apiUrl?: string; apiKey?: string;
}

async function getConfig<T>(type: string): Promise<{ enabled: boolean; config: T } | null> {
  const [row] = await db.select().from(integrationSettingsTable).where(eq(integrationSettingsTable.type, type));
  if (!row) return null;
  return { enabled: row.enabled, config: JSON.parse(row.config) as T };
}

export async function sendSms(to: string, body: string): Promise<boolean> {
  const row = await getConfig<SmsConfig>("sms");
  if (!row?.enabled || !row.config) return false;
  const c = row.config;
  try {
    if (c.provider === "twilio") {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${c.accountSid}/Messages.json`;
      const resp = await fetch(url, {
        method: "POST",
        body: new URLSearchParams({ From: c.fromNumber!, To: to, Body: body }),
        headers: { Authorization: "Basic " + Buffer.from(`${c.accountSid}:${c.authToken}`).toString("base64") },
      });
      return resp.ok;
    } else if (c.provider === "ultramsg") {
      const resp = await fetch(`https://api.ultramsg.com/${c.instanceId}/messages/sms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: c.token, to, body }),
      });
      return resp.ok;
    } else {
      const resp = await fetch(c.apiUrl!, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${c.apiKey}` },
        body: JSON.stringify({ to, message: body, sender: c.senderId }),
      });
      return resp.ok;
    }
  } catch { return false; }
}

export async function sendWhatsApp(to: string, body: string): Promise<boolean> {
  const row = await getConfig<WaConfig>("whatsapp");
  if (!row?.enabled || !row.config) return false;
  const c = row.config;
  try {
    if (c.provider === "ultramsg") {
      const resp = await fetch(`https://api.ultramsg.com/${c.instanceId}/messages/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: c.token, to, body }),
      });
      return resp.ok;
    } else if (c.provider === "whatsapp_business") {
      const resp = await fetch(`https://graph.facebook.com/v18.0/${c.phoneNumberId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${c.accessToken}` },
        body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body } }),
      });
      return resp.ok;
    } else {
      const resp = await fetch(c.apiUrl!, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${c.apiKey}` },
        body: JSON.stringify({ to, message: body }),
      });
      return resp.ok;
    }
  } catch { return false; }
}
