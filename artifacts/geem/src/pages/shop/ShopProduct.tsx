import { useState } from "react";
import { openWhatsApp, GEEM_WA } from "@/lib/whatsapp";
import { useQuery } from "@tanstack/react-query";
import { axiosInstance } from "@/lib/axios";
import { useRoute, Link, useLocation } from "wouter";
import { ShopLayout } from "./ShopLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useCart } from "@/contexts/CartContext";
import { useSEO } from "@/hooks/useSEO";
import { Package, ArrowLeft, ShoppingCart, Zap, Shield, Truck, CheckCircle, Tag, MessageCircle, Phone } from "lucide-react";

interface Product {
  id: number;
  title: string;
  slug: string;
  sku: string | null;
  price: number;
  salePrice: number | null;
  shortDescription: string | null;
  longDescription: string | null;
  featuredImage: string | null;
  galleryImages: string[];
  brandName: string | null;
  categoryName: string | null;
  tags: string[];
  stockCount: number;
  published: boolean;
  hidePrice: boolean;
  metaTitle: string | null;
  metaDescription: string | null;
}

function discount(price: number, sale: number) {
  return Math.round(((price - sale) / price) * 100);
}

export default function ShopProduct() {
  const [, params] = useRoute("/shop/products/:slug");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { addToCart } = useCart();
  const [qty, setQty] = useState(1);
  const [activeImg, setActiveImg] = useState(0);
  const [imgFailed, setImgFailed] = useState(false);

  const { data: product, isLoading } = useQuery({
    queryKey: ["shop-product", params?.slug],
    queryFn: () => axiosInstance.get<Product>(`/shop/products/${params!.slug}`).then(r => r.data),
    enabled: !!params?.slug,
  });

  const effectivePrice = product?.salePrice ?? product?.price ?? 0;
  const allImages = product ? [
    ...(product.featuredImage ? [product.featuredImage] : []),
    ...product.galleryImages.filter(g => g !== product.featuredImage),
  ] : [];

  useSEO({
    title: product?.metaTitle ?? product?.title,
    description: product?.metaDescription ?? product?.shortDescription ?? undefined,
    image: product?.featuredImage ?? undefined,
    url: product ? `https://geem.pk/shop/products/${product.slug}` : undefined,
    type: "product",
    jsonLd: product ? {
      "@context": "https://schema.org",
      "@type": "Product",
      name: product.title,
      description: product.shortDescription ?? product.title,
      image: allImages,
      brand: { "@type": "Brand", name: product.brandName ?? "Geem" },
      sku: product.sku ?? product.slug,
      offers: {
        "@type": "Offer",
        url: `https://geem.pk/shop/products/${product.slug}`,
        priceCurrency: "PKR",
        price: effectivePrice,
        availability: product.stockCount > 0
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
        seller: { "@type": "Organization", name: "Geem.pk" },
      },
    } : undefined,
  });

  if (isLoading) return <ShopLayout><div className="flex justify-center py-20 text-muted-foreground">Loading...</div></ShopLayout>;
  if (!product) return <ShopLayout><div className="flex justify-center py-20 text-muted-foreground">Product not found</div></ShopLayout>;

  function handleAddToCart() {
    if (!product) return;
    addToCart({ productId: product.id, title: product.title, price: effectivePrice, qty, image: product.featuredImage, slug: product.slug });
    toast({ title: `Added to cart — ${product.title}` });
  }

  function handleBuyNow() {
    handleAddToCart();
    navigate("/shop/checkout");
  }

  return (
    <ShopLayout>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <Link href="/shop/products"><Button variant="ghost" size="sm" className="mb-6"><ArrowLeft className="h-4 w-4 mr-1" />Back to Products</Button></Link>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          {/* Image Gallery */}
          <div className="space-y-3">
            <div className="aspect-square bg-gray-50 rounded-2xl overflow-hidden border">
              {allImages.length > 0 && !imgFailed ? (
                <img
                  src={allImages[activeImg]}
                  alt={product.title}
                  className="w-full h-full object-cover"
                  onError={() => setImgFailed(true)}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package className="h-24 w-24 text-muted-foreground opacity-20" />
                </div>
              )}
            </div>
            {allImages.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {allImages.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveImg(i)}
                    className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors ${i === activeImg ? "border-primary" : "border-transparent"}`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Details */}
          <div className="space-y-5">
            <div>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                {product.brandName && <Badge variant="outline">{product.brandName}</Badge>}
                {product.categoryName && <Badge variant="secondary">{product.categoryName}</Badge>}
                {product.sku && <span className="text-xs text-muted-foreground font-mono">SKU: {product.sku}</span>}
              </div>
              <h1 className="text-3xl font-bold leading-tight">{product.title}</h1>
              {product.shortDescription && <p className="text-muted-foreground mt-2 leading-relaxed">{product.shortDescription}</p>}
            </div>

            {/* Price */}
            <div>
              {product.hidePrice ? (
                <div className="space-y-2">
                  <a
                    href="#"
                    onClick={(e) => { e.preventDefault(); openWhatsApp(GEEM_WA, `Hi, I'd like to know the price of: ${product.title}`); }}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-green-500 hover:bg-green-600 text-white font-bold text-lg transition-colors"
                  >
                    <MessageCircle className="h-5 w-5" />Get Price on WhatsApp
                  </a>
                  <p className="text-sm text-muted-foreground">Contact us for the latest price and availability</p>
                </div>
              ) : product.salePrice ? (
                <div className="flex flex-wrap items-baseline gap-2 sm:gap-3">
                  <p className="text-3xl sm:text-4xl font-bold text-primary">Rs {product.salePrice.toLocaleString()}</p>
                  <p className="text-lg sm:text-xl text-muted-foreground line-through">Rs {product.price.toLocaleString()}</p>
                  <Badge className="bg-red-500 text-white text-sm">
                    {discount(product.price, product.salePrice)}% OFF
                  </Badge>
                </div>
              ) : (
                <p className="text-3xl sm:text-4xl font-bold text-primary">Rs {product.price.toLocaleString()}</p>
              )}
              {!product.hidePrice && <p className="text-sm text-muted-foreground mt-1">Inclusive of all taxes • Free shipping on orders above Rs 10,000</p>}
            </div>

            {/* Stock */}
            <div>
              {product.stockCount > 0 ? (
                <Badge className="bg-green-500 text-white"><CheckCircle className="h-3 w-3 mr-1" />In Stock ({product.stockCount} available)</Badge>
              ) : (
                <Badge className="bg-primary/10 text-primary border border-primary/30">On Demand — Available to Order</Badge>
              )}
            </div>

            {product.stockCount > 0 ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Label className="text-sm font-medium">Quantity</Label>
                  <div className="flex items-center border rounded-lg overflow-hidden">
                    <Button variant="ghost" size="sm" className="h-9 px-3 rounded-none" onClick={() => setQty(q => Math.max(1, q - 1))}>−</Button>
                    <span className="w-10 text-center text-sm font-bold">{qty}</span>
                    <Button variant="ghost" size="sm" className="h-9 px-3 rounded-none" onClick={() => setQty(q => Math.min(product.stockCount, q + 1))}>+</Button>
                  </div>
                  <span className="text-sm text-muted-foreground">= Rs {(effectivePrice * qty).toLocaleString()}</span>
                </div>

                <div className="flex gap-3">
                  <Button size="lg" className="flex-1" onClick={handleBuyNow}>
                    <Zap className="h-4 w-4 mr-2" />Buy Now
                  </Button>
                  <Button size="lg" variant="outline" className="flex-1" onClick={handleAddToCart}>
                    <ShoppingCart className="h-4 w-4 mr-2" />Add to Cart
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">This item is available on demand. Contact us for pricing and lead time.</p>
                <div className="flex gap-3">
                  <Button size="lg" className="flex-1 bg-green-600 hover:bg-green-700 text-white" onClick={() => openWhatsApp(GEEM_WA, `I'd like to get a price for: ${product.title}`)}>
                    <MessageCircle className="h-4 w-4 mr-2" />Get Price on WhatsApp
                  </Button>
                  <Button size="lg" variant="outline" className="flex-1" asChild>
                    <a href="tel:+923078680005">
                      <Phone className="h-4 w-4 mr-2" />Call Us
                    </a>
                  </Button>
                </div>
              </div>
            )}

            {/* Trust badges */}
            <div className="grid grid-cols-3 gap-3 border rounded-xl p-4 bg-gray-50">
              <div className="text-center text-xs">
                <Shield className="h-5 w-5 mx-auto mb-1 text-primary" />
                <p className="font-medium">Genuine Product</p>
              </div>
              <div className="text-center text-xs">
                <Truck className="h-5 w-5 mx-auto mb-1 text-primary" />
                <p className="font-medium">Fast Delivery</p>
              </div>
              <div className="text-center text-xs">
                <CheckCircle className="h-5 w-5 mx-auto mb-1 text-primary" />
                <p className="font-medium">After-Sale Support</p>
              </div>
            </div>

            {/* Tags */}
            {product.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 items-center">
                <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                {product.tags.map(tag => (
                  <Link key={tag} href={`/shop/products?search=${encodeURIComponent(tag)}`}>
                    <span className="text-xs px-2 py-1 bg-gray-100 rounded-full hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer">{tag}</span>
                  </Link>
                ))}
              </div>
            )}

            {product.longDescription && (
              <div className="border-t pt-5">
                <h2 className="font-bold text-base mb-3">Product Details & Specifications</h2>
                <div className="text-muted-foreground text-sm leading-relaxed prose prose-sm max-w-none [&_h3]:font-semibold [&_h3]:text-foreground [&_h3]:mt-4 [&_h3]:mb-2 [&_strong]:text-foreground [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_li]:leading-snug" dangerouslySetInnerHTML={{ __html: product.longDescription }} />
              </div>
            )}
          </div>
        </div>
      </div>
    </ShopLayout>
  );
}
