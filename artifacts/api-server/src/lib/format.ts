// Pakistan/Karachi timezone date/time helpers

/**
 * Normalize any Pakistani phone number to WhatsApp international format (digits only, no +).
 * Handles: 03001234567, 3001234567, 923001234567, +923001234567
 */
export function toWaPhone(mobile: string | null | undefined): string {
  if (!mobile) return "";
  const digits = mobile.replace(/\D/g, "");
  if (digits.startsWith("92") && digits.length >= 12) return digits;
  if (digits.startsWith("0") && digits.length === 11) return "92" + digits.slice(1);
  if (digits.length === 10) return "92" + digits;
  return digits;
}

export const PAK_TIMEZONE = "Asia/Karachi";

/** Get today's date in Pakistan timezone as YYYY-MM-DD. */
export function pakToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: PAK_TIMEZONE });
}

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
