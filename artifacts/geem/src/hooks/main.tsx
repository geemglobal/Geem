import { createRoot } from "react-dom/client";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { CartProvider } from "@/contexts/CartContext";
import App from "./App";
import "./index.css";

setAuthTokenGetter(() => localStorage.getItem("geem_token"));

// When a new service worker activates and claims this page, reload once so
// users see the latest version.  Use sessionStorage (survives page reloads
// within the same tab session) as the guard — the old module-level boolean
// reset to false on every reload, allowing an infinite reload chain when the
// push SW and the Vite SW raced at the same scope.
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (sessionStorage.getItem("_sw_reloaded")) return;
    sessionStorage.setItem("_sw_reloaded", "1");
    window.location.reload();
  });
}

createRoot(document.getElementById("root")!).render(
  <CartProvider>
    <App />
  </CartProvider>
);
