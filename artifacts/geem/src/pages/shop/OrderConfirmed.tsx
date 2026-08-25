import { ShopLayout } from "./ShopLayout";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Package, Search, ArrowRight } from "lucide-react";

export default function OrderConfirmed() {
  const params = new URLSearchParams(window.location.search);
  const orderNumber = params.get("order") ?? "";
  const total = params.get("total") ?? "0";

  return (
    <ShopLayout>
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <div className="relative inline-block mb-6">
          <CheckCircle2 className="h-24 w-24 text-green-500" />
        </div>
        <h1 className="text-4xl font-bold mb-2">Order Confirmed!</h1>
        <p className="text-muted-foreground text-lg mb-8">Thank you for your purchase. We'll process your order shortly.</p>

        <div className="bg-green-50 border border-green-200 rounded-2xl p-6 mb-8">
          <p className="text-sm text-muted-foreground mb-1">Your Order Number</p>
          <p className="text-3xl font-bold font-mono text-green-700 tracking-wider">{orderNumber}</p>
          <p className="text-sm text-muted-foreground mt-2">Total Paid: <span className="font-bold text-foreground">Rs {parseFloat(total).toLocaleString()}</span></p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-8 text-left text-sm space-y-2">
          <p className="font-semibold text-blue-800">What happens next?</p>
          <p className="text-blue-700">1. Our team will confirm your order within 1–2 hours</p>
          <p className="text-blue-700">2. Your order will be dispatched within 24 hours</p>
          <p className="text-blue-700">3. You'll receive your delivery in 2–5 business days</p>
          <p className="text-blue-700 font-medium">Save your order number to track delivery status</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href={`/shop/track?order=${orderNumber}`}>
            <Button size="lg" className="w-full sm:w-auto">
              <Search className="h-4 w-4 mr-2" />Track Order
            </Button>
          </Link>
          <Link href="/shop/products">
            <Button variant="outline" size="lg" className="w-full sm:w-auto">
              <Package className="h-4 w-4 mr-2" />Continue Shopping
            </Button>
          </Link>
        </div>

        <div className="mt-8 pt-6 border-t text-sm text-muted-foreground">
          <p>Questions? <Link href="/shop/contact"><span className="text-primary hover:underline cursor-pointer">Contact Us</span></Link> or WhatsApp us at <strong>0307-8680005</strong></p>
        </div>
      </div>
    </ShopLayout>
  );
}
