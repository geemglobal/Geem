import { useState, useEffect } from "react";
import { openWhatsApp, GEEM_WA } from "@/lib/whatsapp";
import { useQuery } from "@tanstack/react-query";
import { axiosInstance } from "@/lib/axios";
import { ShopLayout } from "./ShopLayout";
import { Link, useSearch, useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSEO } from "@/hooks/useSEO";
import {
  Package, Search, MessageCircle, ChevronRight, SlidersHorizontal, X,
  Camera, Radio, FlaskConical, Battery, Shield,
} from "lucide-react";

interface Product {
  id: number; title: string; slug: string; price: number; salePrice: number | null; hidePrice: boolean;
  shortDescription: string | null; featuredImage: string | null;
  brandName: string | null; categoryName: string | null; stockCount: number;
}
interface Brand { id: number; name: string; }
interface Category { id: number; name: string; parentId: number | null; active: boolean; }
interface CategoryNode extends Category { children: Category[]; }

const CAT_ICONS: Record<string, React.ElementType> = {
  "Covert Surveillance & Audio Gear": Camera,
  "Industrial Composite Materials": FlaskConical,
  "Custom Battery Design & Manufacturing Services": Battery,
  "Security Equipment": Shield,
  "Signal & RF Detectors": Radio,
};

function buildTree(cats: Category[]): CategoryNode[] {
  const parents = cats.filter(c => !c.parentId);
  return parents.map(p => ({
    ...p,
    children: cats.filter(c => c.parentId === p.id),
  }));
}

function waClick(title: string) {
  openWhatsApp(GEEM_WA, `Hi, I'd like to know the price of: ${title}`);
}

function ProductCard({ p }: { p: Product }) {
  const [imgFailed, setImgFailed] = useState(false);
  return (
    <Link href={`/shop/products/${p.slug}`}>
      <div className="group border rounded-xl overflow-hidden hover:shadow-lg transition-all duration-200 cursor-pointer bg-white h-full flex flex-col">
        <div className="aspect-[4/3] bg-gray-50 overflow-hidden relative">
          {p.featuredImage && !imgFailed ? (
            <img
              src={p.featuredImage}
              alt={p.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              onError={() => setImgFailed(true)}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-gray-100 to-gray-50">
              <Package className="h-10 w-10 text-muted-foreground opacity-20" />
            </div>
          )}
          {p.stockCount === 0 && (
            <div className="absolute top-2 left-2">
              <Badge className="text-[10px] bg-primary/90 text-primary-foreground border-0">On Demand</Badge>
            </div>
          )}
        </div>
        <div className="p-3 flex flex-col flex-1">
          {p.brandName && (
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">{p.brandName}</p>
          )}
          <h3 className="font-semibold text-sm leading-snug group-hover:text-primary transition-colors line-clamp-2 flex-1 mb-3">
            {p.title}
          </h3>
          {p.shortDescription && (
            <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{p.shortDescription}</p>
          )}
          <div className="mt-auto">
            {p.hidePrice ? (
              <button
                onClick={e => { e.preventDefault(); waClick(p.title); }}
                className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-green-500 hover:bg-green-600 text-white transition-colors"
              >
                <MessageCircle className="h-3.5 w-3.5" />Get Price / Quote
              </button>
            ) : p.salePrice ? (
              <div className="flex items-center gap-2">
                <p className="text-base font-bold text-primary">Rs {p.salePrice.toLocaleString()}</p>
                <span className="text-[10px] font-semibold text-white bg-primary px-1.5 py-0.5 rounded">
                  {Math.round((1 - p.salePrice / p.price) * 100)}% OFF
                </span>
              </div>
            ) : (
              <p className="text-base font-bold text-primary">
                {p.price <= 1 ? (
                  <button
                    onClick={e => { e.preventDefault(); waClick(p.title); }}
                    className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-green-500 hover:bg-green-600 text-white transition-colors"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />Get Price
                  </button>
                ) : `Rs ${p.price.toLocaleString()}`}
              </p>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function ShopProducts() {
  const searchStr = useSearch();
  const [, navigate] = useLocation();
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);

  function getParam(key: string) {
    return new URLSearchParams(searchStr).get(key) ?? "";
  }

  const [inputValue, setInputValue] = useState(() => getParam("search"));
  const [search, setSearch] = useState(() => getParam("search"));
  const [brandId, setBrandId] = useState(() => getParam("brandId"));
  const [categoryId, setCategoryId] = useState(() => getParam("categoryId"));
  // Holds a ?category=NAME value that hasn't been resolved to an ID yet
  const [pendingCategoryName, setPendingCategoryName] = useState(() => getParam("category"));
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);

  // Sync local state whenever the URL query string changes
  useEffect(() => {
    const params = new URLSearchParams(searchStr);
    setBrandId(params.get("brandId") ?? "");
    setCategoryId(params.get("categoryId") ?? "");
    setPendingCategoryName(params.get("category") ?? "");
    const s = params.get("search") ?? "";
    setSearch(s); setInputValue(s);
    setPage(1);
  }, [searchStr]);

  // Resolve ?category=NAME → categoryId once the category list has loaded
  useEffect(() => {
    if (!pendingCategoryName || !allCategories) return;
    const lc = pendingCategoryName.toLowerCase();
    const match = allCategories.find(c =>
      c.name.toLowerCase() === lc ||
      c.name.toLowerCase().includes(lc) ||
      lc.includes(c.name.toLowerCase().split(" ")[0])
    );
    if (match) {
      setCategoryId(String(match.id));
      setPendingCategoryName("");
    }
  }, [pendingCategoryName, allCategories]);

  const { data, isLoading } = useQuery({
    queryKey: ["shop-catalog", search, brandId, categoryId, sort, page],
    queryFn: () => axiosInstance.get<{ products: Product[]; total: number }>(
      `/shop/products?search=${encodeURIComponent(search)}&brandId=${brandId}&categoryId=${categoryId}&sort=${sort}&page=${page}&limit=24`
    ).then(r => r.data),
  });

  const { data: brands } = useQuery({
    queryKey: ["brands"],
    queryFn: () => axiosInstance.get<Brand[]>("/brands").then(r => r.data),
  });
  const { data: allCategories } = useQuery({
    queryKey: ["categories"],
    queryFn: () => axiosInstance.get<Category[]>("/categories").then(r => r.data),
  });

  const products = data?.products ?? [];
  const categoryTree = buildTree(allCategories ?? []);

  const activeCategory = (allCategories ?? []).find(c => String(c.id) === categoryId);
  const activeBrand = (brands ?? []).find(b => String(b.id) === brandId);

  // Show pending category name as heading while resolving
  const heading = activeCategory?.name ?? pendingCategoryName ?? activeBrand?.name ?? "All Products";

  function setFilter(params: { categoryId?: string; brandId?: string; search?: string }) {
    const p = new URLSearchParams(searchStr);
    if (params.categoryId !== undefined) { params.categoryId ? p.set("categoryId", params.categoryId) : p.delete("categoryId"); }
    if (params.brandId !== undefined) { params.brandId ? p.set("brandId", params.brandId) : p.delete("brandId"); }
    if (params.search !== undefined) { params.search ? p.set("search", params.search) : p.delete("search"); }
    const qs = p.toString();
    navigate(qs ? `/shop/products?${qs}` : "/shop/products");
    setPage(1);
  }

  const hasFilters = !!(brandId || categoryId || search);

  useSEO({
    title: `${heading} — Geem Pakistan | Covert Surveillance, Carbon Fiber & Industrial Equipment`,
    description: `Browse ${heading.toLowerCase()} at Geem.pk — Pakistan's specialist supplier of LawMate surveillance devices, Esonic recorders, Toray carbon fiber, Huntsman Araldite, and custom battery systems.`,
    keywords: "LawMate Pakistan, Esonic MemoQ Pakistan, Toray carbon fiber Pakistan, Huntsman Araldite Pakistan, spy camera Pakistan, covert surveillance equipment Pakistan",
  });

  return (
    <ShopLayout>
      {/* Mobile sidebar overlay */}
      {showMobileSidebar && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setShowMobileSidebar(false)}
        />
      )}

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* ── Top bar ── */}
        <div className="flex gap-3 mb-6 items-center">
          <button
            className="lg:hidden flex items-center gap-2 border rounded-lg px-3 py-2 text-sm font-medium hover:bg-muted"
            onClick={() => setShowMobileSidebar(true)}
          >
            <SlidersHorizontal className="h-4 w-4" />Categories
          </button>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search products…"
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") { setFilter({ search: inputValue }); }
              }}
              className="pl-9"
            />
          </div>
          <Select value={brandId || "all"} onValueChange={v => setFilter({ brandId: v === "all" ? "" : v })}>
            <SelectTrigger className="w-36 sm:w-44 flex-shrink-0"><SelectValue placeholder="All Brands" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Brands</SelectItem>
              {brands?.map(b => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger className="w-36 sm:w-40 flex-shrink-0 hidden sm:flex"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="price_asc">Price ↑</SelectItem>
              <SelectItem value="price_desc">Price ↓</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-6">
          {/* ── Sidebar ── */}
          <aside className={`
            fixed inset-y-0 left-0 z-50 w-72 bg-white shadow-2xl overflow-y-auto p-4 lg:static lg:shadow-none lg:z-auto lg:w-56 lg:flex-shrink-0 lg:bg-transparent lg:p-0 lg:overflow-visible
            transform transition-transform duration-200
            ${showMobileSidebar ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
          `}>
            <div className="flex items-center justify-between mb-4 lg:hidden">
              <h2 className="font-bold text-sm">Categories</h2>
              <button onClick={() => setShowMobileSidebar(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="space-y-0.5">
              {/* All Products */}
              <button
                onClick={() => { setFilter({ categoryId: "", brandId: "" }); setShowMobileSidebar(false); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${!categoryId && !brandId && !search ? "bg-primary text-primary-foreground" : "hover:bg-muted text-foreground"}`}
              >
                <Package className="h-4 w-4 flex-shrink-0" />
                All Products
                {data && <span className={`ml-auto text-xs ${!categoryId && !brandId && !search ? "opacity-80" : "text-muted-foreground"}`}>{data.total}</span>}
              </button>

              {/* Category tree */}
              {categoryTree.map(parent => {
                const Icon = CAT_ICONS[parent.name] ?? Shield;
                if (!parent.children.length) return null;
                return (
                  <div key={parent.id} className="pt-2">
                    <p className="flex items-center gap-1.5 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      <Icon className="h-3 w-3" />{parent.name}
                    </p>
                    {parent.children.map(child => (
                      <button
                        key={child.id}
                        onClick={() => { setFilter({ categoryId: String(child.id), brandId: "" }); setShowMobileSidebar(false); }}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-left ${categoryId === String(child.id) ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted text-foreground"}`}
                      >
                        <ChevronRight className="h-3 w-3 flex-shrink-0 opacity-50" />
                        <span className="line-clamp-1">{child.name}</span>
                      </button>
                    ))}
                  </div>
                );
              })}
            </nav>
          </aside>

          {/* ── Main content ── */}
          <div className="flex-1 min-w-0">
            {/* Heading + active filters */}
            <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
              <div>
                <h1 className="text-xl font-bold">{heading}</h1>
                <p className="text-sm text-muted-foreground">{data?.total ?? 0} products</p>
              </div>
              {hasFilters && (
                <div className="flex flex-wrap gap-1.5">
                  {categoryId && activeCategory && (
                    <Badge variant="secondary" className="gap-1 pr-1">
                      {activeCategory.name}
                      <button onClick={() => setFilter({ categoryId: "" })} className="ml-0.5 hover:text-destructive"><X className="h-3 w-3" /></button>
                    </Badge>
                  )}
                  {brandId && activeBrand && (
                    <Badge variant="secondary" className="gap-1 pr-1">
                      {activeBrand.name}
                      <button onClick={() => setFilter({ brandId: "" })} className="ml-0.5 hover:text-destructive"><X className="h-3 w-3" /></button>
                    </Badge>
                  )}
                  {search && (
                    <Badge variant="secondary" className="gap-1 pr-1">
                      "{search}"
                      <button onClick={() => { setFilter({ search: "" }); setInputValue(""); }} className="ml-0.5 hover:text-destructive"><X className="h-3 w-3" /></button>
                    </Badge>
                  )}
                  <button onClick={() => { setFilter({ categoryId: "", brandId: "", search: "" }); setInputValue(""); }} className="text-xs text-muted-foreground hover:text-destructive underline">Clear all</button>
                </div>
              )}
            </div>

            {/* Product grid */}
            {isLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="border rounded-xl overflow-hidden animate-pulse bg-white">
                    <div className="aspect-[4/3] bg-gray-100" />
                    <div className="p-3 space-y-2">
                      <div className="h-2 bg-gray-100 rounded w-1/3" />
                      <div className="h-3 bg-gray-100 rounded w-4/5" />
                      <div className="h-3 bg-gray-100 rounded w-2/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : products.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                {products.map(p => <ProductCard key={p.id} p={p} />)}
              </div>
            ) : (
              <div className="text-center py-20 text-muted-foreground">
                <Package className="h-16 w-16 mx-auto mb-4 opacity-20" />
                <p className="text-lg font-medium">No products found</p>
                <p className="text-sm mt-1">Try adjusting your search or filters</p>
                {hasFilters && (
                  <Button variant="outline" className="mt-4" onClick={() => { setFilter({ categoryId: "", brandId: "", search: "" }); setInputValue(""); }}>
                    Clear Filters
                  </Button>
                )}
              </div>
            )}

            {/* Pagination */}
            {(data?.total ?? 0) > 24 && (
              <div className="flex justify-center gap-2 mt-8">
                <Button variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Previous</Button>
                <span className="flex items-center px-4 text-sm text-muted-foreground">Page {page} of {Math.ceil((data?.total ?? 0) / 24)}</span>
                <Button variant="outline" disabled={products.length < 24} onClick={() => setPage(p => p + 1)}>Next →</Button>
              </div>
            )}
          </div>
        </div>

        {/* ── WhatsApp CTA Banner ── */}
        <div className="mt-16 rounded-2xl bg-gradient-to-r from-gray-900 to-gray-800 text-white p-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold mb-1">Need a custom order or agency inquiry?</h2>
            <p className="text-gray-300 text-sm">We handle bulk imports, custom configurations, and agency-grade procurement across Pakistan.</p>
          </div>
          <Button
            size="lg"
            className="bg-green-500 hover:bg-green-600 text-white flex-shrink-0"
            onClick={() => openWhatsApp(GEEM_WA, "Hi, I'd like to make a custom order / agency inquiry.")}
          >
            <MessageCircle className="h-5 w-5 mr-2" />WhatsApp Us
          </Button>
        </div>
      </div>
    </ShopLayout>
  );
}
