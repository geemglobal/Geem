import { useState } from "react";
import { openWhatsApp, GEEM_WA } from "@/lib/whatsapp";
import { ShopLayout } from "./ShopLayout";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, MessageCircle, Shield } from "lucide-react";
import { useSEO } from "@/hooks/useSEO";

const FAQS = [
  {
    category: "Orders & Delivery",
    items: [
      { q: "How long does delivery take?", a: "We deliver within 2–5 business days to most cities in Pakistan. Karachi, Lahore, and Islamabad typically receive orders within 2–3 days. Remote areas (Balochistan, FATA) may take up to 5–7 days." },
      { q: "Do you ship in discreet packaging?", a: "Yes — all orders are shipped in plain, unmarked brown boxes or padded envelopes with no branding, product names, or description on the outside. Your privacy is our priority. The sender name on the waybill is simply 'Geem'." },
      { q: "What courier services do you use?", a: "We ship via TCS, Leopards Courier, and Pakistan Post. You'll receive your tracking number via WhatsApp/SMS once your order is dispatched." },
      { q: "Is same-day delivery available?", a: "Same-day delivery is available in Karachi only for orders placed before 12 PM. Additional charges apply. Contact us on WhatsApp to arrange." },
      { q: "What is the delivery charge?", a: "Standard delivery is Rs 200 flat. Orders above Rs 5,000 qualify for free delivery. For bulk/agency orders, we discuss delivery terms separately." },
      { q: "How do I track my order?", a: "Visit our Track Order page and enter your order number (starts with ORD-). For courier tracking, use the waybill number we send via WhatsApp." },
    ],
  },
  {
    category: "Security & Surveillance Products",
    items: [
      { q: "Are your spy cameras and surveillance devices legal in Pakistan?", a: "The devices we sell are legal to purchase and own in Pakistan. However, their use is subject to Pakistani laws governing privacy and surveillance. Devices should only be used in lawful contexts — for example, monitoring your own property, personal security, or professionally authorised operations. Using surveillance equipment to record individuals without consent in private settings may constitute a legal offence. Customers are solely responsible for ensuring lawful use." },
      { q: "What brands of surveillance equipment do you carry?", a: "We are an authorised dealer for Lawmate — one of the world's most respected professional surveillance equipment brands. We also carry Yuntrack and Micodus GPS trackers, as well as equipment from several other professional security equipment manufacturers. All products are 100% genuine." },
      { q: "Do RF detectors and bug sweepers actually work?", a: "Professional-grade RF detectors and TSCM tools from reputable brands are genuinely effective at detecting wireless transmitters, hidden cameras, GPS trackers, and listening devices. Consumer-grade 'bug detectors' from unknown brands are often unreliable. All the RF detection equipment we sell is professional grade with verified detection performance." },
      { q: "Can you supply night-vision or thermal imaging devices?", a: "Yes — night vision monoculars, binoculars, thermal cameras, and helmet-mounted night vision units can be sourced through our on-demand import service. Contact us on WhatsApp with your specifications and we'll provide a quote and lead time." },
      { q: "What GPS trackers do you recommend for vehicle tracking?", a: "For vehicles, we recommend Yuntrack and Micodus hardwired GPS trackers — they are compact, reliable, and widely supported in Pakistan. For covert placement without wiring, we carry battery-powered magnetic GPS trackers. Contact us to discuss your specific requirements." },
      { q: "Do you sell encrypted communication devices?", a: "Yes. We supply encrypted walkie-talkies, covert earpieces, and tactical communication kits. For more specialised encrypted communication systems, we offer on-demand import from international manufacturers." },
    ],
  },
  {
    category: "Agency & Bulk Orders",
    items: [
      { q: "Can you supply security equipment for a government agency or law enforcement unit?", a: "Absolutely. We supply security and intelligence equipment to government agencies, law enforcement, and public sector organisations in Pakistan. For official procurement, we can provide formal quotations, invoices, and documentation. Contact our agency relations team on WhatsApp or at info@geem.pk." },
      { q: "What is your on-demand import service?", a: "If a product you need isn't in our catalog, we can procure it directly from international manufacturers and importers. We handle the full import process including sourcing, international shipping, customs clearance (where applicable), and final delivery to you. Lead times typically range from 2–6 weeks depending on origin and product availability." },
      { q: "Do you offer bulk pricing?", a: "Yes. We offer competitive bulk pricing for orders of 5+ units of the same product, and project-based pricing for large-scale security installations. Contact us for a custom quote." },
      { q: "Can you install surveillance and security systems?", a: "We supply equipment with full technical documentation and setup support. For large-scale CCTV or integrated security system installations, we can connect you with our network of certified installation partners in Karachi, Lahore, and Islamabad." },
    ],
  },
  {
    category: "Payment & Returns",
    items: [
      { q: "What payment methods do you accept?", a: "We accept Cash on Delivery (COD) for orders below Rs 15,000, JazzCash, Easypaisa, Bank Transfer, and advance payment via online banking. For agency/corporate orders, we issue invoices with agreed payment terms." },
      { q: "Can I return a product?", a: "Yes, we offer a 7-day return policy on products in original, unopened condition. For technical/electronic items, returns are accepted within 7 days if the product is defective or not as described. See our Returns Policy for full details." },
      { q: "What if I receive a defective device?", a: "Contact us within 48 hours with your order number and a photo/video clearly showing the defect. We will arrange a replacement or full refund. For GPS trackers and surveillance cameras, our technical team can also assist with initial troubleshooting to rule out setup issues." },
      { q: "Is there a warranty on products?", a: "All products carry a minimum 6-month manufacturer warranty. Many items carry 1-year warranty. The warranty covers manufacturing defects and hardware failures. It does not cover physical damage, water ingress, or damage from incorrect use." },
    ],
  },
  {
    category: "Technical Support",
    items: [
      { q: "How do I set up my GPS tracker?", a: "All Yuntrack and Micodus trackers come with detailed Urdu/English setup guides. We also provide free phone/WhatsApp setup support. Call or WhatsApp us and our technical team will guide you through the process, including SIM card installation and app configuration." },
      { q: "Which app do I use for my GPS tracker?", a: "Yuntrack devices use the Yuntrack app (iOS & Android). Micodus devices use the Micodus GPS app. Detailed app download links and configuration instructions are included with every tracker." },
      { q: "How do I use the Lawmate surveillance equipment?", a: "Lawmate products come with comprehensive user manuals. We also provide product-specific setup support via WhatsApp. For larger Lawmate systems, we can arrange professional demonstration sessions in Karachi." },
      { q: "I've found a hidden camera — how do I know it's working?", a: "For RF-emitting cameras (Wi-Fi or wireless), use an RF detector in the 900 MHz–5.8 GHz range. For wired or non-transmitting cameras, use a camera lens detector that identifies the lens reflection. We can help you select the right counter-surveillance tool for your situation." },
    ],
  },
];

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border rounded-xl overflow-hidden">
      <button className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors gap-3" onClick={() => setOpen(!open)}>
        <span className="font-medium text-sm leading-snug">{q}</span>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground flex-shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
      </button>
      {open && <div className="px-4 pb-4 text-sm text-muted-foreground leading-relaxed border-t pt-3 bg-gray-50/50">{a}</div>}
    </div>
  );
}

export default function FAQ() {
  const [activeCategory, setActiveCategory] = useState("all");

  useSEO({
    title: "FAQ — Security Equipment, Spy Cameras & GPS Trackers | Geem Pakistan",
    description: "Frequently asked questions about our security equipment, spy cameras, GPS trackers, RF detectors, and agency import service. Pakistan-wide delivery.",
    keywords: "security equipment FAQ Pakistan, spy camera FAQ Pakistan, GPS tracker FAQ Pakistan, RF detector FAQ, bug sweeper Pakistan",
  });

  return (
    <ShopLayout>
      <div className="bg-gray-950 text-white py-16">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <Shield className="h-12 w-12 text-primary mx-auto mb-4" />
          <h1 className="text-5xl font-bold mb-4">Frequently Asked Questions</h1>
          <p className="text-xl text-gray-300">Everything you need to know about our products, services, and how we work.</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="flex gap-2 flex-wrap mb-8 justify-center">
          <Button variant={activeCategory === "all" ? "default" : "outline"} size="sm" onClick={() => setActiveCategory("all")}>All Questions</Button>
          {FAQS.map(f => (
            <Button key={f.category} variant={activeCategory === f.category ? "default" : "outline"} size="sm" onClick={() => setActiveCategory(f.category)}>
              {f.category}
            </Button>
          ))}
        </div>

        <div className="space-y-8">
          {FAQS.filter(f => activeCategory === "all" || f.category === activeCategory).map(section => (
            <div key={section.category}>
              <h2 className="font-bold text-lg mb-4 text-primary">{section.category}</h2>
              <div className="space-y-2">
                {section.items.map(item => <FAQItem key={item.q} q={item.q} a={item.a} />)}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 bg-gray-950 rounded-2xl p-8 text-center text-white">
          <Shield className="h-10 w-10 text-primary mx-auto mb-3" />
          <h3 className="font-bold text-xl mb-2">Still have questions?</h3>
          <p className="text-gray-300 mb-6">Our security equipment specialists are available Mon–Sat, 9AM–5PM PKT.</p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Button className="bg-green-700 hover:bg-green-600" onClick={() => openWhatsApp(GEEM_WA)}><MessageCircle className="h-4 w-4 mr-2" />WhatsApp Us</Button>
            <Link href="/shop/contact"><Button variant="outline" className="border-gray-600 text-white hover:bg-gray-800">Contact Form</Button></Link>
          </div>
        </div>
      </div>
    </ShopLayout>
  );
}
