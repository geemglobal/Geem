import { ShopLayout } from "./ShopLayout";
import { openWhatsApp, GEEM_WA } from "@/lib/whatsapp";
import { useSEO } from "@/hooks/useSEO";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Shield, Truck, Award, Users, MapPin, Phone, Mail,
  CheckCircle2, Star, MessageCircle, Package, Zap, Lock,
} from "lucide-react";

const VALUES = [
  { icon: Shield, title: "Military-Grade Authenticity",   desc: "Every product we sell is genuine, professionally sourced from authorised manufacturers and distributors worldwide. No counterfeits — ever." },
  { icon: Truck,  title: "Discreet Nationwide Delivery",  desc: "All orders dispatched in plain, unmarked packaging. We understand the sensitivity of our clients' requirements and protect your privacy at every step." },
  { icon: Award,  title: "Authorised Distributor",        desc: "Authorised distributor for Lawmate, Yuntrack, Micodus, and several other professional security and surveillance brands in Pakistan." },
  { icon: Users,  title: "Agency & Corporate Solutions",  desc: "We serve government agencies, law enforcement, private security firms, corporate investigation teams, and defence contractors across Pakistan." },
  { icon: Zap,    title: "On-Demand Custom Import",       desc: "If a device isn't in our catalog, we import it. We source specialised security and intelligence equipment from international manufacturers on request." },
  { icon: Lock,   title: "Operational Confidentiality",   desc: "We take client confidentiality seriously. Your order details, identity, and operational requirements are never disclosed to third parties." },
];

const TEAM = [
  { name: "Operations Team",   role: "Procurement & Logistics",      bio: "Experienced professionals managing international sourcing, customs clearance, and nationwide distribution of security equipment." },
  { name: "Technical Support", role: "Product Specialists",           bio: "In-house specialists trained on every product category — from RF detection and counter-surveillance to encrypted communications." },
  { name: "Agency Relations",  role: "Government & Corporate Sales",  bio: "Dedicated team managing relationships with security agencies, law enforcement, and corporate clients across Pakistan." },
];

export default function About() {
  useSEO({
    title: "About Geem — Pakistan's Military-Grade Security Equipment Supplier",
    description: "Geem is Pakistan's specialist supplier of military-grade security equipment, spy cameras, GPS trackers, RF detectors, and counter-surveillance devices. Custom imports for security agencies.",
    keywords: "security equipment supplier Pakistan, spy camera supplier Pakistan, surveillance equipment Pakistan, GPS tracker supplier Pakistan, security agency equipment Pakistan",
  });

  return (
    <ShopLayout>
      {/* Hero */}
      <section className="bg-gray-950 text-white py-24">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <Shield className="h-16 w-16 text-primary mx-auto mb-6 opacity-90" />
          <h1 className="text-5xl font-black mb-5 tracking-tight">Pakistan's Specialist<br />Security Equipment Supplier</h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto leading-relaxed">
            Geem supplies military-grade security and surveillance equipment to professionals, agencies, and businesses across Pakistan — from spy cameras and GPS trackers to counter-surveillance and covert communications.
          </p>
        </div>
      </section>

      {/* Stats strip */}
      <section className="bg-primary text-primary-foreground py-8">
        <div className="max-w-4xl mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[["500+", "Products Stocked"], ["Est. 2013", "In Business Since"], ["50+", "Cities Served"], ["200+", "Agencies & Professionals"]].map(([val, label]) => (
            <div key={label}>
              <p className="text-3xl font-black">{val}</p>
              <p className="text-sm opacity-80 mt-1">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Story */}
      <section className="max-w-5xl mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-start">
          <div>
            <h2 className="text-3xl font-bold mb-5">Our Story</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Geem was established in Bahawalpur with a clear mission: to bring professional-grade security, surveillance, and intelligence equipment to the Pakistani market at honest prices.
            </p>
            <p className="text-muted-foreground leading-relaxed mb-4">
              We identified a critical gap — security agencies, law enforcement, and corporate investigators in Pakistan were struggling to source genuine, reliable surveillance equipment locally. Most were forced to rely on unverified grey-market imports or substandard consumer-grade alternatives.
            </p>
            <p className="text-muted-foreground leading-relaxed mb-4">
              We changed that. Geem now operates as an authorised importer and distributor for leading global security equipment brands, serving clients from Karachi to Peshawar.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Our on-demand import service means that even the most specialised TSCM, counter-intelligence, or tactical equipment can be sourced, cleared through customs, and delivered to your door.
            </p>
          </div>
          <div className="space-y-4">
            <div className="bg-gray-950 text-white rounded-2xl p-6">
              <h3 className="font-bold text-lg mb-4 text-primary">Who We Serve</h3>
              <ul className="space-y-3">
                {[
                  "Government security agencies",
                  "Law enforcement & investigation teams",
                  "Private security companies",
                  "Corporate security & compliance departments",
                  "Defence contractors & consultants",
                  "Journalists & investigative reporters",
                  "Privacy-conscious individuals",
                ].map(item => (
                  <li key={item} className="flex items-center gap-2 text-sm text-gray-300">
                    <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />{item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="border-2 border-primary rounded-2xl p-6 text-center">
              <Star className="h-8 w-8 text-yellow-500 fill-yellow-500 mx-auto mb-2" />
              <p className="text-2xl font-black text-primary">4.9 / 5.0</p>
              <p className="text-sm text-muted-foreground mt-1">Average client satisfaction rating from verified purchasers</p>
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="bg-gray-50 py-16">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-3">Our Operating Principles</h2>
          <p className="text-center text-muted-foreground mb-10 max-w-xl mx-auto">What sets Geem apart from ordinary electronics retailers.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {VALUES.map(v => (
              <div key={v.title} className="bg-white rounded-xl p-6 shadow-sm border hover:border-primary transition-colors">
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4">
                  <v.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-bold mb-2">{v.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="max-w-5xl mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center mb-10">Our Team</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {TEAM.map(t => (
            <div key={t.name} className="bg-white border-2 rounded-xl p-6 text-center hover:border-primary transition-colors">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="h-8 w-8 text-primary" />
              </div>
              <h3 className="font-bold text-lg">{t.name}</h3>
              <p className="text-sm text-primary font-medium mb-3">{t.role}</p>
              <p className="text-sm text-muted-foreground leading-relaxed">{t.bio}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Contact */}
      <section className="bg-gray-950 text-white py-16">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-10">Contact &amp; Location</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center mb-8">
            {[
              { icon: MapPin, title: "Address",           lines: ["Office #1, Yellow Building, Behind TCS Office", "Kutchery Rd, Ahmadpur East, Bahawalpur 63350"] },
              { icon: Phone,  title: "Phone / WhatsApp",  lines: ["0307-8680005", "Mon–Sat: 9AM–5PM PKT"] },
              { icon: Mail,   title: "Email",             lines: ["info@geem.pk  |  order@geem.pk", "support@geem.pk"] },
            ].map(c => (
              <div key={c.title} className="bg-gray-800 rounded-xl p-6">
                <c.icon className="h-8 w-8 text-primary mx-auto mb-3" />
                <h3 className="font-bold mb-2">{c.title}</h3>
                {c.lines.map(l => <p key={l} className="text-sm text-gray-300">{l}</p>)}
              </div>
            ))}
          </div>
          <div className="text-center flex flex-wrap justify-center gap-3">
            <Button className="bg-green-700 hover:bg-green-600" onClick={() => openWhatsApp(GEEM_WA)}><MessageCircle className="h-4 w-4 mr-2" />WhatsApp Us</Button>
            <Link href="/shop/contact">
              <Button variant="outline" className="border-gray-600 text-white hover:bg-gray-800">
                <Package className="h-4 w-4 mr-2" />Agency Inquiry
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </ShopLayout>
  );
}
