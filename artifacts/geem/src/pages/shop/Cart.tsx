import { useCart } from "@/contexts/CartContext";
import { ShopLayout } from "./ShopLayout";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Trash2, Plus, Minus, ShoppingBag, ArrowRight, Package } from "lucide-react";

export default function Cart() {
  const { cart, removeFromCart, updateQty, subtotal, shipping, total, count, clearCart } = useCart();
  const [, navigate] = useLocation();

  if (cart.length === 0) {
    return (
      <ShopLayout>
        <div className="max-w-2xl mx-auto px-4 py-20 text-center">
          <ShoppingBag className="h-20 w-20 mx-auto mb-6 text-muted-foreground opacity-30" />
          <h1 className="text-3xl font-bold mb-3">Your cart is empty</h1>
          <p className="text-muted-foreground mb-8">Looks like you haven't added anything to your cart yet.</p>
          <Link href="/shop/products">
            <Button size="lg">Browse Products <ArrowRight className="h-4 w-4 ml-2" /></Button>
          </Link>
        </div>
      </ShopLayout>
    );
  }

  return (
    <ShopLayout>
      <div className="max-w-5xl mx-auto px-4 py-10">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">Shopping Cart</h1>
          <span className="text-muted-foreground text-sm">{count} {count === 1 ? "item" : "items"}</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
            {cart.map(item => (
              <div key={item.productId} className="flex gap-4 bg-white border rounded-xl p-4 shadow-sm">
                <div className="w-24 h-24 rounded-lg overflow-hidden bg-gray-50 flex-shrink-0">
                  {item.image ? (
                    <img src={item.image} alt={item.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="h-8 w-8 text-muted-foreground opacity-30" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <Link href={`/shop/products/${item.slug}`}>
                    <h3 className="font-semibold text-sm hover:text-primary transition-colors line-clamp-2">{item.title}</h3>
                  </Link>
                  <p className="text-primary font-bold mt-1">Rs {item.price.toLocaleString()}</p>
                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center gap-2 border rounded-lg">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => updateQty(item.productId, item.qty - 1)}>
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-8 text-center text-sm font-medium">{item.qty}</span>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => updateQty(item.productId, item.qty + 1)}>
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold">Rs {(item.price * item.qty).toLocaleString()}</span>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => removeFromCart(item.productId)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            <div className="flex justify-between pt-2">
              <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={clearCart}>
                <Trash2 className="h-4 w-4 mr-2" />Clear Cart
              </Button>
              <Link href="/shop/products">
                <Button variant="outline" size="sm">Continue Shopping</Button>
              </Link>
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="bg-white border rounded-xl p-6 shadow-sm sticky top-24">
              <h2 className="font-bold text-lg mb-4">Order Summary</h2>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal ({count} items)</span>
                  <span>Rs {subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Shipping</span>
                  <span>Rs {shipping.toLocaleString()}</span>
                </div>
                <div className="border-t pt-3 flex justify-between font-bold text-base">
                  <span>Total</span>
                  <span className="text-primary">Rs {total.toLocaleString()}</span>
                </div>
              </div>
              <Button className="w-full mt-6" size="lg" onClick={() => navigate("/shop/checkout")}>
                Proceed to Checkout <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
              <p className="text-xs text-muted-foreground text-center mt-3">Free delivery on orders above Rs 5,000</p>
            </div>
          </div>
        </div>
      </div>
    </ShopLayout>
  );
}
