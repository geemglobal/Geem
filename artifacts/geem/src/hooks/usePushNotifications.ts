import { useState, useEffect, useRef, useCallback } from "react";
import { axiosInstance } from "@/lib/axios";

async function getVapidPublicKey(): Promise<string> {
  const res = await axiosInstance.get<{ publicKey: string }>("/push/vapid-public-key");
  return res.data.publicKey;
}

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) output[i] = rawData.charCodeAt(i);
  return output.buffer;
}

export type PushStatus = "unsupported" | "checking" | "not_subscribed" | "subscribed" | "denied" | "error";

export interface PushSubscribeOptions {
  authHeader: () => Record<string, string>;
  userType: "admin" | "shop";
  userId?: string;
}

export function usePushNotifications(opts: PushSubscribeOptions) {
  const [status, setStatus] = useState<PushStatus>("checking");
  const subscribedRef = useRef<string | null>(null);

  // Core subscribe logic — call this from a user-gesture handler on mobile
  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!opts.userId) return false;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus("unsupported");
      return false;
    }

    try {
      // Request permission — MUST be called from a user gesture on mobile
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus("denied");
        return false;
      }

      const reg = await navigator.serviceWorker.ready;
      const vapidKey = await getVapidPublicKey();

      // Check if already subscribed with same key
      const existing = await reg.pushManager.getSubscription();
      if (existing) {
        // Re-save to DB in case it was lost
        const json = existing.toJSON();
        await axiosInstance.post(
          "/push/subscribe",
          {
            endpoint: json.endpoint,
            p256dh: (json.keys as Record<string, string>)?.p256dh,
            auth: (json.keys as Record<string, string>)?.auth,
            userType: opts.userType,
            userId: opts.userId,
          },
          { headers: opts.authHeader() }
        );
        subscribedRef.current = opts.userId;
        setStatus("subscribed");
        return true;
      }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

      const json = sub.toJSON();
      await axiosInstance.post(
        "/push/subscribe",
        {
          endpoint: json.endpoint,
          p256dh: (json.keys as Record<string, string>)?.p256dh,
          auth: (json.keys as Record<string, string>)?.auth,
          userType: opts.userType,
          userId: opts.userId,
        },
        { headers: opts.authHeader() }
      );

      subscribedRef.current = opts.userId!;
      setStatus("subscribed");
      return true;
    } catch {
      setStatus("error");
      return false;
    }
  }, [opts.userType, opts.userId]);

  // On mount: check current permission + try silent subscribe if already granted
  useEffect(() => {
    if (!opts.userId) return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus("unsupported");
      return;
    }

    const perm = Notification.permission;
    if (perm === "denied") {
      setStatus("denied");
      return;
    }

    // Check if a subscription already exists
    navigator.serviceWorker.ready.then(reg =>
      reg.pushManager.getSubscription()
    ).then(existing => {
      if (existing) {
        // Subscription exists — re-register with server in case DB was wiped
        if (subscribedRef.current !== opts.userId) {
          const json = existing.toJSON();
          axiosInstance.post(
            "/push/subscribe",
            {
              endpoint: json.endpoint,
              p256dh: (json.keys as Record<string, string>)?.p256dh,
              auth: (json.keys as Record<string, string>)?.auth,
              userType: opts.userType,
              userId: opts.userId,
            },
            { headers: opts.authHeader() }
          ).then(() => {
            subscribedRef.current = opts.userId!;
            setStatus("subscribed");
          }).catch(() => setStatus("error"));
        } else {
          setStatus("subscribed");
        }
      } else if (perm === "granted") {
        // Permission already granted but no subscription — subscribe silently
        // Safe without gesture since permission is already granted
        subscribe().catch(() => {});
      } else {
        // Default / not asked yet — show the enable button
        setStatus("not_subscribed");
      }
    }).catch(() => setStatus("error"));
  }, [opts.userId]);

  return { status, subscribe };
}
