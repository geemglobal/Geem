import { ShopLayout } from "./ShopLayout";
import { Link } from "wouter";
import { useSEO } from "@/hooks/useSEO";
import { Shield } from "lucide-react";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-xl font-bold mb-3">{title}</h2>
      <div className="text-muted-foreground leading-relaxed space-y-3">{children}</div>
    </section>
  );
}

export default function Terms() {
  useSEO({ title: "Terms & Conditions | Geem Security Equipment Pakistan", description: "Terms and conditions for purchasing security equipment, spy cameras, GPS trackers, and surveillance devices from Geem in Pakistan." });

  return (
    <ShopLayout>
      <div className="bg-gray-950 text-white py-14">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <Shield className="h-10 w-10 text-primary mx-auto mb-4" />
          <h1 className="text-4xl font-bold mb-2">Terms &amp; Conditions</h1>
          <p className="text-gray-400 text-sm">Last updated: June 2025</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="mb-8 bg-amber-50 border border-amber-200 rounded-xl p-5 text-sm text-amber-900 leading-relaxed">
          <strong>Important:</strong> By placing an order with Geem, you confirm that you have read, understood, and agreed to these Terms & Conditions. Please read them carefully before purchasing. These terms include important provisions regarding lawful use of surveillance and security equipment.
        </div>

        <Section title="1. General">
          <p>Geem operates as a specialist e-commerce business based in Ahmadpur East, Bahawalpur, Pakistan, selling professional-grade security equipment, surveillance devices, GPS tracking systems, RF detectors, counter-surveillance tools, and covert communications equipment. These terms govern your use of our website (geem.pk) and all orders placed with us.</p>
        </Section>

        <Section title="2. Eligibility & Age Requirement">
          <p>You must be at least <strong>18 years of age</strong> to place an order with Geem. By ordering, you confirm that you are of legal age. Geem reserves the right to refuse any order where there is reason to believe the buyer is a minor or is acting on behalf of a minor.</p>
        </Section>

        <Section title="3. Lawful Use of Products — Critical Clause">
          <p>All security, surveillance, and intelligence equipment sold by Geem is intended for <strong>lawful use only</strong>. By purchasing any product from Geem, you agree to the following:</p>
          <ul className="list-disc list-inside space-y-2 ml-2">
            <li>You will use the equipment in full compliance with all applicable Pakistani laws, including but not limited to the Pakistan Electronic Crimes Act (PECA) 2016, the Telecommunication (Re-organisation) Act, and all privacy and data protection regulations.</li>
            <li>You will not use surveillance equipment to secretly record, monitor, or track any individual without their informed consent, except where you are legally authorised to do so (e.g. law enforcement with proper warrant, monitoring your own minor children, or monitoring activity on your own property).</li>
            <li>You will not use RF jammers, signal blockers, or scrambling devices in a manner that interferes with public telecommunications infrastructure, which is illegal under Pakistani law.</li>
            <li>You will not sell, re-export, or transfer any equipment to any person or entity subject to international sanctions or arms embargoes applicable to Pakistan.</li>
            <li>You accept sole and full responsibility for ensuring the lawful use of all equipment purchased from Geem.</li>
          </ul>
          <p><strong>Geem expressly disclaims all liability for any unlawful use of equipment sold by us.</strong> Any misuse is entirely the responsibility of the purchaser. We reserve the right to refuse orders where there is reasonable suspicion of intended illegal use.</p>
        </Section>

        <Section title="4. Products & Descriptions">
          <p>We make every effort to ensure product descriptions, images, and specifications are accurate and up to date. However, we reserve the right to correct errors at any time. If a product is listed at an incorrect price, we will contact you before processing the order.</p>
          <p>Product images are representative. Minor variations in colour, design, or packaging may occur, especially for imported items. Technical specifications are as provided by the manufacturer and are subject to change without notice.</p>
        </Section>

        <Section title="5. Ordering & Order Acceptance">
          <p>By placing an order, you confirm that:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>You are at least 18 years of age</li>
            <li>All information provided (name, address, contact details) is accurate and complete</li>
            <li>You are authorised to use the selected payment method</li>
            <li>You agree to these Terms & Conditions and our <Link href="/shop/privacy"><span className="text-primary hover:underline">Privacy Policy</span></Link></li>
          </ul>
          <p>Order confirmation is sent via WhatsApp/SMS. We reserve the right to refuse or cancel any order due to: stock unavailability, pricing errors, suspected fraud, suspected illegal intent, or inability to verify the buyer's identity for high-value orders.</p>
        </Section>

        <Section title="6. Custom Import Orders">
          <p>For on-demand custom import orders (items not in our standard catalog), the following additional terms apply:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>A non-refundable advance deposit (minimum 30% of order value) is required before procurement begins.</li>
            <li>Lead times are estimates (typically 2–6 weeks) and may vary due to international supply chain factors, customs clearance, or manufacturer availability.</li>
            <li>Geem is not liable for delays caused by international shipping, customs holds, or force majeure events.</li>
            <li>Custom-imported items are non-returnable unless they arrive physically damaged or are materially different from what was agreed in the order confirmation.</li>
          </ul>
        </Section>

        <Section title="7. Pricing">
          <p>All prices are listed in Pakistani Rupees (PKR) and are inclusive of applicable taxes unless stated otherwise. A delivery charge of Rs 200 applies to standard orders. Orders above Rs 5,000 qualify for free delivery. Prices are subject to change without notice but will not change after your order has been confirmed.</p>
        </Section>

        <Section title="8. Payment">
          <p>We accept Cash on Delivery (COD) for eligible orders below Rs 15,000, JazzCash, Easypaisa, and Bank Transfer. COD may not be available for all locations or for high-value orders. For agency/corporate orders, we issue formal invoices with agreed payment terms. Advance payment is required for all custom import orders.</p>
        </Section>

        <Section title="9. Delivery">
          <p>Delivery times are estimates (typically 2–5 business days nationwide). We are not liable for delays caused by courier services, natural disasters, public holidays, security situations, or other events beyond our control. Risk of loss or damage to the product passes to the buyer upon confirmed delivery.</p>
          <p>All orders are shipped in plain, unmarked packaging to protect customer privacy.</p>
        </Section>

        <Section title="10. Returns & Refunds">
          <p>Our return policy is detailed in our <Link href="/shop/returns"><span className="text-primary hover:underline">Returns & Refund Policy</span></Link>. Standard products may be returned within 7 days in original, unused condition. Custom-imported items are non-returnable except for manufacturing defects or shipping damage.</p>
        </Section>

        <Section title="11. Warranty">
          <p>All stocked products carry a minimum 6-month manufacturer warranty against defects in materials and workmanship. Many products carry a 1-year warranty. Warranty does not cover physical damage, water damage, modifications, misuse, or normal wear and tear. Warranty claims require the original order number and IMEI/serial number.</p>
        </Section>

        <Section title="12. Intellectual Property">
          <p>All content on this website — text, images, product descriptions, and branding — is the property of Geem or our suppliers. You may not reproduce, distribute, or commercially use our content without written permission.</p>
        </Section>

        <Section title="13. Limitation of Liability">
          <p>Geem's total liability to you for any claim arising from your purchase is limited to the purchase price of the product concerned. We are not liable for indirect, incidental, consequential, or punitive damages of any nature, including but not limited to loss of profits, data loss, reputational harm, or operational disruption.</p>
          <p>Geem is not liable for any harm, legal consequences, or damages resulting from the buyer's use — or misuse — of any product purchased from us.</p>
        </Section>

        <Section title="14. Governing Law & Jurisdiction">
          <p>These Terms are governed by the laws of the Islamic Republic of Pakistan. Any disputes arising from these Terms or any transaction with Geem shall be subject to the exclusive jurisdiction of the courts of Bahawalpur, Pakistan.</p>
        </Section>

        <Section title="15. Amendments">
          <p>We reserve the right to amend these Terms at any time. The version in effect at the time of your order governs that transaction. Continued use of our website after updated Terms are posted constitutes acceptance.</p>
        </Section>

        <Section title="16. Contact">
          <p>For questions about these Terms, contact us at:<br />
          <strong>Email:</strong> support@geem.pk &nbsp;|&nbsp; <strong>WhatsApp:</strong> 0307-8680005 &nbsp;|&nbsp; <strong>Address:</strong> Office #1, Yellow Building, Behind TCS Office, Kutchery Rd, Ahmadpur East, Bahawalpur 63350, Pakistan</p>
        </Section>
      </div>
    </ShopLayout>
  );
}
