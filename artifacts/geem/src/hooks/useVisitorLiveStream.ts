/**
 * useVisitorLiveStream
 * Connects to the /api/visitors/stream SSE endpoint and fires a callback
 * for each new visitor event. Automatically reconnects on disconnect.
 */
import { useEffect, useRef, useCallback, useState } from "react";

export interface VisitorEvent {
  page: string;
  city?: string | null;
  country?: string | null;
  device?: string | null;
  browser?: string | null;
  os?: string | null;
  referrer?: string | null;
  sessionId: string;
  timestamp: string;
}

function getToken(): string | null {
  return localStorage.getItem("geem_token");
}

export function useVisitorLiveStream(onVisitor: (event: VisitorEvent) => void) {
  const esRef = useRef<EventSource | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onVisitorRef = useRef(onVisitor);
  const [connected, setConnected] = useState(false);

  // Always use latest callback without re-connecting
  useEffect(() => { onVisitorRef.current = onVisitor; }, [onVisitor]);

  const connect = useCallback(() => {
    if (reconnectTimer.current) { clearTimeout(reconnectTimer.current); reconnectTimer.current = null; }
    if (esRef.current) { esRef.current.close(); esRef.current = null; }

    const token = getToken();
    if (!token) return; // not logged in

    const apiBase = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
    const url = `${apiBase}/api/visitors/stream?token=${encodeURIComponent(token)}`;

    const es = new EventSource(url);
    esRef.current = es;

    es.onopen = () => setConnected(true);

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data) as VisitorEvent;
        onVisitorRef.current(data);
      } catch { /* ignore malformed */ }
    };

    es.onerror = () => {
      setConnected(false);
      es.close();
      esRef.current = null;
      // Reconnect after 5 seconds
      reconnectTimer.current = setTimeout(connect, 5_000);
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (esRef.current) { esRef.current.close(); esRef.current = null; }
    };
  }, [connect]);

  return { connected };
}
