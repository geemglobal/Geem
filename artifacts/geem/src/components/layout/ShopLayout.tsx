import { Link } from "wouter";
import { useShopBranding } from "@/lib/shopBranding";

export function ShopLayout({ children }: { children: React.ReactNode }) {
  const branding = useShopBranding();
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header className="h-16 border-b border-border bg-card flex items-center px-8 justify-between sticky top-0 z-50">
        <Link href="/shop" className="flex items-center gap-2">
          <img src={branding.logo ?? "/icon-192.png"} alt="Geem" className="h-8 w-auto" />
          <span className="text-xl font-bold tracking-tight text-primary">Geem Shop</span>
        </Link>
        <nav className="flex gap-6 items-center">
          <Link href="/shop" className="text-sm font-medium hover:text-primary">Home</Link>
          <Link href="/shop/track" className="text-sm font-medium hover:text-primary">Track Order</Link>
          <Link href="/shop/cart" className="text-sm font-medium hover:text-primary">Cart</Link>
        </nav>
      </header>
      <main className="flex-1 w-full max-w-7xl mx-auto p-8">
        {children}
      </main>
      <footer className="py-8 border-t border-border mt-auto bg-card text-center text-sm text-muted-foreground">
        &copy; {new Date().getFullYear()} Geem Mobile. All rights reserved.
      </footer>
    </div>
  );
}
