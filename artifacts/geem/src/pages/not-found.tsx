import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Home, ShoppingBag, Search, ArrowLeft } from "lucide-react";
import { ShopLayout } from "./shop/ShopLayout";

export default function NotFound() {
  const isShopPath = typeof window !== "undefined" && window.location.pathname.startsWith("/shop");

  const content = (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 text-center py-20">
      <div className="text-9xl font-black text-primary/15 mb-4 leading-none select-none">404</div>
      <h1 className="text-3xl font-bold mb-3">Page Not Found</h1>
      <p className="text-muted-foreground max-w-md mb-8">
        The page you're looking for doesn't exist. It may have been moved, deleted, or never existed.
      </p>
      <div className="flex flex-wrap gap-3 justify-center">
        <Link href="/shop">
          <Button><Home className="h-4 w-4 mr-2" />Go to Shop</Button>
        </Link>
        <Link href="/shop/products">
          <Button variant="outline"><ShoppingBag className="h-4 w-4 mr-2" />Browse Products</Button>
        </Link>
        <Link href="/shop/track">
          <Button variant="outline"><Search className="h-4 w-4 mr-2" />Track Order</Button>
        </Link>
      </div>
      <button
        onClick={() => window.history.back()}
        className="mt-6 text-sm text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />Go back
      </button>
    </div>
  );

  if (isShopPath) {
    return <ShopLayout>{content}</ShopLayout>;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      {content}
    </div>
  );
}
