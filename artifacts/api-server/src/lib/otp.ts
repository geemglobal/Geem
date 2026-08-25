import { sendEmail } from "./mailer";
import { sendSms, sendWhatsApp } from "./sms";

type OtpPurpose = "shop-register" | "shop-reset" | "admin-reset" | "admin-create";

interface OtpEntry {
  code: string;
  expiresAt: number;
  metadata: Record<string, unknown>;
  purpose: OtpPurpose;
}

const otpStore = new Map<string, OtpEntry>();

const OTP_TTL_MS = 15 * 60 * 1000; // 15 minutes

export function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function storeOtp(
  key: string,
  code: string,
  purpose: OtpPurpose,
  metadata: Record<string, unknown>,
): void {
  otpStore.set(key, { code, expiresAt: Date.now() + OTP_TTL_MS, metadata, purpose });
  setTimeout(() => {
    const e = otpStore.get(key);
    if (e && Date.now() > e.expiresAt) otpStore.delete(key);
  }, OTP_TTL_MS + 1000);
}

export function verifyOtp(key: string, code: string): { ok: boolean; metadata?: Record<string, unknown>; error?: string } {
  const entry = otpStore.get(key);
  if (!entry) return { ok: false, error: "OTP not found or expired" };
  if (Date.now() > entry.expiresAt) {
    otpStore.delete(key);
    return { ok: false, error: "OTP has expired. Please request a new one." };
  }
  if (entry.code !== code) return { ok: false, error: "Invalid OTP. Please try again." };
  otpStore.delete(key);
  return { ok: true, metadata: entry.metadata };
}

export async function sendOtpViaChannel(opts: {
  channel: "email" | "sms" | "whatsapp";
  toEmail?: string | null;
  toMobile?: string | null;
  name: string;
  otp: string;
  purpose: string;
  expiryMinutes?: number;
}): Promise<{ ok: boolean; sentVia: string; error?: string }> {
  const { channel, toEmail, toMobile, name, otp, purpose, expiryMinutes = 15 } = opts;
  const label =
    purpose === "shop-register" ? "Verify your Geem account" :
    purpose === "admin-create" ? "Activate your Geem account" :
    "Reset your Geem password";
  const actionText =
    purpose === "shop-register" ? "verify your new account" :
    purpose === "admin-create" ? "activate your new account" :
    "reset your password";
  const smsLabel =
    purpose === "shop-register" ? "Account verification code" :
    purpose === "admin-create" ? "Account activation code" :
    "Password reset code";
  const waLabel =
    purpose === "shop-register" ? "Account Verification" :
    purpose === "admin-create" ? "Account Activation" :
    "Password Reset";

  if (channel === "email" && toEmail) {
    try {
      const sent = await sendEmail({
        to: toEmail,
        subject: label,
        html: `<!DOCTYPE html>
<html><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#1e293b;padding:20px">
  <div style="max-width:480px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
    <div style="background:#0f172a;padding:24px;text-align:center"><img src="https://crm.geem.pk/geem-logo.svg" alt="Geem" style="height:40px"></div>
    <div style="padding:32px">
      <h2 style="margin-top:0">${label}</h2>
      <p>Hi ${name},</p>
      <p>Use the verification code below to ${actionText}:</p>
      <div style="text-align:center;padding:24px 0"><span style="font-size:32px;font-weight:700;letter-spacing:6px;color:#0f172a;background:#f1f5f9;padding:12px 24px;border-radius:8px">${otp}</span></div>
      <p style="color:#64748b;font-size:13px">This code expires in ${expiryMinutes} minutes. If you didn't request this, please ignore this email.</p>
    </div>
    <div style="background:#f8fafc;padding:16px 32px;font-size:12px;color:#94a3b8">
      Geem Global Services Pvt Ltd &middot; Office #1, Yellow Building, Kutchery Rd, Ahmadpur East, Pakistan
    </div>
  </div>
</body></html>`,
        text: `${label}\n\nHi ${name},\n\nYour verification code: ${otp}\nThis code expires in ${expiryMinutes} minutes.\n\nIf you didn't request this, please ignore it.`,
      });
      if (!sent) {
        return { ok: false, sentVia: "email", error: "Email gateway returned false. Check email integration settings." };
      }
      return { ok: true, sentVia: "email" };
    } catch (err) {
      return { ok: false, sentVia: "email", error: String(err) };
    }
  }

  if (channel === "sms" && toMobile) {
    const body = `Geem - ${smsLabel}: ${otp}. Expires in ${expiryMinutes} min. Do not share this with anyone.`;
    const ok = await sendSms(toMobile, body);
    return ok ? { ok: true, sentVia: "sms" } : { ok: false, sentVia: "sms", error: "SMS gateway failed" };
  }

  if (channel === "whatsapp" && toMobile) {
    const body = `*Geem - ${waLabel}*\n\nHi ${name}, your code is: *${otp}*\nExpires in ${expiryMinutes} minutes.\nIf you didn't request this, please ignore it.`;
    const ok = await sendWhatsApp(toMobile, body);
    return ok ? { ok: true, sentVia: "whatsapp" } : { ok: false, sentVia: "whatsapp", error: "WhatsApp gateway failed" };
  }

  return { ok: false, sentVia: channel, error: "Channel not available or missing contact info" };
}
