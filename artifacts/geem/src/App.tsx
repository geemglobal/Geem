import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { applyPrimaryColor, applyBorderRadius } from "@/lib/theme";
import NotFound from "@/pages/not-found";
import { ShopAuthProvider } from "@/lib/shopAuth";
import { ClerkProvider } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import ShopGoogleCallback from "@/pages/shop/ShopGoogleCallback";

import Login from "./pages/auth/Login";
import { AdminLayout } from "./components/layout/AdminLayout";

import Dashboard from "./pages/admin/Dashboard";
import Inventory from "./pages/admin/Inventory";
import Customers from "./pages/admin/Customers";
import Invoices from "./pages/admin/Invoices";
import InvoiceDetail from "./pages/admin/InvoiceDetail";
import NewInvoice from "./pages/admin/NewInvoice";
import POS from "./pages/admin/POS";
import Products from "./pages/admin/Products";
import WebOrders from "./pages/admin/WebOrders";
import Quotations from "./pages/admin/Quotations";
import QuotationDetail from "./pages/admin/QuotationDetail";
import NewQuotation from "./pages/admin/NewQuotation";
import Procurement from "./pages/admin/Procurement";
import Shipments from "./pages/admin/Shipments";
import ServiceTickets from "./pages/admin/ServiceTickets";
import Chat from "./pages/admin/Chat";
import Vault from "./pages/admin/Vault";
import Reports from "./pages/admin/Reports";
import Settings from "./pages/admin/Settings";
import MasterData from "./pages/admin/MasterData";
import SystemMaintenance from "./pages/admin/SystemMaintenance";
import Visitors from "./pages/admin/Visitors";
import ImeiManagement from "./pages/admin/ImeiManagement";
import ActivityLog from "./pages/admin/ActivityLog";
import Expenses from "./pages/admin/Expenses";
import CustomerLedger from "./pages/admin/CustomerLedger";
import CustomerDetail from "./pages/admin/CustomerDetail";
import WalletManagement from "./pages/admin/WalletManagement";
import Notifications from "./pages/admin/Notifications";

import ShopHome from "./pages/shop/ShopHome";
import ShopNotifications from "./pages/shop/ShopNotifications";
import ShopProducts from "./pages/shop/ShopProducts";
import ShopProduct from "./pages/shop/ShopProduct";
import ShopCategory from "./pages/shop/ShopCategory";
import TrackOrder from "./pages/shop/TrackOrder";
import Cart from "./pages/shop/Cart";
import Checkout from "./pages/shop/Checkout";
import OrderConfirmed from "./pages/shop/OrderConfirmed";
import About from "./pages/shop/About";
import Contact from "./pages/shop/Contact";
import FAQ from "./pages/shop/FAQ";
import PrivacyPolicy from "./pages/shop/PrivacyPolicy";
import Terms from "./pages/shop/Terms";
import Returns from "./pages/shop/Returns";
import Shipping from "./pages/shop/Shipping";
import MyAccount from "./pages/shop/MyAccount";
import ShopSignIn from "./pages/shop/ShopSignIn";
import ShopSignUp from "./pages/shop/ShopSignUp";
import ShopForgotPassword from "./pages/shop/ShopForgotPassword";
import ShopResetPassword from "./pages/shop/ShopResetPassword";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function HomeRoute() {
  const [, setLocation] = useLocation();
  const host = window.location.hostname;
  const isAdmin = host === "erp.geem.pk" || host === "crm.geem.pk"
    || host.startsWith("erp.") || host.startsWith("crm.");
  useEffect(() => {
    if (isAdmin) setLocation("/login");
  }, [isAdmin, setLocation]);
  if (isAdmin) return null;
  return <ShopHome />;
}

function A({ component: C }: { component: React.ComponentType }) {
  return <AdminLayout><C /></AdminLayout>;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />

      {/* Shop auth routes */}
      <Route path="/shop/sign-in" component={ShopSignIn} />
      <Route path="/shop/sign-up" component={ShopSignUp} />
      <Route path="/shop/sso-callback" component={ShopGoogleCallback} />
      <Route path="/shop/forgot-password" component={ShopForgotPassword} />
      <Route path="/shop/reset-password" component={ShopResetPassword} />

      {/* Shop routes */}
      <Route path="/" component={HomeRoute} />
      <Route path="/shop" component={ShopHome} />
      <Route path="/shop/products" component={ShopProducts} />
      <Route path="/shop/products/:slug" component={ShopProduct} />
      <Route path="/shop/category/:id" component={ShopCategory} />
      <Route path="/shop/track" component={TrackOrder} />
      <Route path="/shop/cart" component={Cart} />
      <Route path="/shop/checkout" component={Checkout} />
      <Route path="/shop/order-confirmed" component={OrderConfirmed} />
      <Route path="/shop/about" component={About} />
      <Route path="/shop/contact" component={Contact} />
      <Route path="/shop/faq" component={FAQ} />
      <Route path="/shop/privacy" component={PrivacyPolicy} />
      <Route path="/shop/terms" component={Terms} />
      <Route path="/shop/returns" component={Returns} />
      <Route path="/shop/shipping" component={Shipping} />
      <Route path="/shop/account" component={MyAccount} />
      <Route path="/shop/notifications" component={ShopNotifications} />

      {/* Admin routes — explicit, flat */}
      <Route path="/dashboard"><A component={Dashboard} /></Route>
      <Route path="/inventory"><A component={Inventory} /></Route>
      <Route path="/customers"><A component={Customers} /></Route>
      <Route path="/wallet"><A component={WalletManagement} /></Route>
      <Route path="/customers/:id"><A component={CustomerDetail} /></Route>
      <Route path="/invoices/new"><A component={NewInvoice} /></Route>
      <Route path="/invoices/:id/edit"><A component={NewInvoice} /></Route>
      <Route path="/invoices/:id"><A component={InvoiceDetail} /></Route>
      <Route path="/invoices"><A component={Invoices} /></Route>
      <Route path="/pos"><A component={POS} /></Route>
      <Route path="/products"><A component={Products} /></Route>
      <Route path="/shop-orders"><A component={WebOrders} /></Route>
      <Route path="/quotations/new"><A component={NewQuotation} /></Route>
      <Route path="/quotations/:id/edit"><A component={NewQuotation} /></Route>
      <Route path="/quotations/:id"><A component={QuotationDetail} /></Route>
      <Route path="/quotations"><A component={Quotations} /></Route>
      <Route path="/procurement"><A component={Procurement} /></Route>
      <Route path="/shipments"><A component={Shipments} /></Route>
      <Route path="/service-tickets"><A component={ServiceTickets} /></Route>
      <Route path="/chat"><A component={Chat} /></Route>
      <Route path="/vault"><A component={Vault} /></Route>
      <Route path="/reports"><A component={Reports} /></Route>
      <Route path="/settings"><A component={Settings} /></Route>
      <Route path="/master-data"><A component={MasterData} /></Route>
      <Route path="/system"><A component={SystemMaintenance} /></Route>
      <Route path="/visitors"><A component={Visitors} /></Route>
      <Route path="/imei-management"><A component={ImeiManagement} /></Route>
      <Route path="/activity-log"><A component={ActivityLog} /></Route>
      <Route path="/expenses"><A component={Expenses} /></Route>
      <Route path="/customers/:id/ledger"><A component={CustomerLedger} /></Route>
      <Route path="/notifications"><A component={Notifications} /></Route>

      <Route component={NotFound} />
    </Switch>
  );
}

// Google sign-in for the customer shop only (external Clerk account, proxied
// through this app's own domain — see /api/__clerk on the backend). Never used
// on the staff/admin (erp.geem.pk) side, which stays password-only.
const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY in .env file");
}
// Same-origin proxy path exposed by the API server's clerkProxyMiddleware.
// This is a VPS deployment (not a Replit-managed deployment), so there is no
// auto-injected VITE_CLERK_PROXY_URL — compute it from the current origin instead.
const clerkProxyUrl = `${window.location.origin}/api/__clerk`;

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || "/" : path;
}

function ClerkAwareShopAuth({ children }: { children: React.ReactNode }) {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      signInUrl={`${basePath}/shop/sign-in`}
      signUpUrl={`${basePath}/shop/sign-up`}
      routerPush={to => setLocation(stripBase(to))}
      routerReplace={to => setLocation(stripBase(to), { replace: true })}
    >
      <ShopAuthProvider>{children}</ShopAuthProvider>
    </ClerkProvider>
  );
}

function App() {
  useEffect(() => {
    fetch("/api/shop/seo-config")
      .then(r => r.json())
      .then(({ gaId, scVerification, favicon, companyName, primaryColor, borderRadius }: {
        gaId: string | null; scVerification: string | null; favicon: string | null;
        companyName: string; primaryColor?: string; borderRadius?: string;
      }) => {
        if (primaryColor) applyPrimaryColor(primaryColor);
        if (borderRadius) applyBorderRadius(borderRadius);
        if (gaId) {
          const s = document.createElement("script");
          s.async = true;
          s.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
          document.head.appendChild(s);
          const i = document.createElement("script");
          i.textContent = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${gaId}');`;
          document.head.appendChild(i);
        }
        if (scVerification) {
          const m = document.querySelector('meta[name="google-site-verification"]') ?? document.createElement("meta");
          (m as HTMLMetaElement).name = "google-site-verification";
          (m as HTMLMetaElement).content = scVerification;
          if (!m.parentNode) document.head.appendChild(m);
        }
        if (favicon) {
          const link: HTMLLinkElement = document.querySelector("link[rel~='icon']") ?? document.createElement("link");
          link.rel = "icon";
          link.href = favicon;
          if (!link.parentNode) document.head.appendChild(link);
        }
        if (companyName && document.title === "Geem") document.title = companyName;
      })
      .catch(() => {});
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={basePath}>
          <ClerkAwareShopAuth>
            <Router />
          </ClerkAwareShopAuth>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
