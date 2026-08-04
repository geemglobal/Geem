import { useEffect } from "react";

export const CITY_KEY    = "geem_location_city";
export const ADDRESS_KEY = "geem_location_address";

const ASKED_KEY = "geem_location_asked";

async function reverseGeocode(lat: number, lng: number): Promise<{ city: string; area: string }> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
      { headers: { "Accept-Language": "en" } }
    );
    if (!res.ok) return { city: "", area: "" };
    const data = await res.json() as {
      address?: {
        city?: string; town?: string; village?: string; county?: string;
        state_district?: string;
        suburb?: string; neighbourhood?: string; quarter?: string;
        road?: string; residential?: string;
      };
    };
    const a = data.address ?? {};
    const city = a.city || a.town || a.village || a.county || a.state_district || "";
    const parts = [a.neighbourhood || a.suburb || a.quarter, a.road || a.residential].filter(Boolean);
    return { city, area: parts.join(", ") };
  } catch {
    return { city: "", area: "" };
  }
}

async function saveLocation(lat: number, lng: number) {
  const { city, area } = await reverseGeocode(lat, lng);
  if (city) localStorage.setItem(CITY_KEY, city);
  if (area) localStorage.setItem(ADDRESS_KEY, area);

  // Forward to tracker backend
  const sid = sessionStorage.getItem("geem_sid");
  if (sid) {
    fetch("/api/shop/track-gps", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: sid, lat, lng, accuracy: 0 }),
    }).catch(() => {});
  }
}

/**
 * Silently requests location on page load — triggers the browser's own
 * one-click "Allow / Block" dialog with no custom pre-prompt in the way.
 * Only runs once per browser (tracked in localStorage).
 */
export default function LocationPermissionBanner() {
  useEffect(() => {
    if (!navigator.geolocation) return;
    if (localStorage.getItem(ASKED_KEY)) return;

    const request = () => {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          localStorage.setItem(ASKED_KEY, "granted");
          await saveLocation(pos.coords.latitude, pos.coords.longitude);
        },
        () => {
          localStorage.setItem(ASKED_KEY, "denied");
        },
        { timeout: 15000, maximumAge: 0, enableHighAccuracy: false }
      );
    };

    // Small delay so the page finishes painting before the browser dialog pops
    const t = setTimeout(request, 1500);
    return () => clearTimeout(t);
  }, []);

  // No UI — the browser's native dialog is the only prompt
  return null;
}
