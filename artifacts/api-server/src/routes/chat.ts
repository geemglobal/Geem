import { Router } from "express";
import { eq, desc, and, asc, count as sqlCount } from "drizzle-orm";
import { db, chatSessionsTable, chatMessagesTable, usersTable, pushSubscriptionsTable } from "@workspace/db";
import { addListener, removeListener, broadcast } from "../lib/chat-events";
import { sendPushToAdmins } from "../lib/push";
import { logger } from "../lib/logger";
import crypto from "node:crypto";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

// ─── helpers ──────────────────────────────────────────────────────────────────

function isAdminAuth(req: any) {
  return !!req.session?.userId;
}

function sessionKeyMatch(session: any, key: string | undefined) {
  return !!key && session.sessionKey === key;
}

async function autoAssignStaff(): Promise<number | null> {
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

// Keywords that signal a customer wants to talk to a human
const HUMAN_KEYWORDS = [
  /\bhuman\b/i, /\bagent\b/i, /\bstaff\b/i, /\breal person\b/i,
  /\boperator\b/i, /\bsupport team\b/i, /\btalk to someone\b/i,
  /\bconnect me\b/i, /\blive chat\b/i, /\bspeak to\b/i,
];

function wantsHuman(text: string): boolean {
  return HUMAN_KEYWORDS.some(re => re.test(text));
}

// ─── AI reply (fires after customer message if aiMode=true) ──────────────────

async function generateAiReply(session: typeof chatSessionsTable.$inferSelect): Promise<void> {
  try {
    // Fetch recent conversation history (last 20 msgs)
    const history = await db
      .select()
      .from(chatMessagesTable)
      .where(eq(chatMessagesTable.sessionId, session.id))
      .orderBy(asc(chatMessagesTable.createdAt))
      .limit(20);

    const chatHistory = history
      .filter(m => m.role !== "system")
      .map(m => ({
        role: (m.role === "agent" ? "assistant" : "user") as "assistant" | "user",
        content: m.messageType === "text" ? m.content : `[${m.messageType} message]`,
      }));

    const systemPrompt = `You are a friendly and helpful customer support assistant for Geem — a Pakistani tech shop specialising in GPS trackers, mobile accessories, surveillance cameras, and smart security products.

Your goal: resolve customer queries quickly, warmly, and professionally in the same language the customer uses (Urdu, English, or Roman Urdu).

If the customer asks to speak with a human, or if you genuinely cannot help (complex orders, refunds, technical faults requiring hands-on support), reply with exactly this token on the very first line: [TRANSFER]
Then add a short, warm message explaining a human agent will be with them shortly.

Keep replies concise (2-4 sentences). Use emojis sparingly but warmly 😊.`;

    const response = await openai.chat.completions.create({
      model: "gpt-5.6-luna",
      max_completion_tokens: 400,
      messages: [
        { role: "system", content: systemPrompt },
        ...chatHistory,
      ],
    });

    const aiText = response.choices[0]?.message?.content?.trim() ?? "";
    const shouldTransfer = aiText.startsWith("[TRANSFER]");
    const displayText = shouldTransfer
      ? aiText.replace("[TRANSFER]", "").trim()
      : aiText;

    if (shouldTransfer) {
      // Switch session to human mode
      await db
        .update(chatSessionsTable)
        .set({ aiMode: false, updatedAt: new Date() })
        .where(eq(chatSessionsTable.id, session.id));

      // System message to customer
      const sysMsg = await db
        .insert(chatMessagesTable)
        .values({
          sessionId: session.id,
          role: "system",
          messageType: "text",
          content: "🧑‍💼 Connecting you to a live agent. Please wait a moment…",
        })
        .returning();
      broadcast(session.id, "message", sysMsg[0]);

      // Notify admins
      await sendPushToAdmins({
        title: "🔔 Human Agent Requested",
        body: `${session.customerName || "A customer"} wants to speak with a human agent.`,
        url: "/admin/chat",
        tag: `chat-transfer-${session.id}`,
        requireInteraction: true,
      }).catch(() => {});
    }

    // Save AI reply
    if (displayText) {
      const [aiMsg] = await db
        .insert(chatMessagesTable)
        .values({
          sessionId: session.id,
          role: "agent",
          messageType: "text",
          content: displayText,
        })
        .returning();

      const preview = displayText.slice(0, 100);
      await db
        .update(chatSessionsTable)
        .set({ lastMessage: preview, updatedAt: new Date() })
        .where(eq(chatSessionsTable.id, session.id));

      broadcast(session.id, "message", aiMsg);
      broadcast(session.id, "session_updated", { id: session.id, lastMessage: preview, aiMode: shouldTransfer ? false : true });
    }
  } catch (err) {
    logger.error("AI reply failed:", err);
    // Silently fall back — admin will still see the message
  }
}

// ─── create session (shop, no auth needed) ────────────────────────────────────
router.post("/chat/sessions", async (req, res): Promise<void> => {
  const { name, mobile, email, sessionKey: existingKey } = req.body;

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
      aiMode: true,
      status: "open",
      unreadCount: 0,
    })
    .returning();

  // Warm welcome from AI persona
  const greeting = name
    ? `Hi ${name}! 👋 Welcome to Geem. I'm your virtual assistant — ask me anything about our GPS trackers, cameras, or accessories. How can I help you today?`
    : `Hi there! 👋 Welcome to Geem. I'm your virtual assistant — ask me anything about our GPS trackers, cameras, or accessories. How can I help?`;

  await db.insert(chatMessagesTable).values({
    sessionId: session.id,
    role: "agent",
    messageType: "text",
    content: greeting,
  });

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
  if (!isAdminAuth(req)) { res.status(401).json({ error: "Unauthorized" }); return; }

  const rows = await db
    .select({
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

  // A valid sessionKey always means "customer" — even if an admin cookie is also present.
  // This prevents shared session cookies from making shop customers appear as admins.
  const isCustomer = sessionKeyMatch(session, key);
  const admin = !isCustomer && isAdminAuth(req);
  if (!isCustomer && !admin) { res.status(403).json({ error: "Forbidden" }); return; }

  const { content = "", messageType = "text", fileUrl, fileName } = req.body;
  const role = admin ? "agent" : "customer";

  // If customer explicitly asks for human, switch aiMode off immediately
  let sessionAiMode = session.aiMode;
  if (!admin && messageType === "text" && wantsHuman(content)) {
    sessionAiMode = false;
    await db.update(chatSessionsTable).set({ aiMode: false, updatedAt: new Date() }).where(eq(chatSessionsTable.id, id));
  }

  const [msg] = await db
    .insert(chatMessagesTable)
    .values({ sessionId: id, role, messageType, content, fileUrl: fileUrl || null, fileName: fileName || null })
    .returning();

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

  broadcast(id, "message", msg);
  broadcast(id, "session_updated", { id, lastMessage: preview, unreadCount: newUnread });

  // Push to admins for customer messages
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

  // After responding to customer — trigger AI reply asynchronously (don't block HTTP response)
  if (!admin && messageType === "text" && sessionAiMode) {
    const freshSession = { ...session, aiMode: sessionAiMode };
    setImmediate(() => generateAiReply(freshSession));
  }
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
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const hb = setInterval(() => { try { res.write(": heartbeat\n\n"); } catch { clearInterval(hb); } }, 25000);
  addListener(id, res);
  req.on("close", () => { clearInterval(hb); removeListener(id, res); });
});

// ─── update session (admin only) ─────────────────────────────────────────────
router.patch("/chat/sessions/:id", async (req, res): Promise<void> => {
  if (!isAdminAuth(req)) { res.status(401).json({ error: "Unauthorized" }); return; }
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
