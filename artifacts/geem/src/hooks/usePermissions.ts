import { useState, useEffect } from "react";

const ASKED_KEY = "pwa_permissions_asked";

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    !!(window.navigator as { standalone?: boolean }).standalone
  );
}

export function usePermissions() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!isStandalone()) return;
    if (localStorage.getItem(ASKED_KEY)) return;
    setShow(true);
  }, []);

  async function allowAll() {
    localStorage.setItem(ASKED_KEY, "1");
    setShow(false);
    if ("Notification" in window) {
      try { await Notification.requestPermission(); } catch { /* ignore */ }
    }
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(() => {}, () => {});
    }
  }

  function dismiss() {
    localStorage.setItem(ASKED_KEY, "1");
    setShow(false);
  }

  return { show, allowAll, dismiss };
}
