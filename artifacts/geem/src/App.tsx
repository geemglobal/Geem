import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { applyPrimaryColor, applyBorderRadius } from "@/lib/theme";
import { ShopAuthProvider } from "@/lib/shopAuth";
import { ClerkProvider } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";

// ─── Eager — critical first-paint components ─────────────────────────────────
import NotFound from "@/pages/not-found";
import Login from "./pages/auth/Login";
import ShopHome from "./pages/shop/ShopHome";
import ShopGoogleCallback from "./pages/shop/ShopGoogleCallback";
import { AdminLayout } from "./components/layout/AdminLayout";

// ─── Lazy-loaded admin pages ─────────────────────────────────────────────────
// Each import creates a separate code-split chunk loaded on demand.
const Dashboard         = lazy(() => import("./pages/admin/Dashboard"));
const Inventory         = lazy(() => import("./pages/admin/Inventory"));
const Customers         = lazy(() => import("./pages/admin/Customers"));
const Invoices          = lazy(() => import("./pages/admin/Invoices"));
const InvoiceDetail     = lazy(() => import("./pages/admin/InvoiceDetail"));
const NewInvoice        = lazy(() => import("./pages/admin/NewInvoice"));
const POS               = lazy(() => import("./pages/admin/POS"));
const Products          = lazy(() => import("./pages/admin/Products"));
const WebOrders         = lazy(() => import("./pages/admin/WebOrders"));
const Quotations        = lazy(() => import("./pages/admin/Quotations"));
const QuotationDetail   = lazy(() => import("./pages/admin/QuotationDetail"));
const NewQuotation      = lazy(() => import("./pages/admin/NewQuotation"));
const Procurement       = lazy(() => import("./pages/admin/Procurement"));
const Shipments         = lazy(() => import("./pages/admin/Shipments"));
const ServiceTickets    = lazy(() => import("./pages/admin/ServiceTickets"));
const Chat              = lazy(() => import("./pages/admin/Chat"));
const Vault             = lazy(() => import("./pages/admin/Vault"));
const Reports           = lazy(() => import("./pages/admin/Reports"));
const Settings          = lazy(() => import("./pages/admin/Settings"));
const MasterData        = lazy(() => import("./pages/admin/MasterData"));
const SystemMaintenance = lazy(() => import("./pages/admin/SystemMaintenance"));
const Visitors          = lazy(() => import("./pages/admin/Visitors"));
const ImeiManagement    = lazy(() => import("./pages/admin/ImeiManagement"));
const ActivityLog       = lazy(() => import("./pages/admin/ActivityLog"));
const Expenses          = lazy(() => import("./pages/admin/Expenses"));
const CustomerLedger    = lazy(() => import("./pages/admin/CustomerLedger"));
const CustomerDetail    = lazy(() => import("./pages/admin/CustomerDetail"));
const WalletManagement  = lazy(() => import("./pages/admin/WalletManagement"));
const Notifications     = lazy(() => import("./pages/admin/Notifications"));

// ─── Lazy-loaded shop pages ──────────────────────────────────────────────────
const ShopNotifications  = lazy(() => import("./pages/shop/ShopNotifications"));
const ShopProducts       = lazy(() => import("./pages/shop/ShopProducts"));
const ShopProduct        = lazy(() => import("./pages/shop/ShopProduct"));
const ShopCategory       = lazy(() => import("./pages/shop/ShopCategory"));
const TrackOrder         = lazy(() => import("./pages/shop/TrackOrder"));
const Cart               = lazy(() => import("./pages/shop/Cart"));
const Checkout           = lazy(() => import("./pages/shop/Checkout"));
const OrderConfirmed     = lazy(() => import("./pages/shop/OrderConfirmed"));
const About              = lazy(() => import("./pages/shop/About"));
const Contact            = lazy(() => import("./pages/shop/Contact"));
const FAQ                = lazy(() => import("./pages/shop/FAQ"));
const PrivacyPolicy      = lazy(() => import("./pages/shop/PrivacyPolicy"));
const Terms              = lazy(() => import("./pages/shop/Terms"));
const Returns            = lazy(() => import("./pages/shop/Returns"));
const Shipping           = lazy(() => import("./pages/shop/Shipping"));
const MyAccount          = lazy(() => import("./pages/shop/MyAccount"));
const ShopSignIn         = lazy(() => import("./pages/shop/ShopSignIn"));
const ShopSignUp         = lazy(() => import("./pages/shop/ShopSignUp"));
const ShopForgotPassword = lazy(() => import("./pages/shop/ShopForgotPassword"));
const ShopResetPassword  = lazy(() => import("./pages/shop/ShopResetPassword"));

// ─────────────────────────────────────────────────────────────────────────────

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

/** Wraps a lazy admin page in the shared sidebar layout. */
function A({ component: C }: { component: React.ElementType }) {
  return <AdminLayout><C /></AdminLayout>;
}

/** Shown while a lazy chunk is downloading (replaces blank white flash). */
function PageLoader() {
  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh" }}>
      <div style={{
        width:40, height:40,
        border:"3px solid #e5e7eb",
        borderTop:"3px solid #EC2029",
        borderRadius:"50%",
        animation:"geem-spin 0.8s linear infinite",
      }} />
      <style>{`@keyframes geem-spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

function Router() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        <Route path="/login" component={Login} />

        {/* Shop auth routes */}
        <Route path="/shop/sign-in" component={ShopSignIn as React.ComponentType} />
        <Route path="/shop/sign-up" component={ShopSignUp as React.ComponentType} />
        <Route path="/shop/sso-callback" component={ShopGoogleCallback} />
        <Route path="/shop/forgot-password" component={ShopForgotPassword as React.ComponentType} />
        <Route path="/shop/reset-password" component={ShopResetPassword as React.ComponentType} />

        {/* Shop routes */}
        <Route path="/" component={HomeRoute} />
        <Route path="/shop" component={ShopHome} />
        <Route path="/shop/products" component={ShopProducts as React.ComponentType} />
        <Route path="/shop/products/:slug" component={ShopProduct as React.ComponentType} />
        <Route path="/shop/category/:id" component={ShopCategory as React.ComponentType} />
        <Route path="/shop/track" component={TrackOrder as React.ComponentType} />
        <Route path="/shop/cart" component={Cart as React.ComponentType} />
        <Route path="/shop/checkout" component={Checkout as React.ComponentType} />
        <Route path="/shop/order-confirmed" component={OrderConfirmed as React.ComponentType} />
        <Route path="/shop/about" component={About as React.ComponentType} />
        <Route path="/shop/contact" component={Contact as React.ComponentType} />
        <Route path="/shop/faq" component={FAQ as React.ComponentType} />
        <Route path="/shop/privacy" component={PrivacyPolicy as React.ComponentType} />
        <Route path="/shop/terms" component={Terms as React.ComponentType} />
        <Route path="/shop/returns" component={Returns as React.ComponentType} />
        <Route path="/shop/shipping" component={Shipping as React.ComponentType} />
        <Route path="/shop/account" component={MyAccount as React.ComponentType} />
        <Route path="/shop/notifications" component={ShopNotifications as React.ComponentType} />

        {/* Admin routes */}
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
    </Suspense>
  );
}

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY in .env file");
}
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
