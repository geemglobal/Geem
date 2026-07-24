import { Router } from "express";
import { eq, desc, and, asc, count as sqlCount } from "drizzle-orm";
import { db, chatSessionsTable, chatMessagesTable, usersTable, pushSubscriptionsTable } from "@workspace/db";
import { addListener, removeListener, broadcast } from "../lib/chat-events";
import { sendPushToAdmins } from "../lib/push";
import { logger } from "../lib/logger";
import crypto from "node:crypto";

const router = Router();

// ─── helpers ──────────────────────────────────────────────────────────────────

function isAdminAuth(req: any) {
  return !!req.session?.userId;
}

function sessionKeyMatch(session: any, key: string | undefined) {
  return !!key && session.sessionKey === key;
}

async function autoAssignStaff(): Promise<number | null> {
  // Pick active staff member with fewest open sessions
  try {
    const staff = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.active, true));
    if (!staff.length) return null;

    const counts = await Promise.all(
      staff.map(async (s) => {
        const [{ c }] = await db
          .select({ c: sqlCount() })
          .from(chatSessionsTable)
          .where(and(eq(chatSessionsTable.assignedStaffId, s.id), eq(chatSessionsTable.status, "open")));
        return { id: s.id, count: Number(c) };
      })
    );
    counts.sort((a, b) => a.count - b.count);
    return counts[0]?.id ?? null;
  } catch {
    return null;
  }
}

function ticketNumber() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `TKT-${ts}-${rand}`;
}

// ─── create session (shop, no auth needed) ────────────────────────────────────
router.post("/chat/sessions", async (req, res): Promise<void> => {
  const { name, mobile, email, sessionKey: existingKey } = req.body;

  // Resume existing session by key
  if (existingKey) {
    const [existing] = await db
      .select()
      .from(chatSessionsTable)
      .where(eq(chatSessionsTable.sessionKey, existingKey));
    if (existing) {
      res.json({ session: existing, sessionKey: existing.sessionKey });
      return;
    }
  }

  const assignedStaffId = await autoAssignStaff();
  const key = crypto.randomUUID();

  const [session] = await db
    .insert(chatSessionsTable)
    .values({
      sessionKey: key,
      customerName: name || null,
      customerEmail: email || null,
      customerMobile: mobile || null,
      assignedStaffId,
      status: "open",
      unreadCount: 0,
    })
    .returning();

  // System welcome message
  await db.insert(chatMessagesTable).values({
    sessionId: session.id,
    role: "system",
    messageType: "text",
    content: `Welcome${name ? `, ${name}` : ""}! 👋 How can we help you today?`,
  });

  // Notify admins of new session
  await sendPushToAdmins({
    title: "New Chat",
    body: `${name || "A customer"} started a chat${mobile ? ` (${mobile})` : ""}`,
    url: "/admin/chat",
    tag: `chat-session-${session.id}`,
  }).catch(() => {});

  res.json({ session, sessionKey: key });
});

// ─── list sessions (admin only) ───────────────────────────────────────────────
router.get("/chat/sessions", async (req, res): Promise<void> => {
  if (!isAdminAuth(req)) { res.status(401).json({ error: "Unauthorized" }); return; }

  const rows = await db
    .select({
      id: chatSessionsTable.id,
      customerName: chatSessionsTable.customerName,
      customerMobile: chatSessionsTable.customerMobile,
      assignedStaffId: chatSessionsTable.assignedStaffId,
      status: chatSessionsTable.status,
      unreadCount: chatSessionsTable.unreadCount,
      lastMessage: chatSessionsTable.lastMessage,
      ticketNumber: chatSessionsTable.ticketNumber,
      createdAt: chatSessionsTable.createdAt,
      updatedAt: chatSessionsTable.updatedAt,
      staffName: usersTable.name,
    })
    .from(chatSessionsTable)
    .leftJoin(usersTable, eq(chatSessionsTable.assignedStaffId, usersTable.id))
    .orderBy(desc(chatSessionsTable.updatedAt));

  res.json(rows);
});

// ─── get messages ─────────────────────────────────────────────────────────────
router.get("/chat/sessions/:id/messages", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const key = req.headers["x-session-key"] as string | undefined ?? req.query.sessionKey as string | undefined;

  const [session] = await db.select().from(chatSessionsTable).where(eq(chatSessionsTable.id, id));
  if (!session) { res.status(404).json({ error: "Not found" }); return; }
  if (!isAdminAuth(req) && !sessionKeyMatch(session, key)) { res.status(403).json({ error: "Forbidden" }); return; }

  const messages = await db
    .select()
    .from(chatMessagesTable)
    .where(eq(chatMessagesTable.sessionId, id))
    .orderBy(asc(chatMessagesTable.createdAt));

  // Mark customer messages as read (for admin)
  if (isAdminAuth(req) && session.unreadCount > 0) {
    await db.update(chatSessionsTable).set({ unreadCount: 0 }).where(eq(chatSessionsTable.id, id));
    broadcast(id, "session_updated", { id, unreadCount: 0 });
  }

  res.json(messages);
});

// ─── send message ─────────────────────────────────────────────────────────────
router.post("/chat/sessions/:id/messages", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const key = req.headers["x-session-key"] as string | undefined ?? req.body.sessionKey;

  const [session] = await db.select().from(chatSessionsTable).where(eq(chatSessionsTable.id, id));
  if (!session) { res.status(404).json({ error: "Not found" }); return; }

  const admin = isAdminAuth(req);
  if (!admin && !sessionKeyMatch(session, key)) { res.status(403).json({ error: "Forbidden" }); return; }

  const { content = "", messageType = "text", fileUrl, fileName } = req.body;
  const role = admin ? "agent" : "customer";

  const [msg] = await db
    .insert(chatMessagesTable)
    .values({ sessionId: id, role, messageType, content, fileUrl: fileUrl || null, fileName: fileName || null })
    .returning();

  // Update session metadata
  const preview =
    messageType === "voice" ? "🎤 Voice message" :
    messageType === "image" ? "🖼️ Image" :
    messageType === "file"  ? `📎 ${fileName || "File"}` :
    content.slice(0, 100);

  const newUnread = admin ? session.unreadCount : session.unreadCount + 1;
  await db
    .update(chatSessionsTable)
    .set({ lastMessage: preview, unreadCount: newUnread, updatedAt: new Date() })
    .where(eq(chatSessionsTable.id, id));

  // SSE broadcast to this session's listeners
  broadcast(id, "message", msg);
  broadcast(id, "session_updated", { id, lastMessage: preview, unreadCount: newUnread });

  // Push notifications
  if (!admin) {
    await sendPushToAdmins({
      title: session.customerName ? `${session.customerName} – Chat` : "New Message",
      body: preview,
      url: "/admin/chat",
      tag: `chat-msg-${id}`,
      requireInteraction: true,
    }).catch(() => {});
  }

  res.json(msg);
});

// ─── SSE stream for a session ─────────────────────────────────────────────────
router.get("/chat/sessions/:id/events", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const key = req.headers["x-session-key"] as string | undefined ?? req.query.sessionKey as string | undefined;

  const [session] = await db.select().from(chatSessionsTable).where(eq(chatSessionsTable.id, id));
  if (!session) { res.status(404).end(); return; }
  if (!isAdminAuth(req) && !sessionKeyMatch(session, key)) { res.status(403).end(); return; }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // disable nginx buffering
  res.flushHeaders();

  // Heartbeat every 25s to keep connection alive
  const hb = setInterval(() => { try { res.write(": heartbeat\n\n"); } catch { clearInterval(hb); } }, 25000);

  addListener(id, res);

  req.on("close", () => {
    clearInterval(hb);
    removeListener(id, res);
  });
});

// ─── update session (admin only) ─────────────────────────────────────────────
router.patch("/chat/sessions/:id", async (req, res): Promise<void> => {
  if (!isAdminAuth(req)) { res.status(401).json({ error: "Unauthorized" }); return; }
  const id = parseInt(req.params.id);
  const { status, assignedStaffId } = req.body;

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (status !== undefined) patch.status = status;
  if (assignedStaffId !== undefined) patch.assignedStaffId = assignedStaffId;

  const [session] = await db.update(chatSessionsTable).set(patch).where(eq(chatSessionsTable.id, id)).returning();

  if (status === "resolved" || status === "closed") {
    const note = status === "resolved" ? "✅ Session marked as resolved." : "🔒 Session closed.";
    await db.insert(chatMessagesTable).values({ sessionId: id, role: "system", messageType: "text", content: note });
  }

  broadcast(id, "session_updated", session);
  res.json(session);
});

// ─── create support ticket from session ───────────────────────────────────────
router.post("/chat/sessions/:id/ticket", async (req, res): Promise<void> => {
  if (!isAdminAuth(req)) { res.status(401).json({ error: "Unauthorized" }); return; }
  const id = parseInt(req.params.id);
  const [session] = await db.select().from(chatSessionsTable).where(eq(chatSessionsTable.id, id));
  if (!session) { res.status(404).json({ error: "Not found" }); return; }
  if (session.ticketNumber) { res.json({ ticketNumber: session.ticketNumber }); return; }

  const tktNum = ticketNumber();
  const [updated] = await db
    .update(chatSessionsTable)
    .set({ ticketNumber: tktNum, updatedAt: new Date() })
    .where(eq(chatSessionsTable.id, id))
    .returning();

  await db.insert(chatMessagesTable).values({
    sessionId: id,
    role: "system",
    messageType: "text",
    content: `🎫 Support ticket created: **${tktNum}**. Our team will follow up shortly.`,
  });

  broadcast(id, "session_updated", updated);
  res.json({ ticketNumber: tktNum });
});

// ─── list staff for assignment dropdown ───────────────────────────────────────
router.get("/chat/staff", async (req, res): Promise<void> => {
  if (!isAdminAuth(req)) { res.status(401).json({ error: "Unauthorized" }); return; }
  const staff = await db
    .select({ id: usersTable.id, name: usersTable.name, role: usersTable.role })
    .from(usersTable)
    .where(eq(usersTable.active, true));
  res.json(staff);
});

export default router;
