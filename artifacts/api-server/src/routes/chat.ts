import { Router } from "express";
import { eq, desc, and, asc, count as sqlCount } from "drizzle-orm";
import { db, chatSessionsTable, chatMessagesTable, usersTable } from "@workspace/db";
import { addListener, removeListener, broadcast, addGlobalListener, removeGlobalListener } from "../lib/chat-events";
import { sendPushToAdmins } from "../lib/push";
import { logger } from "../lib/logger";
import crypto from "node:crypto";
import { getUserIdFromToken } from "../lib/auth";

const router = Router();

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Admin = valid Bearer token in our sessions table */
async function isAdminAuth(req: any): Promise<boolean> {
  const auth = (req.headers.authorization as string | undefined) ?? "";
  if (!auth.startsWith("Bearer ")) return false;
  try {
    const userId = await getUserIdFromToken(auth.slice(7));
    return !!userId;
  } catch {
    return false;
  }
}

function sessionKeyMatch(session: any, key: string | undefined): boolean {
  return !!key && !!session.sessionKey && session.sessionKey === key;
}

/** Extract session key from header or body */
function getSessionKey(req: any): string | undefined {
  return (req.headers["x-session-key"] as string | undefined) ?? req.body?.sessionKey;
}

/** Customer session key always wins over admin token — prevents admin cookies leaking into shop */
async function getSenderRole(req: any, session: any): Promise<"customer" | "agent" | null> {
  const headerKey = req.headers["x-session-key"] as string | undefined;
  const bodyKey = req.body?.sessionKey as string | undefined;
  const key = headerKey ?? bodyKey;
  const hasBearer = !!(req.headers.authorization as string | undefined)?.startsWith("Bearer ");

  // Debug log — remove once stable
  logger.info({
    sessionId: session.id,
    sessionKeyDb: session.sessionKey,
    headerKey,
    bodyKey,
    key,
    hasBearer,
    match: sessionKeyMatch(session, key),
  }, "getSenderRole debug");

  if (sessionKeyMatch(session, key)) return "customer";
  if (await isAdminAuth(req)) return "agent";
  return null;
}

async function autoAssignStaff(): Promise<number | null> {
  try {
    const staff = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.active, true));
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

function makeTicketNumber() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `TKT-${ts}-${rand}`;
}

const HUMAN_KEYWORDS = [
  /\bhuman\b/i, /\bagent\b/i, /\bstaff\b/i, /\breal person\b/i,
  /\boperator\b/i, /\bsupport team\b/i, /\btalk to someone\b/i,
  /\bconnect me\b/i, /\blive chat\b/i, /\bspeak to\b/i,
  /\binsaan\b/i, /\bbanda\b/i, /\badmi\b/i,
];

function wantsHuman(text: string): boolean {
  return HUMAN_KEYWORDS.some(re => re.test(text));
}

// ─── Gemini AI reply ──────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a friendly and helpful customer support assistant for Geem — a Pakistani tech shop specialising in GPS trackers, mobile accessories, surveillance cameras, and smart security products.

Your goal: resolve customer queries quickly, warmly, and professionally in the same language the customer uses (Urdu, English, or Roman Urdu).

If the customer asks to speak with a human, or if you genuinely cannot help (complex orders, refunds, technical faults requiring hands-on support), reply with exactly this token on the very first line: [TRANSFER]
Then add a short, warm message explaining a human agent will be with them shortly.

Keep replies concise (2-4 sentences). Use emojis sparingly but warmly 😊.`;

async function callGemini(contents: { role: string; parts: { text: string }[] }[]): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-goog-api-key": apiKey },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents,
        generationConfig: { maxOutputTokens: 400, temperature: 0.7 },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${err.slice(0, 200)}`);
  }

  const data = await res.json() as any;
  return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
}

async function generateAiReply(session: typeof chatSessionsTable.$inferSelect): Promise<void> {
  try {
    logger.info({ sessionId: session.id }, "AI reply: starting");

    const history = await db
      .select()
      .from(chatMessagesTable)
      .where(eq(chatMessagesTable.sessionId, session.id))
      .orderBy(asc(chatMessagesTable.createdAt))
      .limit(20);

    const contents = history
      .filter(m => m.role !== "system")
      .map(m => ({
        role: m.role === "agent" ? "model" : "user",
        parts: [{ text: m.messageType === "text" ? m.content : `[${m.messageType} message]` }],
      }));

    const aiText = await callGemini(contents);
    logger.info({ sessionId: session.id, aiText: aiText.slice(0, 80) }, "AI reply: received");

    const shouldTransfer = aiText.startsWith("[TRANSFER]");
    const displayText = shouldTransfer ? aiText.replace("[TRANSFER]", "").trim() : aiText;

    if (shouldTransfer) {
      await db.update(chatSessionsTable).set({ aiMode: false, updatedAt: new Date() }).where(eq(chatSessionsTable.id, session.id));

      const [sysMsg] = await db.insert(chatMessagesTable).values({
        sessionId: session.id, role: "system", messageType: "text",
        content: "🧑‍💼 Connecting you to a live agent. Please wait a moment…",
      }).returning();
      broadcast(session.id, "message", sysMsg);

      // Dedicated SSE event so admin panel can react instantly
      broadcast(session.id, "human_requested", { sessionId: session.id, customerName: session.customerName });

      await sendPushToAdmins({
        title: "🔔 Human Agent Requested",
        body: `${session.customerName || "A customer"} wants to speak with a human agent.`,
        url: "/erp/chat",
        tag: `chat-transfer-${session.id}`,
        requireInteraction: true,
      }).catch(() => {});
    }

    if (displayText) {
      const [aiMsg] = await db.insert(chatMessagesTable).values({
        sessionId: session.id, role: "agent", messageType: "text", content: displayText,
      }).returning();

      const preview = displayText.slice(0, 100);
      await db.update(chatSessionsTable)
        .set({ lastMessage: preview, updatedAt: new Date() })
        .where(eq(chatSessionsTable.id, session.id));

      broadcast(session.id, "message", aiMsg);
      broadcast(session.id, "session_updated", { id: session.id, lastMessage: preview });
    }
  } catch (err) {
    logger.error({ err, sessionId: session.id }, "AI reply failed");
  }
}

// ─── create / resume session ──────────────────────────────────────────────────
router.post("/chat/sessions", async (req, res): Promise<void> => {
  const { name, mobile, email, sessionKey: existingKey } = req.body;

  if (existingKey) {
    const [existing] = await db.select().from(chatSessionsTable).where(eq(chatSessionsTable.sessionKey, existingKey));
    if (existing) {
      // If closed/resolved, clear and fall through to create a new session
      if (existing.status === "closed" || existing.status === "resolved") {
        res.json({ session: null, sessionKey: null, expired: true });
        return;
      }
      res.json({ session: existing, sessionKey: existing.sessionKey });
      return;
    }
  }

  const assignedStaffId = await autoAssignStaff();
  const key = crypto.randomUUID();

  const [session] = await db.insert(chatSessionsTable).values({
    sessionKey: key,
    customerName: name || null,
    customerEmail: email || null,
    customerMobile: mobile || null,
    assignedStaffId,
    aiMode: true,
    status: "open",
    unreadCount: 0,
  }).returning();

  const greeting = name
    ? `Hi ${name}! 👋 Welcome to Geem. I'm your virtual assistant — ask me anything about our GPS trackers, cameras, or accessories. How can I help you today?`
    : `Hi there! 👋 Welcome to Geem. I'm your virtual assistant — ask me anything about our GPS trackers, cameras, or accessories. How can I help?`;

  await db.insert(chatMessagesTable).values({ sessionId: session.id, role: "agent", messageType: "text", content: greeting });

  await sendPushToAdmins({
    title: "New Chat Session",
    body: `${name || "A customer"} started a chat${mobile ? ` (${mobile})` : ""}`,
    url: "/admin/chat",
    tag: `chat-session-${session.id}`,
  }).catch(() => {});

  res.json({ session, sessionKey: key });
});

// ─── list sessions (admin only) ───────────────────────────────────────────────
router.get("/chat/sessions", async (req, res): Promise<void> => {
  if (!await isAdminAuth(req)) { res.status(401).json({ error: "Unauthorized" }); return; }

  const rows = await db.select({
    id: chatSessionsTable.id,
    customerName: chatSessionsTable.customerName,
    customerMobile: chatSessionsTable.customerMobile,
    assignedStaffId: chatSessionsTable.assignedStaffId,
    status: chatSessionsTable.status,
    aiMode: chatSessionsTable.aiMode,
    unreadCount: chatSessionsTable.unreadCount,
    lastMessage: chatSessionsTable.lastMessage,
    ticketNumber: chatSessionsTable.ticketNumber,
    createdAt: chatSessionsTable.createdAt,
    updatedAt: chatSessionsTable.updatedAt,
    staffName: usersTable.name,
  }).from(chatSessionsTable)
    .leftJoin(usersTable, eq(chatSessionsTable.assignedStaffId, usersTable.id))
    .orderBy(desc(chatSessionsTable.updatedAt));

  res.json(rows);
});

// ─── get messages ─────────────────────────────────────────────────────────────
router.get("/chat/sessions/:id/messages", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const key = getSessionKey(req) ?? req.query.sessionKey as string | undefined;

  const [session] = await db.select().from(chatSessionsTable).where(eq(chatSessionsTable.id, id));
  if (!session) { res.status(404).json({ error: "Not found" }); return; }

  const admin = await isAdminAuth(req);
  if (!admin && !sessionKeyMatch(session, key)) { res.status(403).json({ error: "Forbidden" }); return; }

  const messages = await db.select().from(chatMessagesTable)
    .where(eq(chatMessagesTable.sessionId, id))
    .orderBy(asc(chatMessagesTable.createdAt));

  if (admin && session.unreadCount > 0) {
    await db.update(chatSessionsTable).set({ unreadCount: 0 }).where(eq(chatSessionsTable.id, id));
    broadcast(id, "session_updated", { id, unreadCount: 0 });
  }

  res.json(messages);
});

// ─── send message ─────────────────────────────────────────────────────────────
router.post("/chat/sessions/:id/messages", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);

  const [session] = await db.select().from(chatSessionsTable).where(eq(chatSessionsTable.id, id));
  if (!session) { res.status(404).json({ error: "Not found" }); return; }

  const senderRole = await getSenderRole(req, session);
  if (!senderRole) { res.status(403).json({ error: "Forbidden" }); return; }

  const admin = senderRole === "agent";
  const { content = "", messageType = "text", fileUrl, fileName } = req.body;

  // Detect human transfer request from customer
  let sessionAiMode = session.aiMode;
  if (!admin && messageType === "text" && wantsHuman(content)) {
    sessionAiMode = false;
    await db.update(chatSessionsTable).set({ aiMode: false, updatedAt: new Date() }).where(eq(chatSessionsTable.id, id));
  }

  const [msg] = await db.insert(chatMessagesTable).values({
    sessionId: id, role: senderRole, messageType,
    content, fileUrl: fileUrl || null, fileName: fileName || null,
  }).returning();

  const preview =
    messageType === "voice" ? "🎤 Voice message" :
    messageType === "image" ? "🖼️ Image" :
    messageType === "file"  ? `📎 ${fileName || "File"}` :
    content.slice(0, 100);

  const newUnread = admin ? session.unreadCount : session.unreadCount + 1;
  await db.update(chatSessionsTable)
    .set({ lastMessage: preview, unreadCount: newUnread, updatedAt: new Date() })
    .where(eq(chatSessionsTable.id, id));

  broadcast(id, "message", msg);
  broadcast(id, "session_updated", { id, lastMessage: preview, unreadCount: newUnread });

  if (!admin) {
    await sendPushToAdmins({
      title: session.customerName ? `${session.customerName} – Chat` : "New Message",
      body: preview, url: "/admin/chat",
      tag: `chat-msg-${id}`, requireInteraction: true,
    }).catch(() => {});
  }

  res.status(201).json(msg);

  // Trigger AI reply asynchronously — only for customer text messages in AI mode
  if (!admin && messageType === "text" && sessionAiMode) {
    const freshSession = { ...session, aiMode: sessionAiMode };
    setImmediate(() => generateAiReply(freshSession).catch(err => logger.error({ err }, "AI reply setImmediate error")));
  }
});

// ─── Global admin SSE (all sessions) ─────────────────────────────────────────
router.get("/chat/admin/events", async (req, res): Promise<void> => {
  // EventSource can't set headers — accept token as query param too
  const queryToken = req.query.token as string | undefined;
  const isAdmin = await isAdminAuth(req) ||
    (queryToken ? !!(await getUserIdFromToken(queryToken).catch(() => null)) : false);
  if (!isAdmin) { res.status(401).end(); return; }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const hb = setInterval(() => { try { res.write(": heartbeat\n\n"); } catch { clearInterval(hb); } }, 25000);
  addGlobalListener(res);
  req.on("close", () => { clearInterval(hb); removeGlobalListener(res); });
});

// ─── SSE stream ───────────────────────────────────────────────────────────────
router.get("/chat/sessions/:id/events", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const key = getSessionKey(req) ?? req.query.sessionKey as string | undefined;

  const [session] = await db.select().from(chatSessionsTable).where(eq(chatSessionsTable.id, id));
  if (!session) { res.status(404).end(); return; }

  const admin = await isAdminAuth(req);
  if (!admin && !sessionKeyMatch(session, key)) { res.status(403).end(); return; }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const hb = setInterval(() => { try { res.write(": heartbeat\n\n"); } catch { clearInterval(hb); } }, 25000);
  addListener(id, res);
  req.on("close", () => { clearInterval(hb); removeListener(id, res); });
});

// ─── update session (admin only) ─────────────────────────────────────────────
router.patch("/chat/sessions/:id", async (req, res): Promise<void> => {
  if (!await isAdminAuth(req)) { res.status(401).json({ error: "Unauthorized" }); return; }
  const id = parseInt(req.params.id);
  const { status, assignedStaffId, aiMode } = req.body;

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (status !== undefined) patch.status = status;
  if (assignedStaffId !== undefined) patch.assignedStaffId = assignedStaffId;
  if (aiMode !== undefined) patch.aiMode = aiMode;

  const [session] = await db.update(chatSessionsTable).set(patch).where(eq(chatSessionsTable.id, id)).returning();

  if (status === "resolved" || status === "closed") {
    const note = status === "resolved" ? "✅ Session marked as resolved." : "🔒 Session closed.";
    await db.insert(chatMessagesTable).values({ sessionId: id, role: "system", messageType: "text", content: note });
  }

  broadcast(id, "session_updated", session);
  res.json(session);
});

// ─── create ticket ────────────────────────────────────────────────────────────
router.post("/chat/sessions/:id/ticket", async (req, res): Promise<void> => {
  if (!await isAdminAuth(req)) { res.status(401).json({ error: "Unauthorized" }); return; }
  const id = parseInt(req.params.id);
  const [session] = await db.select().from(chatSessionsTable).where(eq(chatSessionsTable.id, id));
  if (!session) { res.status(404).json({ error: "Not found" }); return; }
  if (session.ticketNumber) { res.json({ ticketNumber: session.ticketNumber }); return; }

  const tktNum = makeTicketNumber();
  const [updated] = await db.update(chatSessionsTable)
    .set({ ticketNumber: tktNum, updatedAt: new Date() })
    .where(eq(chatSessionsTable.id, id)).returning();

  await db.insert(chatMessagesTable).values({
    sessionId: id, role: "system", messageType: "text",
    content: `🎫 Support ticket created: **${tktNum}**. Our team will follow up shortly.`,
  });

  broadcast(id, "session_updated", updated);
  res.json({ ticketNumber: tktNum });
});

// ─── list staff ───────────────────────────────────────────────────────────────
router.get("/chat/staff", async (req, res): Promise<void> => {
  if (!await isAdminAuth(req)) { res.status(401).json({ error: "Unauthorized" }); return; }
  const staff = await db.select({ id: usersTable.id, name: usersTable.name, role: usersTable.role })
    .from(usersTable).where(eq(usersTable.active, true));
  res.json(staff);
});

export default router;
