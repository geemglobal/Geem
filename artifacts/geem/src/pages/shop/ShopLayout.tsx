import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { ShoppingCart, Menu, X, ChevronDown, Shield, Radio, Lock, Camera, MapPin, Eye, Wifi, User, LogIn, MessageCircle, Phone, Search, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCart } from "@/contexts/CartContext";
import { ShopTracker } from "@/components/ShopTracker";
import { useShopAuth } from "@/lib/shopAuth";
import { openWhatsApp, GEEM_WA } from "@/lib/whatsapp";
import { useQuery } from "@tanstack/react-query";
import { axiosInstance } from "@/lib/axios";
import { markShopNotifsRead } from "./ShopNotifications";
import { AppSetupPrompt } from "@/components/AppSetupPrompt";
import { WhatsAppChooser } from "@/components/WhatsAppChooser";

const CATEGORIES = [
  { href: "/shop/products?category=Security+Equipment",     label: "Security Equipment",       icon: Shield },
  { href: "/shop/products?category=Signal+%26+RF+Detectors", label: "Signal & RF Detectors",  icon: Radio },
  { href: "/shop/products?category=Smart+Security+Systems",  label: "Smart Security Systems",  icon: Lock },
  { href: "/shop/products?category=Spy+Cameras",             label: "Spy Cameras & Surveillance", icon: Camera },
  { href: "/shop/products?category=GPS+Trackers",            label: "GPS Trackers — Personal", icon: MapPin },
  { href: "/shop/products?category=Counter-Surveillance",    label: "Counter-Surveillance",    icon: Eye },
  { href: "/shop/products?category=Covert+Communications",   label: "Covert Communications",   icon: Wifi },
];

const FOOTER_LINKS = {
  "Products": [
    { href: "/shop/products", label: "All Products" },
    { href: "/shop/products?category=Security+Equipment", label: "Security Equipment" },
    { href: "/shop/products?category=Spy+Cameras", label: "Spy Cameras & Surveillance" },
    { href: "/shop/products?category=GPS+Trackers", label: "GPS Trackers" },
    { href: "/shop/products?category=Signal+%26+RF+Detectors", label: "Signal & RF Detectors" },
  ],
  "Customer Service": [
    { href: "/shop/about", label: "About Us" },
    { href: "/shop/contact", label: "Contact Us" },
    { href: "/shop/faq", label: "FAQ" },
    { href: "/shop/track", label: "Track Order" },
    { href: "/shop/account", label: "My Orders" },
  ],
  "Policies": [
    { href: "/shop/shipping", label: "Shipping Policy" },
    { href: "/shop/returns", label: "Returns & Refunds" },
    { href: "/shop/privacy", label: "Privacy Policy" },
    { href: "/shop/terms", label: "Terms & Conditions" },
  ],
};

interface ShopBranding { companyName: string; logo: string | null; favicon: string | null; banner: string | null; }
let cachedBranding: ShopBranding | null = null;

export function ShopLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLFormElement>(null);
  const { count } = useCart();
  const [location, setLocation] = useLocation();
  const [branding, setBranding] = useState<ShopBranding>(cachedBranding ?? { companyName: "Geem", logo: null, favicon: null, banner: null });
  const { customer, getToken } = useShopAuth();

  const authHeader = () => { const t = getToken(); return t ? { Authorization: `Bearer ${t}` } : {}; };

  interface ShopNotifItem { id: string; createdAt: string; }
  const { data: shopNotifs = [] } = useQuery<ShopNotifItem[]>({
    queryKey: ["shop-notifs-bell", customer?.id],
    queryFn: () => axiosInstance.get<ShopNotifItem[]>("/shop/auth/notifications", { headers: authHeader() }).then(r => r.data),
    enabled: !!customer,
    staleTime: 30_000,
    refetchInterval: 60_000,
    select: (d) => d,
  });
  // Track last-read timestamp to force re-render of bell count
  const [lastReadTs, setLastReadTs] = useState(parseInt(localStorage.getItem("shop_notif_last_read") ?? "0", 10));
  useEffect(() => {
    const handler = (e: StorageEvent) => { if (e.key === "shop_notif_last_read") setLastReadTs(parseInt(e.newValue ?? "0", 10)); };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);
  const shopBellCount = customer
    ? shopNotifs.filter(n => new Date(n.createdAt).getTime() > lastReadTs).length
    : 0;

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = searchQ.trim();
    if (q) { setLocation(`/shop/products?search=${encodeURIComponent(q)}`); setSearchOpen(false); setSearchQ(""); }
  }

  useEffect(() => { window.scrollTo({ top: 0, behavior: "instant" }); }, [location]);

  useEffect(() => {
    if (cachedBranding) return;
    fetch("/api/shop/seo-config").then(r => r.json()).then((d: ShopBranding & Record<string, unknown>) => {
      const b: ShopBranding = { companyName: d.companyName ?? "Geem", logo: d.logo ?? null, favicon: d.favicon ?? null, banner: (d.banner as string | null) ?? null };
      cachedBranding = b; setBranding(b);
    }).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <ShopTracker />

      {/* ── Top contact bar ─────────────────────────────────────────── */}
      <div className="bg-gray-900 text-gray-300 text-xs py-1.5 px-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-1">
          <span className="hidden sm:block">🇵🇰 Pakistan's specialist supplier of professional-grade security & surveillance equipment</span>
          <div className="flex items-center gap-4">
            <a href="tel:+923078680005" className="flex items-center gap-1 hover:text-white transition-colors">
              <Phone className="h-3 w-3" />
              <span>+92 307-8680005</span>
            </a>
            <a href="#" onClick={(e) => { e.preventDefault(); openWhatsApp(GEEM_WA); }}
              className="flex items-center gap-1 text-green-400 hover:text-green-300 font-medium transition-colors">
              <MessageCircle className="h-3 w-3" />
              <span>WhatsApp: 0307-8680005</span>
            </a>
          </div>
        </div>
      </div>

      {/* ── Sticky nav header ────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between gap-4">
          {/* Logo (small, sticky only) */}
          <Link href="/shop">
            <img src={branding.logo ?? "/geem-logo-banner.svg"} alt={branding.companyName} className="h-8 w-auto cursor-pointer" />
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1 text-sm font-medium">
            <Link href="/shop">
              <span className={`px-3 py-1.5 rounded-full transition-all duration-150 cursor-pointer select-none
                ${location === "/shop"
                  ? "bg-primary/10 text-primary font-semibold"
                  : "text-foreground hover:bg-primary/8 hover:text-primary"}`}>
                Home
              </span>
            </Link>

            {/* Categories dropdown */}
            <div className="relative" onMouseEnter={() => setCatOpen(true)} onMouseLeave={() => setCatOpen(false)}>
              <button className={`flex items-center gap-1 px-3 py-1.5 rounded-full transition-all duration-150 select-none
                ${catOpen ? "bg-primary/10 text-primary" : "text-foreground hover:bg-primary/8 hover:text-primary"}`}>
                Categories <ChevronDown className="h-3.5 w-3.5" />
              </button>
              {catOpen && (
                <div className="absolute top-full left-0 mt-1 w-64 bg-white border rounded-xl shadow-xl py-2 z-50">
                  {CATEGORIES.map(c => (
                    <Link key={c.href} href={c.href}>
                      <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-primary/5 hover:text-primary transition-colors cursor-pointer" onClick={() => setCatOpen(false)}>
                        <c.icon className="h-4 w-4 text-primary flex-shrink-0" />
                        <span className="text-sm">{c.label}</span>
                      </div>
                    </Link>
                  ))}
                  <div className="border-t mt-1 pt-1">
                    <Link href="/shop/products">
                      <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-primary/5 text-primary font-medium cursor-pointer" onClick={() => setCatOpen(false)}>
                        View All Products →
                      </div>
                    </Link>
                  </div>
                </div>
              )}
            </div>

            <Link href="/shop/products">
              <span className={`px-3 py-1.5 rounded-full transition-all duration-150 cursor-pointer select-none
                ${location.startsWith("/shop/products")
                  ? "bg-primary/10 text-primary font-semibold"
                  : "text-foreground hover:bg-primary/8 hover:text-primary"}`}>
                All Products
              </span>
            </Link>
            <Link href="/shop/about">
              <span className={`px-3 py-1.5 rounded-full transition-all duration-150 cursor-pointer select-none
                ${location === "/shop/about"
                  ? "bg-primary/10 text-primary font-semibold"
                  : "text-foreground hover:bg-primary/8 hover:text-primary"}`}>
                About
              </span>
            </Link>
            <Link href="/shop/contact">
              <span className={`px-3 py-1.5 rounded-full transition-all duration-150 cursor-pointer select-none
                ${location === "/shop/contact"
                  ? "bg-primary/10 text-primary font-semibold"
                  : "text-foreground hover:bg-primary/8 hover:text-primary"}`}>
                Contact
              </span>
            </Link>
          </nav>

          {/* ── Navbar search bar ── */}
          <form
            ref={searchRef}
            onSubmit={handleSearch}
            className="hidden md:flex items-center flex-1 max-w-xs mx-3 relative"
          >
            <Search className="absolute left-3 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              placeholder="Search products…"
              className="w-full pl-8 pr-3 py-1.5 text-sm border rounded-full bg-gray-50 focus:bg-white focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all"
            />
          </form>

          <div className="flex items-center gap-1">
            <Link href="/shop/track">
              <span className={`hidden sm:inline-flex px-3 py-1.5 rounded-full text-sm transition-all duration-150 cursor-pointer select-none
                ${location === "/shop/track"
                  ? "bg-primary/10 text-primary font-semibold"
                  : "text-foreground hover:bg-primary/8 hover:text-primary"}`}>
                Track Order
              </span>
            </Link>

            {/* Auth buttons */}
            {customer ? (
              <Link href="/shop/account">
                <span className={`hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-all duration-150 cursor-pointer select-none
                  ${location.startsWith("/shop/account")
                    ? "bg-primary/10 text-primary font-semibold"
                    : "text-foreground hover:bg-primary/8 hover:text-primary"}`}>
                  <User className="h-3.5 w-3.5" />
                  {customer.name.split(" ")[0]}
                </span>
              </Link>
            ) : (
              <div className="hidden sm:flex items-center gap-1">
                <Link href="/shop/sign-in">
                  <span className={`inline-flex px-3 py-1.5 rounded-full text-sm transition-all duration-150 cursor-pointer select-none
                    ${location === "/shop/sign-in"
                      ? "bg-primary/10 text-primary font-semibold"
                      : "text-foreground hover:bg-primary/8 hover:text-primary"}`}>
                    Login
                  </span>
                </Link>
                <Link href="/shop/sign-up">
                  <span className="inline-flex px-3 py-1.5 rounded-full text-sm bg-primary text-white font-semibold cursor-pointer hover:bg-primary/90 transition-all duration-150 select-none">
                    Sign Up
                  </span>
                </Link>
              </div>
            )}

            {customer && (
              <Link href="/shop/notifications">
                <span
                  className={`inline-flex items-center justify-center w-9 h-9 rounded-full border transition-all duration-150 cursor-pointer select-none relative
                    ${location === "/shop/notifications"
                      ? "bg-primary/10 text-primary border-primary/30"
                      : "text-foreground border-border hover:bg-primary/8 hover:text-primary hover:border-primary/30"}`}
                  title="Notifications"
                  onClick={() => markShopNotifsRead()}
                >
                  <Bell className="h-4 w-4" />
                  {shopBellCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] bg-red-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center px-0.5 leading-none">
                      {shopBellCount > 9 ? "9+" : shopBellCount}
                    </span>
                  )}
                </span>
              </Link>
            )}

            <Link href="/shop/cart">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-all duration-150 cursor-pointer select-none relative
                ${location === "/shop/cart"
                  ? "bg-primary/10 text-primary font-semibold border-primary/30"
                  : "text-foreground border-border hover:bg-primary/8 hover:text-primary hover:border-primary/30"}`}>
                <ShoppingCart className="h-4 w-4" />
                {count > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 h-5 w-5 bg-primary text-primary-foreground rounded-full text-xs flex items-center justify-center font-bold">
                    {count > 9 ? "9+" : count}
                  </span>
                )}
                <span className="hidden sm:inline">Cart</span>
              </span>
            </Link>
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileOpen(!mobileOpen)}>
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Nav */}
        {mobileOpen && (
          <div className="md:hidden border-t bg-white px-4 py-3 space-y-1 max-h-[80vh] overflow-y-auto">
            {/* Mobile search */}
            <form onSubmit={handleSearch} className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
                placeholder="Search products…"
                className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg bg-gray-50 focus:bg-white focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all"
              />
            </form>
            <Link href="/shop"><div className="py-2 text-sm font-medium hover:text-primary" onClick={() => setMobileOpen(false)}>Home</div></Link>
            <Link href="/shop/products"><div className="py-2 text-sm font-bold hover:text-primary" onClick={() => setMobileOpen(false)}>All Products</div></Link>
            <div className="pt-1 pb-2 border-t">
              <p className="text-xs uppercase text-muted-foreground font-semibold tracking-wider py-1">Categories</p>
              {CATEGORIES.map(c => (
                <Link key={c.href} href={c.href}>
                  <div className="flex items-center gap-2 py-2 text-sm hover:text-primary" onClick={() => setMobileOpen(false)}>
                    <c.icon className="h-3.5 w-3.5 text-primary" />{c.label}
                  </div>
                </Link>
              ))}
            </div>
            <div className="border-t pt-2 space-y-1">
              <Link href="/shop/track"><div className="py-2 text-sm font-medium hover:text-primary" onClick={() => setMobileOpen(false)}>Track Order</div></Link>
              <Link href="/shop/about"><div className="py-2 text-sm font-medium hover:text-primary" onClick={() => setMobileOpen(false)}>About</div></Link>
              <Link href="/shop/contact"><div className="py-2 text-sm font-medium hover:text-primary" onClick={() => setMobileOpen(false)}>Contact</div></Link>
            </div>
            {/* Mobile auth */}
            <div className="border-t pt-2 space-y-1">
              {customer ? (
                <Link href="/shop/account">
                  <div className="flex items-center gap-2 py-2 text-sm font-medium hover:text-primary" onClick={() => setMobileOpen(false)}>
                    <User className="h-3.5 w-3.5" /> My Account
                  </div>
                </Link>
              ) : (
                <>
                  <Link href="/shop/sign-in">
                    <div className="flex items-center gap-2 py-2 text-sm font-medium hover:text-primary" onClick={() => setMobileOpen(false)}>
                      <LogIn className="h-3.5 w-3.5" /> Login
                    </div>
                  </Link>
                  <Link href="/shop/sign-up">
                    <div className="flex items-center gap-2 py-2 text-sm font-medium text-primary" onClick={() => setMobileOpen(false)}>
                      <User className="h-3.5 w-3.5" /> Sign Up
                    </div>
                  </Link>
                </>
              )}
            </div>
            {/* Mobile WhatsApp */}
            <div className="border-t pt-3 pb-1">
              <a href="#" onClick={(e) => { e.preventDefault(); openWhatsApp(GEEM_WA); }}
                className="flex items-center gap-2 text-sm text-green-600 font-medium">
                <MessageCircle className="h-4 w-4" /> +92 307-8680005
              </a>
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">{children}</main>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <footer className="bg-gray-950 text-gray-400 mt-16">
        {/* WhatsApp CTA strip */}
        <div className="bg-green-700 py-4 px-4">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3 text-white">
              <MessageCircle className="h-6 w-6 shrink-0" />
              <div>
                <p className="font-bold text-sm">Chat with us on WhatsApp</p>
                <p className="text-green-100 text-xs">+92 307-8680005 · Available Mon–Sat 9AM–5PM PKT</p>
              </div>
            </div>
            <button onClick={() => openWhatsApp(GEEM_WA)}
              className="bg-white text-green-700 font-bold text-sm px-5 py-2 rounded-full hover:bg-green-50 transition-colors whitespace-nowrap cursor-pointer">
              Open WhatsApp →
            </button>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 pt-12 pb-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
            <div className="md:col-span-1">
              <div className="flex items-center mb-3">
                <img src={branding.logo ?? "/geem-logo-banner.svg"} alt={branding.companyName} className="h-9 w-auto brightness-0 invert" />
              </div>
              <p className="text-sm font-bold text-gray-100 leading-snug mb-2">
                Military-Grade<br />Security &amp; Surveillance<br />Equipment
              </p>
              <p className="text-sm leading-relaxed text-gray-400">
                Professional-grade spy cameras, RF signal detectors, GPS trackers, counter-surveillance devices, and covert communications equipment. Trusted by security professionals across Pakistan. Custom imports for agencies on demand.
              </p>
              <div className="flex gap-3 mt-4">
                <button onClick={() => openWhatsApp(GEEM_WA)}
                  className="text-xs bg-green-700 text-white px-3 py-1.5 rounded-full hover:bg-green-600 transition-colors cursor-pointer">
                  WhatsApp
                </button>
                <a href="mailto:info@geem.pk"
                  className="text-xs bg-gray-700 text-white px-3 py-1.5 rounded-full hover:bg-gray-600 transition-colors">
                  Email Us
                </a>
              </div>
              <div className="mt-4 text-xs text-gray-500 space-y-1">
                <p>📞 +92 307-8680005</p>
                <p>✉️ info@geem.pk</p>
                <p>📍 Ahmadpur East, Bahawalpur, Pakistan</p>
                <p>🕐 Mon–Sat: 9AM – 5PM PKT</p>
              </div>
            </div>
            {Object.entries(FOOTER_LINKS).map(([heading, links]) => (
              <div key={heading}>
                <h3 className="text-white font-bold text-sm mb-4 uppercase tracking-wider">{heading}</h3>
                <ul className="space-y-2">
                  {links.map(l => (
                    <li key={l.href}>
                      <Link href={l.href}>
                        <span className="text-sm hover:text-white transition-colors cursor-pointer">{l.label}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="border-t border-gray-800 pt-6 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-gray-600">
            <p>© {new Date().getFullYear()} Geem. All rights reserved. | Ahmadpur East, Bahawalpur, Pakistan | geem.pk</p>
            <div className="flex gap-4">
              <Link href="/shop/privacy"><span className="hover:text-gray-300 cursor-pointer">Privacy</span></Link>
              <Link href="/shop/terms"><span className="hover:text-gray-300 cursor-pointer">Terms</span></Link>
              <Link href="/shop/returns"><span className="hover:text-gray-300 cursor-pointer">Returns</span></Link>
              <Link href="/shop/shipping"><span className="hover:text-gray-300 cursor-pointer">Shipping</span></Link>
            </div>
          </div>
        </div>
      </footer>

      <AppSetupPrompt appName="Geem Shop" appIcon="/icon-192.png" />
      <WhatsAppChooser />
    </div>
  );
}
