import nodemailer from "nodemailer";
import {
  db, integrationSettingsTable, simCustomersTable, simCustomerSimsTable,
  simNotificationsTable,
} from "@workspace/db";
import { and, eq, gte } from "drizzle-orm";
import { logger } from "./logger";

interface EmailConfig {
  host: string; port: number; secure: boolean;
  user: string; password: string;
  fromName: string; fromEmail: string;
}

interface SmsConfig {
  provider: "twilio" | "ultramsg" | "generic";
  accountSid?: string; authToken?: string; fromNumber?: string;
  instanceId?: string; token?: string;
  apiUrl?: string; apiKey?: string; senderId?: string;
}

async function getIntegrationConfig<T>(type: string): Promise<{ enabled: boolean; config: T } | null> {
  const [row] = await db.select().from(integrationSettingsTable).where(eq(integrationSettingsTable.type, type));
  if (!row || !row.enabled) return null;
  return { enabled: row.enabled, config: JSON.parse(row.config) as T };
}

async function trySendSms(to: string, message: string): Promise<boolean> {
  const cfg = await getIntegrationConfig<SmsConfig>("sms");
  if (!cfg) return false;
  const c = cfg.config;
  try {
    if (c.provider === "twilio") {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${c.accountSid}/Messages.json`;
      const body = new URLSearchParams({ From: c.fromNumber!, To: to, Body: message });
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
        body: JSON.stringify({ token: c.token, to, body: message }),
      });
      if (!resp.ok) throw new Error(await resp.text());
    } else {
      const resp = await fetch(c.apiUrl!, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${c.apiKey}` },
        body: JSON.stringify({ to, message, sender: c.senderId }),
      });
      if (!resp.ok) throw new Error(await resp.text());
    }
    return true;
  } catch (err) {
    logger.warn({ err, to }, "SIM expiry SMS send failed");
    return false;
  }
}

async function trySendEmail(to: string, subject: string, html: string, text: string): Promise<boolean> {
  const cfg = await getIntegrationConfig<EmailConfig>("email");
  if (!cfg) return false;
  const c = cfg.config;
  try {
    const transport = nodemailer.createTransport({
      host: c.host, port: c.port, secure: c.secure,
      auth: { user: c.user, pass: c.password },
    });
    await transport.sendMail({
      from: `"${c.fromName}" <${c.fromEmail}>`,
      to,
      subject,
      text,
      html,
    });
    return true;
  } catch (err) {
    logger.warn({ err, to }, "SIM expiry email send failed");
    return false;
  }
}

export interface ExpiryAlertStats {
  sent: number;
  skipped: number;
  failed: number;
  noContact: number;
}

/**
 * Runs the expiry alert job: finds all SIMs expiring within 7 days,
 * sends an SMS (preferred) or email to each customer, and logs the send
 * to sim_notifications with type "expiry_push" so it is deduped on the
 * next run (20-hour window covers daily cron with timing drift).
 */
export async function runExpiryAlertJob(): Promise<ExpiryAlertStats> {
  const stats: ExpiryAlertStats = { sent: 0, skipped: 0, failed: 0, noContact: 0 };

  const DEDUP_WINDOW_MS = 20 * 60 * 60 * 1000;
  const dedupCutoff = new Date(Date.now() - DEDUP_WINDOW_MS);
  const sevenDaysFromNow = new Date(Date.now() + 7 * 86_400_000);
  const now = new Date();

  const rows = await db
    .select({
      iccid: simCustomerSimsTable.iccid,
      nickname: simCustomerSimsTable.nickname,
      expireTime: simCustomerSimsTable.expireTime,
      customerId: simCustomerSimsTable.customerId,
      customerName: simCustomersTable.fullName,
      customerPhone: simCustomersTable.phone,
      customerEmail: simCustomersTable.email,
      isActive: simCustomersTable.isActive,
    })
    .from(simCustomerSimsTable)
    .innerJoin(simCustomersTable, eq(simCustomerSimsTable.customerId, simCustomersTable.id))
    .where(eq(simCustomersTable.isActive, true));

  const expiring = rows.filter((r) => {
    if (!r.expireTime) return false;
    const exp = new Date(r.expireTime);
    return !isNaN(exp.getTime()) && exp > now && exp <= sevenDaysFromNow;
  });

  for (const sim of expiring) {
    const expires = new Date(sim.expireTime!);
    const daysLeft = Math.ceil((expires.getTime() - Date.now()) / 86_400_000);
    const label = sim.nickname ?? sim.iccid.slice(-8);

    const [existing] = await db
      .select({ id: simNotificationsTable.id })
      .from(simNotificationsTable)
      .where(
        and(
          eq(simNotificationsTable.customerId, sim.customerId),
          eq(simNotificationsTable.type, "expiry_push"),
          eq(simNotificationsTable.iccid, sim.iccid),
          gte(simNotificationsTable.createdAt, dedupCutoff),
        )
      )
      .limit(1);

    if (existing) {
      stats.skipped++;
      continue;
    }

    const expireStr = expires.toLocaleDateString("en-PK");
    const smsText = `Geem SIM Alert: Your SIM ${label} expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"} on ${expireStr}. Renew now to avoid interruption: sim.geem.pk`;

    let delivered = false;

    if (sim.customerPhone) {
      delivered = await trySendSms(sim.customerPhone, smsText);
    }

    if (!delivered && sim.customerEmail) {
      const subject = `Action Required: Geem SIM expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`;
      const html = `
<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:20px">
  <div style="background:#e11d48;padding:16px 20px;border-radius:10px 10px 0 0">
    <img src="https://sim.geem.pk/geem-logo.png" alt="Geem" style="height:32px" onerror="this.style.display='none'"/>
    <h2 style="color:white;margin:8px 0 0">⚠️ SIM Expiry Alert</h2>
  </div>
  <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 10px 10px">
    <p>Hello <strong>${sim.customerName ?? "Valued Customer"}</strong>,</p>
    <p>Your Geem IoT SIM <strong>${label}</strong> will expire in
      <strong>${daysLeft} day${daysLeft === 1 ? "" : "s"}</strong> on <strong>${expireStr}</strong>.</p>
    <p>Please log in and renew your plan to avoid service interruption.</p>
    <p style="text-align:center;margin:24px 0">
      <a href="https://sim.geem.pk" style="background:#e11d48;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">
        Renew Now →
      </a>
    </p>
    <hr style="border:none;border-top:1px solid #f0f0f0;margin:20px 0"/>
    <p style="font-size:12px;color:#9ca3af">
      Geem | support@geem.pk | +92 307-8680005
    </p>
  </div>
</div>`;
      const text = `Hello ${sim.customerName ?? "Valued Customer"}, your Geem SIM ${label} expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"} on ${expireStr}. Please renew at sim.geem.pk.`;
      delivered = await trySendEmail(sim.customerEmail, subject, html, text);
    }

    if (!sim.customerPhone && !sim.customerEmail) {
      logger.warn({ customerId: sim.customerId, iccid: sim.iccid }, "SIM expiry: no contact method on file");
      stats.noContact++;
      continue;
    }

    await db.insert(simNotificationsTable).values({
      customerId: sim.customerId,
      type: "expiry_push",
      iccid: sim.iccid,
      message: delivered
        ? `Push alert sent: SIM ${label} expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"} (${expireStr})`
        : `Push alert failed to deliver for SIM ${label} (${expireStr})`,
    });

    if (delivered) {
      stats.sent++;
    } else {
      stats.failed++;
      logger.warn({ customerId: sim.customerId, iccid: sim.iccid }, "SIM expiry alert: all delivery methods failed");
    }
  }

  logger.info(stats, "SIM expiry alert job complete");
  return stats;
}

/** Schedules the expiry alert job to run once 5 minutes after startup, then every 24 hours. */
export function scheduleExpiryAlerts(): void {
  const run = () => {
    runExpiryAlertJob().catch((err) => logger.error({ err }, "SIM expiry alert job failed"));
  };
  setTimeout(() => {
    run();
    setInterval(run, 24 * 60 * 60 * 1000);
  }, 5 * 60 * 1000);
  logger.info("SIM expiry alert job scheduled (first run in 5 min, then every 24 h)");
}
