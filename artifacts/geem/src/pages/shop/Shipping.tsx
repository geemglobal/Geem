import { ShopLayout } from "./ShopLayout";
import { useSEO } from "@/hooks/useSEO";
import { Truck, Clock, MapPin, Package, Shield, Eye } from "lucide-react";

const CITIES = [
  { city: "Karachi",                 days: "1–2 business days" },
  { city: "Lahore",                  days: "2–3 business days" },
  { city: "Islamabad / Rawalpindi",  days: "2–3 business days" },
  { city: "Faisalabad",              days: "2–3 business days" },
  { city: "Multan / Bahawalpur",     days: "3–4 business days" },
  { city: "Peshawar / KPK",         days: "3–4 business days" },
  { city: "Quetta / Balochistan",   days: "4–5 business days" },
  { city: "Hyderabad / Sukkur",     days: "2–3 business days" },
  { city: "Other Cities",           days: "3–5 business days" },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-2xl font-bold mb-4">{title}</h2>
      <div className="text-muted-foreground leading-relaxed space-y-3">{children}</div>
    </section>
  );
}

export default function Shipping() {
  useSEO({ title: "Shipping & Delivery Policy | Geem Security Equipment Pakistan", description: "Shipping and delivery information for security equipment orders from Geem Pakistan. Discreet plain-packaging, nationwide delivery in 2–5 business days." });

  return (
    <ShopLayout>
      <div className="bg-gray-950 text-white py-14">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <Truck className="h-14 w-14 text-primary mx-auto mb-4" />
          <h1 className="text-5xl font-bold mb-4">Shipping &amp; Delivery</h1>
          <p className="text-xl text-gray-300">Discreet, fast, and reliable nationwide delivery.</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-12">

        {/* Highlight boxes */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          {[
            { icon: Clock,   title: "2–5 Days",      desc: "Nationwide Delivery",        color: "text-blue-600" },
            { icon: Truck,   title: "Rs 200",         desc: "Flat Delivery Fee",           color: "text-green-600" },
            { icon: Package, title: "Free Delivery",  desc: "Orders above Rs 5,000",       color: "text-purple-600" },
            { icon: Eye,     title: "Discreet",       desc: "Plain unmarked packaging",     color: "text-orange-600" },
          ].map(item => (
            <div key={item.title} className="bg-white border-2 rounded-xl p-5 text-center shadow-sm hover:border-primary transition-colors">
              <item.icon className={`h-8 w-8 mx-auto mb-2 ${item.color}`} />
              <p className="text-lg font-bold">{item.title}</p>
              <p className="text-xs text-muted-foreground mt-1">{item.desc}</p>
            </div>
          ))}
        </div>

        {/* Discreet packaging highlight */}
        <div className="bg-gray-950 text-white rounded-2xl p-6 mb-10 flex gap-4 items-start">
          <Eye className="h-8 w-8 text-primary flex-shrink-0 mt-1" />
          <div>
            <h3 className="font-bold text-lg mb-2">Discreet Packaging — Your Privacy Guaranteed</h3>
            <p className="text-gray-300 text-sm leading-relaxed">
              All orders from Geem are shipped in plain, unmarked brown boxes or padded envelopes. There is no Geem branding, no product names, and no description on the outside of the package. The sender name on the courier waybill is simply "Geem". This applies to all orders — GPS trackers, spy cameras, RF detectors, and all other equipment.
            </p>
          </div>
        </div>

        <Section title="Shipping Rates">
          <p>We offer two shipping options:</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
            <div className="border rounded-xl p-5">
              <p className="font-bold text-lg mb-1">Standard Delivery</p>
              <p className="text-2xl font-bold text-primary mb-2">Rs 200</p>
              <p className="text-sm">Nationwide delivery in 2–5 business days via TCS or Leopards Courier. Tracking number provided via WhatsApp.</p>
            </div>
            <div className="border-2 border-primary rounded-xl p-5 bg-primary/5">
              <p className="font-bold text-lg mb-1">Free Delivery 🎉</p>
              <p className="text-2xl font-bold text-green-600 mb-2">Rs 0</p>
              <p className="text-sm">On all orders above Rs 5,000. Same timeline and courier service applies.</p>
            </div>
          </div>
          <p className="text-sm mt-3">For bulk/agency orders or large consignments, delivery charges are discussed and agreed at time of order. Custom-imported items may carry additional freight charges depending on origin and weight.</p>
        </Section>

        <Section title="Estimated Delivery Times">
          <div className="overflow-hidden rounded-xl border">
            <table className="w-full text-sm">
              <thead className="bg-gray-950 text-white">
                <tr>
                  <th className="text-left p-3 font-bold">City / Region</th>
                  <th className="text-left p-3 font-bold">Estimated Delivery</th>
                </tr>
              </thead>
              <tbody>
                {CITIES.map((row, i) => (
                  <tr key={row.city} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td className="p-3 flex items-center gap-2 text-foreground"><MapPin className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />{row.city}</td>
                    <td className="p-3 font-semibold text-primary">{row.days}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs mt-3">*Delivery times are estimates. Remote and rural areas may take longer. Times may vary during peak seasons, public holidays, or adverse weather conditions.</p>
        </Section>

        <Section title="Order Processing">
          <p>Orders placed before <strong>2:00 PM (PKT)</strong> on business days (Monday–Saturday) are typically processed and dispatched the same day. Orders placed after 2 PM or on Sundays/public holidays are processed the next business day.</p>
          <p>For custom import orders, processing begins after we confirm your order, receive advance payment, and source the item from our international suppliers. Lead times for custom imports are typically <strong>2–6 weeks</strong> depending on origin, product availability, and customs clearance.</p>
          <p>You will receive a WhatsApp/SMS notification with your tracking number as soon as your order is dispatched.</p>
        </Section>

        <Section title="Courier Partners">
          <p>We use Pakistan's most reliable courier services for all shipments:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li><strong>TCS Couriers</strong> — Nationwide coverage, real-time tracking</li>
            <li><strong>Leopards Courier</strong> — Major cities and remote areas</li>
            <li><strong>Pakistan Post</strong> — Remote/rural and AJK/Gilgit-Baltistan areas</li>
          </ul>
          <p>We select the most appropriate courier for your location. For high-value or fragile equipment, we may use premium insured shipping and will notify you accordingly.</p>
        </Section>

        <Section title="Order Tracking">
          <p>Once your order is dispatched, track it using:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Our <a href="/shop/track" className="text-primary hover:underline font-medium">Order Tracking page</a> — enter your Geem order number (ORD-XXXXX)</li>
            <li>The courier's website using the tracking/waybill number we send via WhatsApp</li>
          </ul>
        </Section>

        <Section title="Delivery Attempts & Failed Delivery">
          <p>Our courier will attempt delivery up to <strong>3 times</strong>. Please ensure your mobile number is correct and reachable during delivery hours (9 AM – 6 PM). If delivery fails after 3 attempts, the package is returned to us and you'll need to arrange re-delivery at an additional shipping cost.</p>
          <p>To avoid failed delivery: ensure your address is complete and accurate, and make sure someone is available to receive the package. You can request a specific delivery date or time via WhatsApp after your order is dispatched.</p>
        </Section>

        <Section title="Damaged or Incorrect Items in Transit">
          <p>If your package arrives with visible external damage, please <strong>photograph the damage before opening</strong> and note it on the courier waybill if possible. If the item inside is damaged, contact us within <strong>24 hours</strong> of delivery at <strong>support@geem.pk</strong> or WhatsApp <strong>0307-8680005</strong> with photos/video evidence. We will arrange a replacement or full refund at no charge to you.</p>
          <p>If you receive the wrong item, contact us immediately. We will arrange collection of the incorrect item and dispatch the correct one — no additional charge.</p>
        </Section>

        <Section title="Insurance & High-Value Shipments">
          <p>All shipments are insured up to the declared value of the goods. For high-value orders (above Rs 25,000), we automatically use insured premium shipping. For very high-value or sensitive equipment, we may require signature on delivery and/or identity verification — we will contact you if this applies to your order.</p>
        </Section>

      </div>
    </ShopLayout>
  );
}
