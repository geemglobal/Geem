import { useState, useEffect } from "react";
import { openWhatsApp, GEEM_WA } from "@/lib/whatsapp";
import { useQuery } from "@tanstack/react-query";
import { axiosInstance } from "@/lib/axios";
import { ShopLayout } from "./ShopLayout";
import { Link, useSearch } from "wouter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Package, Search, MessageCircle } from "lucide-react";

interface Product {
  id: number; title: string; slug: string; price: number; salePrice: number | null; hidePrice: boolean;
  shortDescription: string | null; featuredImage: string | null;
  brandName: string | null; categoryName: string | null; stockCount: number;
}
interface Brand { id: number; name: string; }
interface Category { id: number; name: string; }

function waClick(title: string) {
  openWhatsApp(GEEM_WA, `Hi, I'd like to know the price of: ${title}`);
}

export default function ShopProducts() {
  const searchStr = useSearch();

  function getParam(key: string) {
    const params = new URLSearchParams(searchStr);
    return params.get(key) ?? "";
  }

  const [inputValue, setInputValue] = useState(() => getParam("search"));
  const [search, setSearch] = useState(() => getParam("search"));
  const [brandId, setBrandId] = useState(() => getParam("brandId"));
  const [categoryId, setCategoryId] = useState(() => getParam("categoryId"));
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const params = new URLSearchParams(searchStr);
    const b = params.get("brandId") ?? "";
    const c = params.get("categoryId") ?? "";
    const s = params.get("search") ?? "";
    setBrandId(b);
    setCategoryId(c);
    setSearch(s);
    setInputValue(s);
    setPage(1);
  }, [searchStr]);

  const { data } = useQuery({
    queryKey: ["shop-products-list", search, brandId, categoryId, sort, page],
    queryFn: () => axiosInstance.get<{ products: Product[]; total: number }>(
      `/shop/products?search=${encodeURIComponent(search)}&brandId=${brandId}&categoryId=${categoryId}&sort=${sort}&page=${page}`
    ).then(r => r.data),
  });

  const { data: brands } = useQuery({ queryKey: ["brands"], queryFn: () => axiosInstance.get<Brand[]>("/brands").then(r => r.data) });
  const { data: categories } = useQuery({ queryKey: ["categories"], queryFn: () => axiosInstance.get<Category[]>("/categories").then(r => r.data) });

  const products = data?.products ?? [];

  const heading = (() => {
    if (brandId && brands) {
      const b = brands.find(br => String(br.id) === brandId);
      if (b) return b.name;
    }
    if (categoryId && categories) {
      const c = categories.find(cat => String(cat.id) === categoryId);
      if (c) return c.name;
    }
    return "All Products";
  })();

  return (
    <ShopLayout>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">{heading}</h1>
          <p className="text-muted-foreground">{data?.total ?? 0} products found</p>
        </div>

        {/* Search — full width */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products… press Enter"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") {
                setSearch(inputValue);
                setPage(1);
              }
            }}
            className="pl-9"
          />
        </div>

        {/* Filter row — horizontal scroll on mobile */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap sm:overflow-visible">
          <Select value={brandId || "all"} onValueChange={v => { setBrandId(v === "all" ? "" : v); setPage(1); }}>
            <SelectTrigger className="flex-shrink-0 w-36 sm:w-44"><SelectValue placeholder="All Brands" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Brands</SelectItem>
              {brands?.map(b => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={categoryId || "all"} onValueChange={v => { setCategoryId(v === "all" ? "" : v); setPage(1); }}>
            <SelectTrigger className="flex-shrink-0 w-40 sm:w-44"><SelectValue placeholder="All Categories" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories?.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger className="flex-shrink-0 w-36 sm:w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest First</SelectItem>
              <SelectItem value="price_asc">Price: Low to High</SelectItem>
              <SelectItem value="price_desc">Price: High to Low</SelectItem>
            </SelectContent>
          </Select>
          {(brandId || categoryId || search) && (
            <Button variant="outline" className="flex-shrink-0" onClick={() => { setBrandId(""); setCategoryId(""); setSearch(""); setInputValue(""); setPage(1); }}>
              Clear
            </Button>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {products.map(p => (
            <Link key={p.id} href={`/shop/products/${p.slug}`}>
              <div className="group border rounded-xl overflow-hidden hover:shadow-lg transition-all duration-200 cursor-pointer bg-white">
                <div className="aspect-square bg-gray-50">
                  {p.featuredImage ? (
                    <img src={p.featuredImage} alt={p.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"><Package className="h-12 w-12 text-muted-foreground opacity-30" /></div>
                  )}
                </div>
                <div className="p-4">
                  {p.brandName && <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{p.brandName}</p>}
                  <h3 className="font-semibold text-sm leading-snug group-hover:text-primary line-clamp-2">{p.title}</h3>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    {p.hidePrice ? (
                      <button
                        onClick={e => { e.stopPropagation(); waClick(p.title); }}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-green-500 hover:bg-green-600 text-white transition-colors cursor-pointer"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />Get Price
                      </button>
                    ) : p.salePrice ? (
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                          <p className="text-lg font-bold text-primary">Rs {p.salePrice.toLocaleString()}</p>
                          <span className="text-xs font-semibold text-white bg-primary px-1.5 py-0.5 rounded">
                            {Math.round((1 - p.salePrice / p.price) * 100)}% OFF
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground line-through">Rs {p.price.toLocaleString()}</p>
                      </div>
                    ) : (
                      <p className="text-lg font-bold text-primary">Rs {p.price.toLocaleString()}</p>
                    )}
                    {p.stockCount === 0 && <Badge className="text-xs bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20">On Demand</Badge>}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {!products.length && (
          <div className="text-center py-20 text-muted-foreground">
            <Package className="h-16 w-16 mx-auto mb-4 opacity-20" />
            <p className="text-lg">No products found</p>
            {(search || brandId || categoryId) && (
              <Button variant="outline" className="mt-4" onClick={() => { setBrandId(""); setCategoryId(""); setSearch(""); setInputValue(""); }}>
                Clear Filters
              </Button>
            )}
          </div>
        )}

        {(data?.total ?? 0) > 20 && (
          <div className="flex justify-center gap-2 mt-8">
            <Button variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
            <span className="flex items-center px-3 text-sm text-muted-foreground">Page {page}</span>
            <Button variant="outline" disabled={products.length < 20} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        )}
      </div>
    </ShopLayout>
  );
}
