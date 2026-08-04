import { useState, useEffect } from "react";
import { MapPin, X, Navigation } from "lucide-react";

const ASKED_KEY    = "geem_location_asked";
const CITY_KEY     = "geem_location_city";
const ADDRESS_KEY  = "geem_location_address";
const LAT_KEY      = "geem_location_lat";
const LNG_KEY      = "geem_location_lng";

export { CITY_KEY, ADDRESS_KEY };

/** True once the user has either granted / denied / dismissed */
function alreadyAsked(): boolean {
  return !!localStorage.getItem(ASKED_KEY);
}

/**
 * Reverse-geocode using OpenStreetMap Nominatim (free, no key needed).
 * Returns { city, area } matching Pakistani address vocabulary.
 */
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
        state_district?: string; state?: string;
        suburb?: string; neighbourhood?: string; quarter?: string;
        road?: string; residential?: string;
      };
    };
    const a = data.address ?? {};

    const city = a.city || a.town || a.village || a.county || a.state_district || "";

    // Build a human-readable area string (neighbourhood / suburb / road)
    const parts = [a.neighbourhood || a.suburb || a.quarter, a.road || a.residential].filter(Boolean);
    const area = parts.join(", ");

    return { city, area };
  } catch {
    return { city: "", area: "" };
  }
}

/** Save coords + geocoded address to localStorage for Checkout to pick up */
async function saveLocation(lat: number, lng: number) {
  localStorage.setItem(LAT_KEY, String(lat));
  localStorage.setItem(LNG_KEY, String(lng));

  const { city, area } = await reverseGeocode(lat, lng);
  if (city) localStorage.setItem(CITY_KEY, city);
  if (area) localStorage.setItem(ADDRESS_KEY, area);

  // Also send an updated GPS patch to the visitor tracker backend
  const sid = sessionStorage.getItem("geem_sid");
  if (sid) {
    fetch("/api/shop/track-gps", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: sid, lat, lng, accuracy: 0 }),
    }).catch(() => {});
  }
}

export default function LocationPermissionBanner() {
  const [show, setShow]       = useState(false);
  const [loading, setLoading] = useState(false);
  const [granted, setGranted] = useState(false);

  useEffect(() => {
    // Show the banner ~2 seconds after page load — only if not already asked
    if (alreadyAsked()) return;

    // Also skip if permission is already denied (browser returns 'denied')
    if ("permissions" in navigator) {
      navigator.permissions
        .query({ name: "geolocation" as PermissionName })
        .then((result) => {
          if (result.state === "denied") {
            localStorage.setItem(ASKED_KEY, "denied");
            return;
          }
          if (result.state === "granted") {
            // Already granted — silently capture and don't bother them
            localStorage.setItem(ASKED_KEY, "granted");
            navigator.geolocation.getCurrentPosition(
              (pos) => saveLocation(pos.coords.latitude, pos.coords.longitude),
              () => {}
            );
            return;
          }
          // state === 'prompt' — show banner after a short delay
          const t = setTimeout(() => setShow(true), 2500);
          return () => clearTimeout(t);
        })
        .catch(() => {
          const t = setTimeout(() => setShow(true), 2500);
          return () => clearTimeout(t);
        });
    } else {
      const t = setTimeout(() => setShow(true), 2500);
      return () => clearTimeout(t);
    }
  }, []);

  function dismiss() {
    localStorage.setItem(ASKED_KEY, "dismissed");
    setShow(false);
  }

  async function allow() {
    if (!navigator.geolocation) {
      dismiss();
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        localStorage.setItem(ASKED_KEY, "granted");
        await saveLocation(pos.coords.latitude, pos.coords.longitude);
        setLoading(false);
        setGranted(true);
        setTimeout(() => setShow(false), 1800);
      },
      () => {
        // User denied the browser prompt
        localStorage.setItem(ASKED_KEY, "denied");
        setLoading(false);
        setShow(false);
      },
      { timeout: 15000, maximumAge: 0, enableHighAccuracy: false }
    );
  }

  if (!show) return null;

  return (
    <div className="fixed bottom-24 left-4 right-4 sm:left-auto sm:right-24 sm:w-[340px] z-40 animate-in slide-in-from-bottom-4 duration-300">
      <div className="bg-white rounded-2xl shadow-2xl border border-blue-100 overflow-hidden">
        {/* Blue accent bar */}
        <div className="h-1 bg-gradient-to-r from-blue-500 to-indigo-500" />

        <div className="px-4 pt-4 pb-4">
          {granted ? (
            /* Success state */
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                <Navigation className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">Location saved ✅</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Your city will be auto-filled at checkout
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <MapPin className="h-5 w-5 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-800">
                    Auto-fill your delivery address
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    Allow location access so we can automatically detect your city and area at checkout — saving you time when placing an order.
                  </p>
                </div>
                <button
                  onClick={dismiss}
                  className="p-1 rounded-full hover:bg-gray-100 text-muted-foreground flex-shrink-0"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex gap-2 mt-4">
                <button
                  onClick={dismiss}
                  className="flex-1 py-2 rounded-xl border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Not Now
                </button>
                <button
                  onClick={allow}
                  disabled={loading}
                  className="flex-2 flex-grow-[2] py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-70"
                >
                  {loading ? (
                    <>
                      <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      Detecting…
                    </>
                  ) : (
                    <>
                      <MapPin className="h-3.5 w-3.5" />
                      Allow Location
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
