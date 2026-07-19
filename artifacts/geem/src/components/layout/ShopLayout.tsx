import { Link } from "wouter";

export function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header className="h-16 border-b border-border bg-card flex items-center px-8 justify-between sticky top-0 z-50">
        <Link href="/shop" className="text-2xl font-bold tracking-tight text-primary">Geem ERP</Link>
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
