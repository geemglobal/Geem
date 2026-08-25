import { Router, type IRouter } from "express";
import { db, pushSubscriptionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getVapidPublicKey } from "../lib/push";

const router: IRouter = Router();

router.get("/push/vapid-public-key", (_req, res) => {
  res.json({ publicKey: getVapidPublicKey() });
});

router.post("/push/subscribe", async (req, res): Promise<void> => {
  const { endpoint, p256dh, auth, userType = "admin", userId } = req.body as {
    endpoint?: string; p256dh?: string; auth?: string; userType?: string; userId?: string;
  };
  if (!endpoint || !p256dh || !auth) {
    res.status(400).json({ error: "endpoint, p256dh, auth required" });
    return;
  }
  await db.insert(pushSubscriptionsTable)
    .values({ endpoint, p256dh, auth, userType, userId: userId ?? null })
    .onConflictDoUpdate({ target: pushSubscriptionsTable.endpoint, set: { p256dh, auth, userType, userId: userId ?? null } });
  res.json({ ok: true });
});

router.delete("/push/subscribe", async (req, res): Promise<void> => {
  const { endpoint } = req.body as { endpoint?: string };
  if (!endpoint) { res.status(400).json({ error: "endpoint required" }); return; }
  await db.delete(pushSubscriptionsTable).where(eq(pushSubscriptionsTable.endpoint, endpoint));
  res.json({ ok: true });
});

export default router;
