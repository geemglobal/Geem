import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { axiosInstance } from "@/lib/axios";
import { ShopLayout } from "./ShopLayout";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCart } from "@/contexts/CartContext";
import { useToast } from "@/hooks/use-toast";
import { openWhatsApp, GEEM_WA } from "@/lib/whatsapp";
import { useSEO } from "@/hooks/useSEO";
import { useShopBranding } from "@/lib/shopBranding";
import {
  Package, Star, ArrowRight, Shield, Truck, Award, MessageCircle, ShoppingCart,
  Camera, MapPin, Radio, Lock, Eye, Wifi, CheckCircle2, Phone, Zap,
} from "lucide-react";

interface Product {
  id: number; title: string; slug: string; price: number; salePrice: number | null;
  shortDescription: string | null; featuredImage: string | null; featured: boolean;
  brandName: string | null; stockCount: number;
}
interface Category { id: number; name: string; }
interface Brand { id: number; name: string; }

const CAT_CONFIG: Record<string, { icon: React.ElementType; color: string; bg: string; desc: string }> = {
  "Security Equipment":        { icon: Shield,  color: "text-blue-700",   bg: "bg-blue-50",    desc: "Alarms, access control & hardware" },
  "Signal & RF Detectors":     { icon: Radio,   color: "text-red-700",    bg: "bg-red-50",     desc: "Bug sweepers & spectrum analyzers" },
  "Smart Security Systems":    { icon: Lock,    color: "text-indigo-700", bg: "bg-indigo-50",  desc: "IP cameras, NVRs & smart locks" },
  "Spy Cameras & Surveillance":{ icon: Camera,  color: "text-gray-700",   bg: "bg-gray-100",   desc: "Covert & pinhole cameras" },
  "GPS Trackers - Personal":   { icon: MapPin,  color: "text-green-700",  bg: "bg-green-50",   desc: "Personal, vehicle & asset tracking" },
  "Counter-Surveillance":      { icon: Eye,     color: "text-orange-700", bg: "bg-orange-50",  desc: "Anti-bug & privacy protection" },
  "Covert Communications":     { icon: Wifi,    color: "text-purple-700", bg: "bg-purple-50",  desc: "Encrypted & tactical comms" },
};

function ProductCard({ product }: { product: Product }) {
  const { addToCart } = useCart();
  const { toast } = useToast();
  const [imgFailed, setImgFailed] = useState(false);
  const effectivePrice = product.salePrice ?? product.price;
  const hasDiscount = product.salePrice && product.salePrice < product.price;
  const discountPct = hasDiscount ? Math.round(((product.price - product.salePrice!) / product.price) * 100) : 0;

  return (
    <div className="group border rounded-xl overflow-hidden hover:shadow-lg transition-all duration-200 bg-white flex flex-col">
      <Link href={`/shop/products/${product.slug}`}>
        <div className="aspect-square bg-gray-50 overflow-hidden relative">
          {product.featuredImage && !imgFailed ? (
            <img src={product.featuredImage} alt={product.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" onError={() => setImgFailed(true)} />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground bg-gray-100"><Package className="h-12 w-12 opacity-20" /></div>
          )}
          {hasDiscount && <div className="absolute top-2 left-2"><Badge className="bg-red-600 text-white text-xs">{discountPct}% OFF</Badge></div>}
          {product.stockCount === 0 && <div className="absolute inset-0 bg-black/50 flex items-center justify-center"><span className="text-white text-xs font-bold bg-primary/90 px-3 py-1.5 rounded-full tracking-wide">On Demand</span></div>}
        </div>
      </Link>
      <div className="p-4 flex flex-col flex-1">
        {product.brandName && <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mb-1">{product.brandName}</p>}
        <Link href={`/shop/products/${product.slug}`}>
          <h3 className="font-semibold text-sm leading-snug group-hover:text-primary transition-colors line-clamp-2 flex-1">{product.title}</h3>
        </Link>
        <div className="mt-3 flex items-end justify-between gap-1">
          <div>
            <p className="text-lg font-bold text-primary">Rs {effectivePrice.toLocaleString()}</p>
            {hasDiscount && <p className="text-xs text-muted-foreground line-through">Rs {product.price.toLocaleString()}</p>}
          </div>
          {product.stockCount === 0
            ? <Badge className="text-xs bg-primary/10 text-primary border border-primary/30">On Demand</Badge>
            : product.stockCount <= 3
              ? <Badge variant="secondary" className="text-xs">Only {product.stockCount} left</Badge>
              : null}
        </div>
        {product.stockCount > 0 ? (
          <Button className="w-full mt-3 h-8 text-xs" variant="outline" onClick={(e) => {
            e.preventDefault();
            addToCart({ productId: product.id, title: product.title, price: effectivePrice, qty: 1, image: product.featuredImage, slug: product.slug });
            toast({ title: "Added to cart" });
          }}>
            <ShoppingCart className="h-3 w-3 mr-1.5" />Add to Cart
          </Button>
        ) : (
          <Button className="w-full mt-3 h-8 text-xs bg-primary/10 text-primary hover:bg-primary/20 border border-primary/30" variant="ghost" asChild>
            <span onClick={(e) => { e.preventDefault(); openWhatsApp(GEEM_WA, `I'd like to inquire about: ${product.title}`); }}>Get Price</span>
          </Button>
        )}
      </div>
    </div>
  );
}

export default function ShopHome() {
  const branding = useShopBranding();
  useSEO({
    title: "Military-Grade Security Equipment, Spy Cameras & GPS Trackers in Pakistan | Geem",
    description: "Pakistan's specialist supplier of military-grade security equipment: spy cameras, RF detectors, GPS trackers, counter-surveillance devices, covert communications. Custom agency imports. Nationwide delivery.",
    keywords: "spy camera Pakistan, military grade security equipment Pakistan, RF detector Pakistan, GPS tracker personal Pakistan, counter surveillance Pakistan, hidden camera Pakistan, bug detector Pakistan, security agency equipment Pakistan, TSCM equipment Pakistan, covert surveillance Pakistan, Lawmate Pakistan, tactical security equipment Pakistan",
  });

  const { data } = useQuery({
    queryKey: ["shop-products-home"],
    queryFn: () => axiosInstance.get<{ products: Product[]; total: number }>("/shop/products?limit=8").then(r => r.data),
  });
  const { data: featured } = useQuery({
    queryKey: ["shop-featured"],
    queryFn: () => axiosInstance.get<{ products: Product[] }>("/shop/products?featured=true&limit=4").then(r => r.data),
  });
  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: () => axiosInstance.get<Category[]>("/categories").then(r => r.data),
  });
  const { data: brands } = useQuery({
    queryKey: ["brands"],
    queryFn: () => axiosInstance.get<Brand[]>("/brands").then(r => r.data),
  });

  const products = data?.products ?? [];
  const displayCats = (categories ?? []).filter(c => CAT_CONFIG[c.name]);

  return (
    <ShopLayout>

      {/* ── Hero ── */}
      <section className="relative bg-gray-950 text-white overflow-hidden">
        {/* Company banner image — DB upload takes priority; static SVG is the fallback */}
        <div className="absolute inset-0">
          <img
            src={branding.banner ?? "/hero-banner.svg"}
            alt=""
            className="w-full h-full object-cover object-center"
            aria-hidden="true"
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-gray-950 to-black opacity-85" />
        <div className="absolute inset-0" style={{ backgroundImage: "radial-gradient(circle at 20% 50%, rgba(220,38,38,0.08) 0%, transparent 60%), radial-gradient(circle at 80% 20%, rgba(59,130,246,0.08) 0%, transparent 50%)" }} />
        <div className="relative max-w-7xl mx-auto px-4 py-16 md:py-28">
          <div className="max-w-3xl">
            <Badge className="mb-5 bg-primary/20 text-primary border-primary/30 text-xs px-3 py-1">
              🇵🇰 Pakistan's Specialist Security Equipment Supplier
            </Badge>
            <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-tight mb-5">
              Military-Grade<br />
              <span className="text-primary">Security &amp; Surveillance</span><br />
              Equipment
            </h1>
            <p className="text-gray-300 text-lg md:text-xl leading-relaxed mb-8 max-w-2xl">
              Professional-grade spy cameras, RF signal detectors, GPS trackers, counter-surveillance devices, and covert communications equipment. Trusted by security professionals across Pakistan. <strong className="text-white">Custom imports for agencies on demand.</strong>
            </p>
            <div className="flex flex-wrap gap-4">
              <Link href="/shop/products">
                <Button size="lg" className="text-base px-8 bg-primary hover:bg-primary/90">
                  Browse All Products <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
              <Button size="lg" variant="outline" className="text-base px-8 border-gray-600 text-white hover:bg-gray-800 hover:border-gray-400" onClick={() => openWhatsApp(GEEM_WA)}>
                <MessageCircle className="h-4 w-4 mr-2" />Agency Inquiry
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Trust Strip ── */}
      <section className="bg-primary text-primary-foreground py-4">
        <div className="max-w-7xl mx-auto px-4 flex flex-wrap justify-center gap-6 md:gap-12 text-center text-sm">
          {[
            ["🎖️ Military-Grade Quality", ""],
            ["🔒 Discreet Packaging", "All orders shipped plain"],
            ["🚚 Nationwide Delivery", "2–5 business days"],
            ["📦 Custom Agency Imports", "On-demand procurement"],
            ["💬 Expert Technical Support", ""],
          ].map(([title, sub]) => (
            <div key={title}>
              <p className="font-bold text-sm">{title}</p>
              {sub && <p className="text-xs opacity-80">{sub}</p>}
            </div>
          ))}
        </div>
      </section>

      {/* ── Product Categories ── */}
      <section className="max-w-7xl mx-auto px-4 py-14">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold mb-2">Product Categories</h2>
          <p className="text-muted-foreground max-w-xl mx-auto">Professional-grade equipment across all domains of security, intelligence, and surveillance operations.</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {displayCats.map(cat => {
            const cfg = CAT_CONFIG[cat.name];
            const Icon = cfg.icon;
            return (
              <Link key={cat.id} href={`/shop/category/${cat.id}`}>
                <div className="group border-2 rounded-xl p-5 hover:border-primary hover:shadow-md transition-all cursor-pointer bg-white h-full">
                  <div className={`w-12 h-12 ${cfg.bg} rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                    <Icon className={`h-6 w-6 ${cfg.color}`} />
                  </div>
                  <p className="font-bold text-sm mb-1">{cat.name}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{cfg.desc}</p>
                  <p className="text-xs text-primary font-medium mt-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">Browse <ArrowRight className="h-3 w-3" /></p>
                </div>
              </Link>
            );
          })}
          <Link href="/shop/products">
            <div className="group border-2 border-dashed rounded-xl p-5 hover:border-primary hover:bg-primary/5 transition-all cursor-pointer bg-white h-full flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mb-3">
                <ArrowRight className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <p className="font-bold text-sm">All Products</p>
              <p className="text-xs text-muted-foreground mt-1">View full catalog</p>
            </div>
          </Link>
        </div>
      </section>

      {/* ── Featured Products ── */}
      {featured && featured.products.length > 0 && (
        <section className="bg-gray-50 py-14">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-bold flex items-center gap-2"><Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />Featured Products</h2>
                <p className="text-sm text-muted-foreground mt-1">Top picks from our professional-grade inventory</p>
              </div>
              <Link href="/shop/products"><Button variant="outline" size="sm">View All <ArrowRight className="h-4 w-4 ml-1" /></Button></Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
              {featured.products.map(p => <ProductCard key={p.id} product={p} />)}
            </div>
          </div>
        </section>
      )}

      {/* ── Latest Products ── */}
      <section className="max-w-7xl mx-auto px-4 py-14">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold">Latest Products</h2>
            <p className="text-sm text-muted-foreground mt-1">Freshly stocked — ready for nationwide dispatch</p>
          </div>
          <Link href="/shop/products"><Button variant="outline" size="sm">View All <ArrowRight className="h-4 w-4 ml-1" /></Button></Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {products.map(p => <ProductCard key={p.id} product={p} />)}
          {!products.length && (
            <div className="col-span-4 text-center py-16 text-muted-foreground">
              <Package className="h-16 w-16 mx-auto mb-4 opacity-20" />
              <p className="text-lg font-medium">Loading products...</p>
            </div>
          )}
        </div>
      </section>

      {/* ── Agency Import Banner ── */}
      <section className="bg-gray-950 text-white py-16">
        <div className="max-w-5xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
            <div>
              <Badge className="bg-primary/20 text-primary border-primary/30 mb-4">Custom Import Service</Badge>
              <h2 className="text-3xl font-bold mb-4 leading-tight">Security Agency &amp; Professional Procurement</h2>
              <p className="text-gray-300 leading-relaxed mb-6">
                We import specialised security, intelligence, and surveillance equipment on demand for government agencies, law enforcement, private security firms, corporate investigation teams, and defence contractors. If you can't find it in our catalog, we can source it.
              </p>
              <ul className="space-y-2 mb-6">
                {[
                  "TSCM / counter-intelligence equipment",
                  "Night-vision & thermal imaging devices",
                  "Encrypted communication systems",
                  "Tactical body cameras & recording kits",
                  "Advanced RF spectrum analyzers",
                  "Custom surveillance installations",
                ].map(item => (
                  <li key={item} className="flex items-center gap-2 text-gray-300 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />{item}
                  </li>
                ))}
              </ul>
              <div className="flex gap-3 flex-wrap">
                <Button className="bg-green-700 hover:bg-green-600" onClick={() => openWhatsApp(GEEM_WA)}><MessageCircle className="h-4 w-4 mr-2" />WhatsApp for Inquiry</Button>
                <Link href="/shop/contact">
                  <Button variant="outline" className="border-gray-600 text-white hover:bg-gray-800"><Phone className="h-4 w-4 mr-2" />Contact Us</Button>
                </Link>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { val: "500+", label: "Products Sourced", icon: Package },
                { val: "Est. 2013", label: "In Business Since", icon: Award },
                { val: "50+", label: "Cities Served", icon: MapPin },
                { val: "24/7", label: "Agency Support", icon: Shield },
              ].map(item => (
                <div key={item.label} className="bg-gray-800 rounded-xl p-5 text-center">
                  <item.icon className="h-6 w-6 text-primary mx-auto mb-2" />
                  <p className="text-2xl font-black text-white">{item.val}</p>
                  <p className="text-xs text-gray-400 mt-1">{item.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Why Geem ── */}
      <section className="max-w-5xl mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center mb-10">Why Security Professionals Choose Geem</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { icon: Shield,  color: "text-blue-600",  title: "Military-Grade Authentic Products", desc: "Every item is genuine, professionally sourced, and tested. We carry Lawmate, Yuntrack, Micodus and other professional brands — no counterfeits." },
            { icon: Truck,   color: "text-green-600", title: "Discreet Nationwide Delivery",       desc: "All orders ship in plain, unmarked packaging to protect your privacy. Nationwide delivery in 2–5 business days via TCS and Leopards Courier." },
            { icon: Zap,     color: "text-orange-600",title: "On-Demand Agency Imports",           desc: "Can't find what you need? We import security, surveillance, and intelligence equipment from global manufacturers on a per-order basis for agencies and professionals." },
          ].map(item => (
            <div key={item.title} className="bg-white border-2 rounded-xl p-6 hover:border-primary transition-colors">
              <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center mb-4">
                <item.icon className={`h-7 w-7 ${item.color}`} />
              </div>
              <h3 className="font-bold text-base mb-2">{item.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Brands ── */}
      {brands && brands.length > 0 && (
        <section className="border-t bg-gray-50 py-10">
          <div className="max-w-7xl mx-auto px-4">
            <p className="text-center text-xs text-muted-foreground font-semibold mb-6 uppercase tracking-widest">Authorised Brands & Suppliers</p>
            <div className="flex flex-wrap justify-center gap-3">
              {brands.map(b => (
                <Link key={b.id} href={`/shop/products?brandId=${b.id}`}>
                  <div className="border rounded-lg px-5 py-2.5 text-sm font-semibold hover:border-primary hover:text-primary hover:bg-white transition-all cursor-pointer bg-white">{b.name}</div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── CTA ── */}
      <section className="max-w-7xl mx-auto px-4 py-12">
        <div className="bg-primary rounded-2xl p-6 sm:p-10 text-center text-primary-foreground">
          <h2 className="text-3xl font-bold mb-3">Need Professional Guidance?</h2>
          <p className="opacity-90 mb-6 max-w-lg mx-auto">Our security equipment specialists can help you select the right devices for your operational requirements — from covert surveillance to counter-intelligence.</p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link href="/shop/products"><Button size="lg" variant="secondary">Browse Catalog</Button></Link>
            <Button size="lg" variant="outline" className="text-primary-foreground border-primary-foreground hover:bg-primary-foreground hover:text-primary" onClick={() => openWhatsApp(GEEM_WA)}>
              <MessageCircle className="h-4 w-4 mr-2" />WhatsApp Consultation
            </Button>
          </div>
        </div>
      </section>

    </ShopLayout>
  );
}
