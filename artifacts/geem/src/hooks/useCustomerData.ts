import { useState, useEffect } from "react";
import { useShopAuth } from "@/lib/shopAuth";
import { PAKISTAN_CITIES } from "@/data/pakistan-cities";

// localStorage keys written by LocationPermissionBanner
const CITY_KEY    = "geem_location_city";
const ADDRESS_KEY = "geem_location_address";

export interface CustomerData {
  name:    string;
  email:   string;
  mobile:  string;
  city:    string;
  address: string;
  loaded:  boolean;
}

/** Fuzzy-match a geocoded city string (e.g. "Karachi City") to our city list */
export function matchCity(raw: string): string {
  if (!raw) return "";
  const n = raw.toLowerCase().trim();
  return (
    PAKISTAN_CITIES.find(c => c.toLowerCase() === n) ??
    PAKISTAN_CITIES.find(c => n.includes(c.toLowerCase()) || c.toLowerCase().includes(n)) ??
    ""
  );
}

/**
 * Returns the best available customer data from all sources, in priority order:
 *   1. Authenticated profile  (server)
 *   2. Last order             (server)
 *   3. Chat-widget intro form (localStorage)
 *   4. Browser geolocation    (localStorage)
 *
 * Works for both logged-in customers and guests.
 */
export function useCustomerData(): CustomerData {
  const { customer, getToken } = useShopAuth();
  const [data, setData] = useState<CustomerData>({
    name: "", email: "", mobile: "", city: "", address: "", loaded: false,
  });

  useEffect(() => {
    // Layer 3 & 4 — always available immediately from localStorage
    const chatName   = localStorage.getItem("geem_chat_name")   ?? "";
    const chatMobile = localStorage.getItem("geem_chat_mobile") ?? "";
    const locCity    = matchCity(localStorage.getItem(CITY_KEY)    ?? "");
    const locAddress = localStorage.getItem(ADDRESS_KEY) ?? "";

    const token = getToken();
    if (!token) {
      // Guest user — only localStorage data available
      setData({
        name:    chatName,
        email:   "",
        mobile:  chatMobile,
        city:    locCity,
        address: locAddress,
        loaded:  true,
      });
      return;
    }

    // Authenticated — fetch profile + last order, then merge with localStorage fallbacks
    const hdrs = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

    interface Profile  { name?: string; email?: string; mobile?: string; city?: string; address?: string; }
    interface PastOrder { customerName?: string; customerEmail?: string; customerMobile?: string; customerCity?: string; customerAddress?: string; }

    Promise.all([
      fetch("/api/shop/auth/profile", { headers: hdrs })
        .then(r => r.ok ? (r.json() as Promise<Profile>)  : null).catch(() => null),
      fetch("/api/shop/auth/orders",  { headers: hdrs })
        .then(r => r.ok ? (r.json() as Promise<PastOrder[]>) : []).catch(() => [] as PastOrder[]),
    ]).then(([profile, orders]) => {
      const last = (orders as PastOrder[])[0];
      setData({
        name:    profile?.name    || last?.customerName    || chatName   || "",
        email:   profile?.email   || last?.customerEmail   || "",
        mobile:  profile?.mobile  || last?.customerMobile  || chatMobile || "",
        city:    profile?.city    || last?.customerCity    || locCity    || "",
        address: profile?.address || last?.customerAddress || locAddress || "",
        loaded:  true,
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer?.id]);   // re-run whenever login state changes

  return data;
}
