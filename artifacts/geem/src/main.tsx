import { createRoot } from "react-dom/client";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { CartProvider } from "@/contexts/CartContext";
import App from "./App";
import "./index.css";

setAuthTokenGetter(() => localStorage.getItem("geem_token"));

createRoot(document.getElementById("root")!).render(
  <CartProvider>
    <App />
  </CartProvider>
);
