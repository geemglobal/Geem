import { Router, type IRouter } from "express";
import { eq, or } from "drizzle-orm";
import { db, usersTable, integrationSettingsTable } from "@workspace/db";
import { hashPassword, verifyPassword, generateToken, storeToken, revokeToken, getUserIdFromToken } from "../lib/auth";
import { logger } from "../lib/logger";
import { logActivity } from "./activity";
import { sendPasswordReset } from "../lib/mailer";
import { sendSms, sendWhatsApp } from "../lib/sms";
import { generateOtp, storeOtp, verifyOtp, sendOtpViaChannel } from "../lib/otp";
import { verifyRecaptcha } from "../lib/recaptcha";

const router: IRouter = Router();

// In-memory store for password reset tokens (token -> { userId, expires })
const adminResetTokens = new Map<string, { userId: number; expires: number }>();

// Public endpoint: returns the reCAPTCHA v3 site key so the frontend
// doesn't need VITE_RECAPTCHA_SITE_KEY baked in at build time.
router.get("/auth/recaptcha-config", async (_req, res): Promise<void> => {
  try {
    const [row] = await db
      .select()
      .from(integrationSettingsTable)
      .where(eq(integrationSettingsTable.type, "recaptcha"));
    if (row?.enabled && row.config) {
      const cfg = JSON.parse(row.config as string) as Record<string, string>;
      res.json({ enabled: true, siteKey: cfg.siteKey ?? null });
      return;
    }
  } catch { /* no DB row yet — fall through */ }
  res.json({ enabled: false, siteKey: null });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const { email, password, recaptchaToken, latitude, longitude, locationName, browser, os, deviceType } = req.body;
  const ip = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ?? req.socket.remoteAddress ?? null;
  const ua = req.headers["user-agent"] ?? undefined;

  const identifier = (email as string | undefined)?.trim() ?? "";
  if (!identifier || !password) {
    res.status(400).json({ error: "Email/username and password are required" });
    return;
  }

  const captcha = await verifyRecaptcha(recaptchaToken as string | undefined, "admin_login");
  if (!captcha.ok) {
    res.status(400).json({ error: captcha.error ?? "Security check failed" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(
    or(
      eq(usersTable.email, identifier),
      eq(usersTable.username, identifier),
      eq(usersTable.mobile, identifier),
    )
  );
  if (!user || !verifyPassword(password, user.passwordHash)) {
    void logActivity({
      userEmail: identifier, action: "login_failed", details: "Invalid credentials",
      ipAddress: ip ?? undefined, userAgent: ua, status: "failed",
      latitude, longitude, locationName, browser, os, deviceType,
    });
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  if (!user.active) {
    void logActivity({
      userId: user.id, userEmail: user.email, action: "login_failed",
      details: "Account inactive", ipAddress: ip ?? undefined, userAgent: ua, status: "failed",
      latitude, longitude, locationName, browser, os, deviceType,
    });
    res.status(401).json({ error: "Account is inactive" });
    return;
  }

  const token = generateToken();
  await storeToken(token, user.id);
  await db.update(usersTable).set({ lastLogin: new Date() }).where(eq(usersTable.id, user.id));

  void logActivity({
    userId: user.id, userEmail: user.email,
    action: "login", entity: "user", entityId: user.id,
    ipAddress: ip ?? undefined, userAgent: ua,
    latitude, longitude, locationName, browser, os, deviceType,
  });

  res.json({
    token,
    user: {
      id: user.id, name: user.name, username: user.username, email: user.email,
      mobile: user.mobile ?? null,
      role: user.role, active: user.active,
      lastLogin: user.lastLogin?.toISOString() ?? null,
      createdAt: user.createdAt.toISOString(),
    },
  });
});

router.post("/auth/logout", async (req, res): Promise<void> => {
  const auth = req.headers.authorization;
  const ip = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ?? req.socket.remoteAddress ?? null;
  const ua = req.headers["user-agent"] ?? undefined;
  if (auth?.startsWith("Bearer ")) {
    const userId = await getUserIdFromToken(auth.slice(7));
    await revokeToken(auth.slice(7));
    if (userId) {
      void logActivity({ userId, action: "logout", entity: "user", entityId: userId, ipAddress: ip ?? undefined, userAgent: ua });
    }
  }
  res.json({ ok: true });
});

router.get("/auth/me", async (req, res): Promise<void> => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const userId = await getUserIdFromToken(auth.slice(7));
  if (!userId) {
    res.status(401).json({ error: "Invalid token" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json({
    id: user.id, name: user.name, username: user.username, email: user.email,
    mobile: user.mobile ?? null,
    role: user.role, active: user.active,
    lastLogin: user.lastLogin?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
  });
});

// Forgot password — sends a reset link via email
router.post("/auth/forgot-password", async (req, res): Promise<void> => {
  const { identifier, channel } = req.body as Record<string, string>;
  if (!identifier?.trim()) {
    res.status(400).json({ error: "Email, mobile, or username required" });
    return;
  }
  const c = channel as "email" | "sms" | "whatsapp";
  if (!c || !["email","sms","whatsapp"].includes(c)) { res.status(400).json({ error: "Please select a channel: email, sms, or whatsapp" }); return; }

  const id = identifier.trim();
  const idLower = id.toLowerCase();

  const [user] = await db.select().from(usersTable).where(
    or(
      eq(usersTable.email, idLower),
      eq(usersTable.username, idLower),
      eq(usersTable.mobile, id),
    )
  );

  if (!user || !user.active) {
    res.json({ ok: true, sent: false });
    return;
  }

  const otp = generateOtp();
  const key = `rst:${user.id}`;
  storeOtp(key, otp, "admin-reset", { userId: user.id });

  const sendResult = await sendOtpViaChannel({
    channel: c, toEmail: user.email, toMobile: user.mobile, name: user.name, otp, purpose: "admin-reset", expiryMinutes: 15,
  });

  if (!sendResult.ok) {
    req.log.error({ err: sendResult.error, channel: c, userId: user.id }, "Failed to send admin reset OTP");
    res.status(500).json({ error: `Failed to send OTP via ${c}: ${sendResult.error}` });
    return;
  }

  req.log.info({ userId: user.id, sentVia: sendResult.sentVia }, "Admin password reset OTP sent");
  res.json({ ok: true, sent: true, sentVia: sendResult.sentVia });
});

// Step 2: Verify OTP and get a reset token
router.post("/auth/forgot-password/verify", async (req, res): Promise<void> => {
  const { identifier, code } = req.body as Record<string, string>;
  if (!identifier || !code) { res.status(400).json({ error: "Identifier and verification code required" }); return; }

  const id = identifier.trim().toLowerCase();
  const idRaw = identifier.trim();
  const [user] = await db.select().from(usersTable).where(
    or(eq(usersTable.email, id), eq(usersTable.username, id), eq(usersTable.mobile, idRaw))
  );
  if (!user || !user.active) { res.status(400).json({ error: "Account not found or inactive" }); return; }

  const key = `rst:${user.id}`;
  const result = verifyOtp(key, code.trim());
  if (!result.ok) { res.status(400).json({ error: result.error }); return; }

  const token = generateToken();
  adminResetTokens.set(token, { userId: user.id, expires: Date.now() + 5 * 60 * 1000 });

  res.json({ ok: true, resetToken: token });
});

// Reset password using token from forgot-password
router.post("/auth/reset-password", async (req, res): Promise<void> => {
  const { resetToken, newPassword } = req.body as Record<string, string>;
  if (!resetToken || !newPassword) {
    res.status(400).json({ error: "Reset token and new password required" });
    return;
  }
  if (String(newPassword).length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters" });
    return;
  }

  const entry = adminResetTokens.get(resetToken);
  if (!entry || entry.expires < Date.now()) {
    adminResetTokens.delete(resetToken);
    res.status(400).json({ error: "Invalid or expired reset token. Please request a new one." });
    return;
  }

  await db.update(usersTable).set({ passwordHash: hashPassword(String(newPassword)) }).where(eq(usersTable.id, entry.userId));
  adminResetTokens.delete(resetToken);
  res.json({ ok: true });
});

void logger;
export default router;
