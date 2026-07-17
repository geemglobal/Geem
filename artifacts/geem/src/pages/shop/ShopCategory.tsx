import { useState } from "react";
import { openWhatsApp, GEEM_WA } from "@/lib/whatsapp";
import { useQuery } from "@tanstack/react-query";
import { axiosInstance } from "@/lib/axios";
import { useRoute, Link } from "wouter";
import { ShopLayout } from "./ShopLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Package, ArrowLeft } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { useToast } from "@/hooks/use-toast";

interface Product { id: number; title: string; slug: string; price: number; shortDescription: string | null; featuredImage: string | null; brandName: string | null; categoryName: string | null; stockCount: number; }
interface Category { id: number; name: string; }


function CategoryProductCard({ p }: { p: Product }) {
  const [imgFailed, setImgFailed] = useState(false);
  return (
    <div className="group border rounded-xl overflow-hidden hover:shadow-lg transition-all duration-200 bg-white">
      <Link href={`/shop/products/${p.slug}`}>
        <div className="aspect-square bg-gray-50">
          {p.featuredImage && !imgFailed ? (
            <img src={p.featuredImage} alt={p.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" onError={() => setImgFailed(true)} />
          ) : (
            <div className="w-full h-full flex items-center justify-center"><Package className="h-12 w-12 text-muted-foreground opacity-30" /></div>
          )}
        </div>
      </Link>
      <div className="p-4">
        {p.brandName && <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{p.brandName}</p>}
        <Link href={`/shop/products/${p.slug}`}>
          <h3 className="font-semibold text-sm leading-snug group-hover:text-primary line-clamp-2">{p.title}</h3>
        </Link>
        <div className="mt-3 flex items-center justify-between">
          <p className="text-lg font-bold text-primary">Rs {p.price.toLocaleString()}</p>
          {p.stockCount === 0 && <Badge className="text-xs bg-primary/10 text-primary border border-primary/30">On Demand</Badge>}
        </div>
      </div>
    </div>
  );
}

export default function ShopCategory() {
  const [, params] = useRoute("/shop/category/:id");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const { addToCart } = useCart();
  const { toast } = useToast();

  const categoryId = params?.id;

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: () => axiosInstance.get<Category[]>("/categories").then(r => r.data),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["shop-category", categoryId, sort, page],
    queryFn: () => axiosInstance.get<{ products: Product[]; total: number }>(
      `/shop/products?categoryId=${categoryId}&sort=${sort}&page=${page}`
    ).then(r => r.data),
    enabled: !!categoryId,
  });

  const category = categories?.find(c => String(c.id) === categoryId);
  const products = data?.products ?? [];

  return (
    <ShopLayout>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <Link href="/shop/products">
          <Button variant="ghost" size="sm" className="mb-4"><ArrowLeft className="h-4 w-4 mr-1" />All Products</Button>
        </Link>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">{category?.name ?? "Category"}</h1>
            <p className="text-muted-foreground mt-1">{data?.total ?? 0} products</p>
          </div>
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest First</SelectItem>
              <SelectItem value="price_asc">Price: Low to High</SelectItem>
              <SelectItem value="price_desc">Price: High to Low</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Other Categories */}
        {categories && categories.length > 1 && (
          <div className="flex gap-2 flex-wrap mb-6">
            <Link href="/shop/products">
              <Badge variant="outline" className="cursor-pointer hover:border-primary px-3 py-1">All</Badge>
            </Link>
            {categories.map(c => (
              <Link key={c.id} href={`/shop/category/${c.id}`}>
                <Badge variant={String(c.id) === categoryId ? "default" : "outline"} className="cursor-pointer hover:border-primary px-3 py-1">{c.name}</Badge>
              </Link>
            ))}
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-20 text-muted-foreground">Loading products...</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {products.map(p => (
              <CategoryProductCard key={p.id} p={p} />
            ))}
            {!products.length && !isLoading && (
              <div className="col-span-4 text-center py-20 text-muted-foreground">
                <Package className="h-16 w-16 mx-auto mb-4 opacity-20" />
                <p className="text-lg">No products in this category</p>
              </div>
            )}
          </div>
        )}

        {(data?.total ?? 0) > 20 && (
          <div className="flex justify-center gap-2 mt-8">
            <Button variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
            <Button variant="outline" onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        )}
      </div>
    </ShopLayout>
  );
}
