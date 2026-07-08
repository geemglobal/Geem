// Pakistan/Karachi timezone date/time helpers

/**
 * Normalize any Pakistani phone number to WhatsApp international format (no +).
 * Handles: 03001234567, 3001234567, 923001234567, +923001234567
 * Always returns digits only, starting with 92.
 */
export function toWaPhone(mobile: string | null | undefined): string {
  if (!mobile) return "";
  const digits = mobile.replace(/\D/g, "");
  if (digits.startsWith("92") && digits.length >= 12) return digits; // already international
  if (digits.startsWith("0") && digits.length === 11) return "92" + digits.slice(1); // 03xx…
  if (digits.length === 10) return "92" + digits; // 3xx… without leading 0
  return digits; // unknown format — pass through
}

export const PAK_TIMEZONE = "Asia/Karachi";

/** Format a date string or Date in Pakistan timezone. */
export function formatPakDate(
  date: string | Date | null | undefined,
  opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short", year: "numeric" },
): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-PK", { ...opts, timeZone: PAK_TIMEZONE }).format(d);
}

/** Format a date+time in Pakistan timezone. */
export function formatPakDateTime(
  date: string | Date | null | undefined,
  opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" },
): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-PK", { ...opts, timeZone: PAK_TIMEZONE }).format(d);
}

/** Format just time in Pakistan timezone. */
export function formatPakTime(
  date: string | Date | null | undefined,
  opts: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" },
): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-PK", { ...opts, timeZone: PAK_TIMEZONE }).format(d);
}
