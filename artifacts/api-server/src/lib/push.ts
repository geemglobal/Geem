import webpush from "web-push";
import fs from "fs";
import path from "path";
import { db, pushSubscriptionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

const KEYS_FILE = path.join(import.meta.dirname, "../../.vapid-keys.json");

let vapidKeys: { publicKey: string; privateKey: string } | null = null;

function loadOrGenerateVapidKeys(): { publicKey: string; privateKey: string } {
  if (vapidKeys) return vapidKeys;
  if (fs.existsSync(KEYS_FILE)) {
    try {
      vapidKeys = JSON.parse(fs.readFileSync(KEYS_FILE, "utf8"));
      return vapidKeys!;
    } catch { /* fall through to generate */ }
  }
  const keys = webpush.generateVAPIDKeys();
  fs.writeFileSync(KEYS_FILE, JSON.stringify(keys, null, 2));
  vapidKeys = keys;
  logger.info("Generated new VAPID keys");
  return keys;
}

export function getVapidPublicKey(): string {
  return loadOrGenerateVapidKeys().publicKey;
}

function getWebPush() {
  const keys = loadOrGenerateVapidKeys();
  webpush.setVapidDetails("mailto:info@geem.pk", keys.publicKey, keys.privateKey);
  return webpush;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  requireInteraction?: boolean;
}

export async function sendPushToAdmins(payload: PushPayload): Promise<void> {
  const subs = await db.select().from(pushSubscriptionsTable).where(eq(pushSubscriptionsTable.userType, "admin"));
  if (!subs.length) return;
  const wp = getWebPush();
  const json = JSON.stringify(payload);
  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await wp.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, json);
      } catch (err: unknown) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 410 || status === 404) {
          await db.delete(pushSubscriptionsTable).where(eq(pushSubscriptionsTable.id, sub.id));
        }
      }
    })
  );
}

export async function sendPushToUser(userType: string, userId: string, payload: PushPayload): Promise<void> {
  const subs = await db.select().from(pushSubscriptionsTable)
    .where(eq(pushSubscriptionsTable.userId, userId));
  if (!subs.length) return;
  const wp = getWebPush();
  const json = JSON.stringify(payload);
  await Promise.allSettled(
    subs.filter(s => s.userType === userType).map(async (sub) => {
      try {
        await wp.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, json);
      } catch (err: unknown) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 410 || status === 404) {
          await db.delete(pushSubscriptionsTable).where(eq(pushSubscriptionsTable.id, sub.id));
        }
      }
    })
  );
}
