import { createRoot } from "react-dom/client";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { CartProvider } from "@/contexts/CartContext";
import App from "./App";
import "./index.css";

setAuthTokenGetter(() => localStorage.getItem("geem_token"));

// Service worker lifecycle management
if ("serviceWorker" in navigator) {
  // When a new SW activates and claims this page, reload once so users see
  // the latest version immediately.  sessionStorage guard prevents an infinite
  // reload loop — module-level booleans reset on every reload but sessionStorage
  // persists for the lifetime of the tab session.
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (sessionStorage.getItem("_sw_reloaded")) return;
    sessionStorage.setItem("_sw_reloaded", "1");
    window.location.reload();
  });

  // On every page load, ask the active SW to check for a newer version.
  // This ensures users receive updates promptly without waiting for the
  // browser's background update interval (which can be up to 24 hours).
  navigator.serviceWorker.ready.then((registration) => {
    registration.update().catch(() => {/* network offline — ignore */});
  });
}

createRoot(document.getElementById("root")!).render(
  <CartProvider>
    <App />
  </CartProvider>
);
