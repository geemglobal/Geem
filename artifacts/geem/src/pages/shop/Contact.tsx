import { useState } from "react";
import { openWhatsApp, GEEM_WA } from "@/lib/whatsapp";
import { ShopLayout } from "./ShopLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useSEO } from "@/hooks/useSEO";
import { MapPin, Phone, Mail, MessageCircle, Clock, CheckCircle2, Shield, Package } from "lucide-react";

const SUBJECTS = [
  "General Product Inquiry",
  "Agency / Bulk Order Inquiry",
  "Custom Import Request",
  "Technical Support",
  "Order Issue or Tracking",
  "Return or Refund Request",
  "Surveillance System Installation",
  "Product Demonstration Request",
  "Pricing & Availability",
  "Other",
];

export default function Contact() {
  const { toast } = useToast();
  const [form, setForm] = useState({ name: "", email: "", mobile: "", subject: "", message: "", organisation: "" });
  const [submitted, setSubmitted] = useState(false);

  useSEO({
    title: "Contact Geem — Security Equipment Supplier Pakistan",
    description: "Contact Geem for spy cameras, RF detectors, GPS trackers, counter-surveillance equipment, and custom agency imports in Pakistan. WhatsApp or email us.",
    keywords: "contact security equipment supplier Pakistan, buy spy camera Pakistan, agency security equipment Pakistan",
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.message) {
      toast({ title: "Please fill your name and message", variant: "destructive" }); return;
    }
    setSubmitted(true);
    toast({ title: "Message sent! We'll respond within 24 hours." });
  }

  return (
    <ShopLayout>
      <div className="bg-gray-950 text-white py-16">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <Shield className="h-12 w-12 text-primary mx-auto mb-4" />
          <h1 className="text-5xl font-bold mb-4">Contact Us</h1>
          <p className="text-xl text-gray-300">Security equipment specialists ready to assist — agencies, professionals, and individuals welcome.</p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          {/* Contact Info */}
          <div className="space-y-4">
            <h2 className="font-bold text-xl mb-4">Get in Touch</h2>
            {[
              { icon: MessageCircle, label: "WhatsApp",       value: "0307-8680005",    desc: "Fastest response — product & agency inquiries", color: "text-green-600" },
              { icon: Phone,         label: "Phone",          value: "0307-8680005",    desc: "Mon–Sat: 9AM–5PM PKT",                          color: "text-blue-600" },
              { icon: Mail,          label: "General Email",  value: "info@geem.pk",    desc: "General & agency inquiries",                    color: "text-primary" },
              { icon: Mail,          label: "Orders",         value: "order@geem.pk",   desc: "Order placement & tracking",                    color: "text-blue-600" },
              { icon: Mail,          label: "Support",        value: "support@geem.pk", desc: "Technical support & order issues",               color: "text-purple-600" },
              { icon: MapPin,        label: "Location",       value: "Ahmadpur East, Bahawalpur", desc: "Office #1, Yellow Building, Behind TCS Office, Kutchery Rd", color: "text-red-600" },
              { icon: Clock,         label: "Business Hours", value: "Mon–Saturday",    desc: "9:00 AM – 5:00 PM PKT",                         color: "text-orange-600" },
            ].map(c => (
              <div key={c.label} className="flex gap-4 items-start bg-white border rounded-xl p-4">
                <div className={`p-2 rounded-lg bg-gray-50 ${c.color}`}><c.icon className="h-5 w-5" /></div>
                <div>
                  <p className="font-medium text-sm">{c.label}</p>
                  <p className="text-sm font-bold">{c.value}</p>
                  <p className="text-xs text-muted-foreground">{c.desc}</p>
                </div>
              </div>
            ))}

            <Button className="w-full bg-green-600 hover:bg-green-700 mt-2" onClick={() => openWhatsApp(GEEM_WA)}>
              <MessageCircle className="h-4 w-4 mr-2" />Chat on WhatsApp
            </Button>

            {/* Agency note */}
            <div className="bg-gray-950 text-white rounded-xl p-4 mt-2">
              <div className="flex items-center gap-2 mb-2">
                <Package className="h-4 w-4 text-primary" />
                <p className="font-semibold text-sm">Agency & Bulk Orders</p>
              </div>
              <p className="text-xs text-gray-300 leading-relaxed">
                For government agencies, law enforcement, and corporate procurement — email <strong className="text-white">order@geem.pk</strong> with your organisation name, equipment list, and quantities. We'll respond with a formal quotation within 24 hours.
              </p>
            </div>
          </div>

          {/* Contact Form */}
          <div className="lg:col-span-2 bg-white border rounded-2xl p-8 shadow-sm">
            {submitted ? (
              <div className="text-center py-12">
                <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
                <h3 className="text-2xl font-bold mb-2">Message Sent!</h3>
                <p className="text-muted-foreground mb-2">We'll respond within 24 hours.</p>
                <p className="text-sm text-muted-foreground">For urgent inquiries, contact us directly on WhatsApp: <strong>0307-8680005</strong></p>
                <Button className="mt-6" variant="outline" onClick={() => { setSubmitted(false); setForm({ name: "", email: "", mobile: "", subject: "", message: "", organisation: "" }); }}>
                  Send Another Message
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} autoComplete="on" className="space-y-5">
                <div>
                  <h2 className="font-bold text-xl mb-1">Send a Message</h2>
                  <p className="text-sm text-muted-foreground">For product inquiries, agency procurement, custom imports, or technical support.</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="contact-name">Your Name *</Label>
                    <Input id="contact-name" name="name" autoComplete="name" className="mt-1" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Full name" />
                  </div>
                  <div>
                    <Label htmlFor="contact-tel">Mobile / WhatsApp</Label>
                    <Input id="contact-tel" name="tel" autoComplete="tel" type="tel" className="mt-1" value={form.mobile} onChange={e => setForm(p => ({ ...p, mobile: e.target.value }))} placeholder="03XX-XXXXXXX" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="contact-email">Email Address</Label>
                    <Input id="contact-email" name="email" autoComplete="email" type="email" className="mt-1" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="your@email.com" />
                  </div>
                  <div>
                    <Label htmlFor="contact-org">Organisation (optional)</Label>
                    <Input id="contact-org" name="organization" autoComplete="organization" className="mt-1" value={form.organisation} onChange={e => setForm(p => ({ ...p, organisation: e.target.value }))} placeholder="Company / Agency name" />
                  </div>
                </div>
                <div>
                  <Label>Subject</Label>
                  <Select value={form.subject} onValueChange={v => setForm(p => ({ ...p, subject: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select a subject" /></SelectTrigger>
                    <SelectContent>{SUBJECTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Message *</Label>
                  <Textarea className="mt-1" rows={5} value={form.message} onChange={e => setForm(p => ({ ...p, message: e.target.value }))}
                    placeholder="Describe your requirements — product names, quantities, intended use, or any other details that help us assist you better." />
                </div>
                <Button type="submit" className="w-full" size="lg">Send Message</Button>
                <p className="text-xs text-muted-foreground text-center">All inquiries are treated with strict confidentiality.</p>
              </form>
            )}
          </div>
        </div>
      </div>
    </ShopLayout>
  );
}
