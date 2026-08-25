import Axios from "axios";
import { enqueue } from "./offlineQueue";

export const axiosInstance = Axios.create({ baseURL: "/api" });

// ── Auth header ──────────────────────────────────────────────────────────────
axiosInstance.interceptors.request.use((cfg) => {
  if (!cfg.headers.Authorization) {
    const token = localStorage.getItem("geem_token");
    if (token) cfg.headers.Authorization = `Bearer ${token}`;
  }
  return cfg;
});

// ── Offline mutation queue ───────────────────────────────────────────────────
// When a write request fails because the device is offline (no HTTP response),
// save it to IndexedDB and return a synthetic success so the UI stays happy.
// Pages check `data._offlineQueued` to show "saved offline" messaging.
axiosInstance.interceptors.response.use(
  (res) => res,
  async (error) => {
    const method = (error.config?.method ?? "").toUpperCase();
    const isWrite = ["POST", "PATCH", "PUT", "DELETE"].includes(method);
    const isNetworkError = !error.response; // true when the network is down

    if (isWrite && isNetworkError) {
      const token = localStorage.getItem("geem_token") ?? undefined;
      // config.url already includes /api prefix from baseURL — strip it so
      // syncQueue can prepend /api again when replaying.
      const url = (error.config?.url ?? "").replace(/^\/api/, "");
      let data: unknown;
      try {
        data =
          typeof error.config?.data === "string"
            ? JSON.parse(error.config.data)
            : error.config?.data;
      } catch { /* non-JSON body — store as-is */ }

      await enqueue({
        method,
        url,
        data,
        token,
        label: `${method} ${url}`,
      }).catch(() => {});

      // Notify UI (AdminLayout sync badge, OfflineSyncManager)
      window.dispatchEvent(new Event("offline-queue-updated"));

      // Resolve with a sentinel so mutation onSuccess fires.
      // Callers check data._offlineQueued to adjust their behaviour.
      return {
        data: { _offlineQueued: true },
        status: 202,
        statusText: "Queued Offline",
        headers: {},
        config: error.config,
      };
    }

    throw error;
  },
);
