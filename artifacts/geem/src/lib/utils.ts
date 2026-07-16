import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function isIccid(imei: string | null | undefined): boolean {
  return !!imei && imei.startsWith("89") && imei.length > 15;
}

export function imeiLabel(imei: string | null | undefined): string {
  return isIccid(imei) ? "ICCID" : "IMEI";
}
