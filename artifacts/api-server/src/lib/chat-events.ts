import type { Response } from "express";

// In-memory SSE listeners per session
const listeners = new Map<number, Set<Response>>();

export function addListener(sessionId: number, res: Response) {
  if (!listeners.has(sessionId)) listeners.set(sessionId, new Set());
  listeners.get(sessionId)!.add(res);
}

export function removeListener(sessionId: number, res: Response) {
  listeners.get(sessionId)?.delete(res);
}

export function broadcast(sessionId: number, event: string, data: unknown) {
  const clients = listeners.get(sessionId);
  if (!clients?.size) return;
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) {
    try { res.write(payload); } catch { /* client disconnected */ }
  }
}
