import { ShopLayout } from "./ShopLayout";
import { useSEO } from "@/hooks/useSEO";
import { Shield } from "lucide-react";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-xl font-bold mb-3 text-foreground">{title}</h2>
      <div className="text-muted-foreground leading-relaxed space-y-3">{children}</div>
    </section>
  );
}

export default function PrivacyPolicy() {
  useSEO({ title: "Privacy Policy | Geem Security Equipment Pakistan", description: "Geem's privacy policy covering how we collect, use, and protect your personal data when you purchase security equipment from us." });

  return (
    <ShopLayout>
      <div className="bg-gray-950 text-white py-14">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <Shield className="h-10 w-10 text-primary mx-auto mb-4" />
          <h1 className="text-4xl font-bold mb-2">Privacy Policy</h1>
          <p className="text-gray-400 text-sm">Last updated: June 2025</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="mb-8 bg-primary/5 border border-primary/20 rounded-xl p-5">
          <p className="text-sm leading-relaxed">
            <strong>Geem</strong> ("we," "us," or "our") is committed to protecting your personal information. This Privacy Policy explains how we collect, use, disclose, and safeguard your data when you use our website (geem.pk) or place an order with us. We operate in Pakistan and comply with applicable Pakistani data protection standards. Given the nature of our business — professional security and surveillance equipment — we treat your data with exceptional care and confidentiality.
          </p>
        </div>

        <Section title="1. Information We Collect">
          <p>When you place an order or contact us, we collect:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Full name, mobile number, and email address</li>
            <li>Delivery address, city, and province</li>
            <li>Organisation or agency name (if provided voluntarily)</li>
            <li>Payment transaction reference numbers (not card details — we do not store card data)</li>
            <li>Order details including product(s) purchased, quantities, and delivery instructions</li>
            <li>Device IMEI or serial numbers (for warranty registration purposes)</li>
            <li>Communications you send us via email, WhatsApp, or our contact form</li>
          </ul>
          <p>We also automatically collect technical data when you visit our website, including your IP address, browser type, device type, and pages visited. This data is used solely for security and site analytics — it is never sold or shared for marketing purposes.</p>
        </Section>

        <Section title="2. How We Use Your Information">
          <p>We use your personal information only for the following purposes:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Processing and fulfilling your order</li>
            <li>Arranging delivery via our courier partners</li>
            <li>Sending order confirmations, tracking updates, and delivery notifications via WhatsApp or SMS</li>
            <li>Handling returns, refunds, and warranty claims</li>
            <li>Responding to your inquiries and providing technical support</li>
            <li>Improving our products, services, and website</li>
            <li>Complying with legal and regulatory obligations in Pakistan</li>
          </ul>
          <p>We do <strong>not</strong> use your information for unsolicited marketing unless you have explicitly opted in. We do not profile, analyse, or sell your personal data.</p>
        </Section>

        <Section title="3. Confidentiality of Orders">
          <p>Given the professional and sensitive nature of our product range, we maintain strict operational confidentiality regarding your orders:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Order details, product types purchased, and customer identities are not disclosed to any third party beyond what is strictly necessary for delivery and payment processing.</li>
            <li>Staff with access to order information are bound by confidentiality obligations.</li>
            <li>We do not maintain public order logs or disclose customer purchasing patterns.</li>
          </ul>
        </Section>

        <Section title="4. Sharing Your Information">
          <p>We do not sell, rent, or trade your personal information. We share data only with:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li><strong>Courier partners</strong> (TCS, Leopards) — name, address, and contact number only, strictly for delivery purposes</li>
            <li><strong>Payment processors</strong> — solely to verify and complete your transaction</li>
            <li><strong>Law enforcement or regulatory authorities</strong> — only when legally compelled by valid Pakistani court order or law enforcement request with proper legal authority</li>
          </ul>
          <p>We will notify you if we receive a legal request for your data, to the extent permitted by law.</p>
        </Section>

        <Section title="5. Data Security">
          <p>We implement industry-standard security measures to protect your personal information:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>All data is transmitted over encrypted HTTPS connections</li>
            <li>Access to customer data is restricted to authorised personnel only</li>
            <li>Order systems are protected by strong authentication</li>
            <li>We do not store complete payment card numbers — all payment processing uses third-party secure payment gateways</li>
          </ul>
        </Section>

        <Section title="6. Data Retention">
          <p>We retain your order information for a minimum of <strong>5 years</strong> for warranty, accounting, and legal compliance purposes under Pakistani commercial law. You may request deletion of your personal data for marketing purposes at any time. Order records required for legal compliance cannot be deleted within the retention period.</p>
        </Section>

        <Section title="7. Your Rights">
          <p>You have the right to:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Access the personal information we hold about you</li>
            <li>Request corrections to inaccurate or incomplete data</li>
            <li>Opt out of any marketing communications</li>
            <li>Request deletion of your data where legally permissible</li>
            <li>Know what data we've shared with third parties and for what purpose</li>
          </ul>
          <p>To exercise these rights, contact us at <strong>support@geem.pk</strong> or WhatsApp <strong>0307-8680005</strong>. We will respond within 7 business days.</p>
        </Section>

        <Section title="8. Cookies & Tracking">
          <p>Our website uses only essential functional cookies for cart and session management. We do not use advertising trackers, Facebook Pixel, Google Ads cookies, or any third-party marketing cookies. Basic analytics data (page views, general location) may be collected anonymously to improve site performance — this is never linked to your personal identity or order history.</p>
        </Section>

        <Section title="9. Children's Privacy">
          <p>Our products and services are intended for adults (18 years or older). We do not knowingly collect personal information from individuals under 18. If you believe a minor has submitted information to us, please contact us immediately and we will delete it.</p>
        </Section>

        <Section title="10. Changes to This Policy">
          <p>We may update this Privacy Policy periodically. Changes will be posted on this page with an updated effective date. Continued use of our website or services after a policy update constitutes acceptance of the revised policy. For material changes, we will notify you via email or WhatsApp if you are an existing customer.</p>
        </Section>

        <Section title="11. Contact Us — Privacy Matters">
          <p>For all privacy-related questions, data access requests, or concerns:</p>
          <p>
            <strong>Email:</strong> support@geem.pk<br />
            <strong>WhatsApp:</strong> 0307-8680005<br />
            <strong>Address:</strong> Office #1, Yellow Building, Behind TCS Office, Kutchery Rd, Ahmadpur East, Bahawalpur 63350, Pakistan
          </p>
        </Section>
      </div>
    </ShopLayout>
  );
}
