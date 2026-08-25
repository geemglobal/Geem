export const GEEM_WA = "923078680005";

export interface WAOpenDetail { phone: string; text?: string; }

export function openWhatsApp(phone: string, text?: string): void {
  window.dispatchEvent(new CustomEvent<WAOpenDetail>("wa:open", { detail: { phone, text } }));
}
