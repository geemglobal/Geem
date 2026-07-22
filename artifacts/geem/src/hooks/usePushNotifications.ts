import { useEffect, useRef } from "react";
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

export interface PushSubscribeOptions {
  authHeader: () => Record<string, string>;
  userType: "admin" | "shop";
  userId?: string;
}

export function usePushNotifications(opts: PushSubscribeOptions) {
  const subscribedRef = useRef<string | null>(null);

  useEffect(() => {
    // Wait until userId is known — subscribing without it means push can never be routed back
    if (!opts.userId) return;
    // Already subscribed for this exact userId — skip
    if (subscribedRef.current === opts.userId) return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

    async function subscribe() {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") return;

        // Use the EXISTING Vite PWA service worker — do NOT register /push-sw.js
        // as a separate SW at scope "/".  Two SWs at the same scope race:
        // each activation fires controllerchange → window.location.reload(),
        // creating an infinite refresh loop.  Push handlers are now merged
        // into the Vite SW at build time (see vite.config.ts htmlPatchPlugin).
        const reg = await navigator.serviceWorker.ready;

        const vapidKey = await getVapidPublicKey();
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
      } catch {
        /* silently ignore — push is optional */
      }
    }

    subscribe();
  }, [opts.userType, opts.userId]);
}
