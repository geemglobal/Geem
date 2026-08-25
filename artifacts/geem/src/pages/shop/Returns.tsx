import { ShopLayout } from "./ShopLayout";
import { openWhatsApp, GEEM_WA } from "@/lib/whatsapp";
import { Link } from "wouter";
import { CheckCircle2, XCircle, ArrowRight, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSEO } from "@/hooks/useSEO";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-xl font-bold mb-3">{title}</h2>
      <div className="text-muted-foreground leading-relaxed space-y-3">{children}</div>
    </section>
  );
}

export default function Returns() {
  useSEO({ title: "Returns & Refund Policy | Geem Security Equipment Pakistan", description: "Return and refund policy for security equipment, spy cameras, GPS trackers, and surveillance devices purchased from Geem in Pakistan." });

  return (
    <ShopLayout>
      <div className="bg-gray-950 text-white py-14">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <Shield className="h-10 w-10 text-primary mx-auto mb-4" />
          <h1 className="text-4xl font-bold mb-3">Return, Refund &amp; Exchange Policy</h1>
          <p className="text-gray-300 text-lg">We stand behind every product we sell.</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-12">
        {/* Quick summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-green-700">7 Days</p>
            <p className="text-sm text-green-700 mt-1">Standard Return Window</p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-blue-700">3–5 Days</p>
            <p className="text-sm text-blue-700 mt-1">Refund Processing Time</p>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-purple-700">Free</p>
            <p className="text-sm text-purple-700 mt-1">Return Shipping (Defects)</p>
          </div>
        </div>

        <Section title="Return Eligibility">
          <p>You may return a product within <strong>7 days of delivery</strong> under the following conditions:</p>
          <div className="space-y-2 mt-3">
            {[
              "The product is defective, not working, or materially different from description",
              "You received the wrong item",
              "The product is unused and in its original, sealed packaging with all accessories",
              "The serial number / IMEI sticker and all security seals are intact and unbroken",
            ].map(item => (
              <div key={item} className="flex items-start gap-2 text-green-700">
                <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5" /><span className="text-sm">{item}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Non-Returnable Items">
          <p>The following cannot be returned (except where required by law):</p>
          <div className="space-y-2">
            {[
              "Opened or used products unless defective",
              "Products with tampered, scratched, or removed serial number / IMEI stickers",
              "Products showing physical damage (drops, cracks, water ingress)",
              "Items returned after 7 days from the confirmed delivery date",
              "Custom-imported items (procured specifically for your order)",
              "Items not purchased from Geem",
              "Products where the original packaging has been discarded",
            ].map(item => (
              <div key={item} className="flex items-start gap-2 text-red-600">
                <XCircle className="h-4 w-4 flex-shrink-0 mt-0.5" /><span className="text-sm">{item}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Special Note — Surveillance & Security Devices">
          <p>Due to the sensitive nature of surveillance equipment, opened or activated covert cameras, GPS trackers, recording devices, and RF detection equipment can only be returned if they are demonstrably defective (with video evidence of the fault). We cannot accept returns of working devices that have been opened, configured, or used — this is necessary to protect the privacy and security of all parties.</p>
        </Section>

        <Section title="How to Initiate a Return">
          <ol className="list-decimal list-inside space-y-2 ml-2">
            <li>Contact us within 7 days of delivery via WhatsApp <strong>0307-8680005</strong> or email <strong>support@geem.pk</strong></li>
            <li>Provide your order number, reason for return, and clear photos/video of the issue</li>
            <li>Our team will review your request within 24 business hours</li>
            <li>If approved for defective items, we will arrange courier collection at no charge to you</li>
            <li>For change-of-mind returns (unused/sealed), you return the item at your shipping cost</li>
            <li>Upon receipt and inspection, we process your refund or exchange within 3–5 business days</li>
          </ol>
        </Section>

        <Section title="Refund Process">
          <p>Refunds are processed within <strong>3–5 business days</strong> after we receive and inspect the returned item.</p>
          <p>Refund methods available:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li><strong>COD orders:</strong> Bank transfer or EasyPaisa / JazzCash to your number</li>
            <li><strong>Advance payment orders:</strong> Refunded to your original payment method or bank account</li>
          </ul>
          <p>The Rs 200 delivery charge is non-refundable unless the return is due to a defective product or our fulfilment error.</p>
        </Section>

        <Section title="Exchange Policy">
          <p>We offer free exchanges for confirmed defective products within the warranty period. If you wish to exchange for a different model or category, price differences apply and availability is subject to stock. Contact us on WhatsApp to check availability before initiating an exchange request.</p>
        </Section>

        <Section title="Warranty Claims">
          <p>All products carry a manufacturer warranty (minimum 6 months, most items 12 months). To file a warranty claim:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Contact us with your original order number and device serial number / IMEI</li>
            <li>Provide a clear description and video/photo evidence of the fault</li>
            <li>Confirm the date of purchase and that the device has not been physically damaged or modified</li>
          </ul>
          <p>Warranty covers manufacturing defects only. It does not cover physical damage, water ingress, voltage damage, unauthorised modification, or damage from incorrect use or incorrect SIM configuration (for GPS trackers).</p>
        </Section>

        <div className="bg-gray-950 text-white rounded-2xl p-6 text-center mt-8">
          <Shield className="h-8 w-8 text-primary mx-auto mb-3" />
          <h3 className="font-bold text-lg mb-2">Need to start a return?</h3>
          <p className="text-gray-300 mb-4">Contact us on WhatsApp or email and we'll guide you through the process.</p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Button className="bg-green-700 hover:bg-green-600" onClick={() => openWhatsApp(GEEM_WA)}>Start a Return <ArrowRight className="h-4 w-4 ml-2" /></Button>
            <Link href="/shop/contact">
              <Button variant="outline" className="border-gray-600 text-white hover:bg-gray-800">Contact Us</Button>
            </Link>
          </div>
        </div>
      </div>
    </ShopLayout>
  );
}
