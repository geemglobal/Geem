import type { Response } from "express";

// In-memory SSE listeners per session
const listeners = new Map<number, Set<Response>>();

// Global admin listeners (receive events from ALL sessions)
const globalListeners = new Set<Response>();

export function addListener(sessionId: number, res: Response) {
  if (!listeners.has(sessionId)) listeners.set(sessionId, new Set());
  listeners.get(sessionId)!.add(res);
}

export function removeListener(sessionId: number, res: Response) {
  listeners.get(sessionId)?.delete(res);
}

export function addGlobalListener(res: Response) {
  globalListeners.add(res);
}

export function removeGlobalListener(res: Response) {
  globalListeners.delete(res);
}

export function broadcast(sessionId: number, event: string, data: unknown) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

  // Notify session-specific listeners
  const clients = listeners.get(sessionId);
  if (clients?.size) {
    for (const res of clients) {
      try { res.write(payload); } catch { /* client disconnected */ }
    }
  }

  // Notify global admin listeners (include sessionId in the data)
  if (globalListeners.size) {
    const globalPayload = `event: ${event}\ndata: ${JSON.stringify({ sessionId, ...(typeof data === "object" && data !== null ? data : { value: data }) })}\n\n`;
    for (const res of globalListeners) {
      try { res.write(globalPayload); } catch { globalListeners.delete(res); }
    }
  }
}
