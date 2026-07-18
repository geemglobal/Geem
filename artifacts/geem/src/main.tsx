import { createRoot } from "react-dom/client";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { CartProvider } from "@/contexts/CartContext";
import App from "./App";
import "./index.css";

setAuthTokenGetter(() => localStorage.getItem("geem_token"));

// When a new service worker activates and claims this page, reload immediately
// so users always see the latest version without having to close and reopen.
if ("serviceWorker" in navigator) {
  let _reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (_reloading) return;
    _reloading = true;
    window.location.reload();
  });
}

createRoot(document.getElementById("root")!).render(
  <CartProvider>
    <App />
  </CartProvider>
);
