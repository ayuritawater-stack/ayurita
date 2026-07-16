import { useSettings } from "@/lib/settings";

const sections = [
  {
    title: "1. Who We Are",
    body: (BUSINESS) => `${BUSINESS.name} ("Ayurita", "we", "us") is a manufacturer and wholesale supplier of packaged drinking water based at ${BUSINESS.address}. These Terms & Conditions govern your use of our website and any order placed through it, whether as a registered wholesale customer or a guest.`,
  },
  {
    title: "2. Account & Eligibility",
    body: () => "Placing an order requires a registered business account (business name, contact person, phone, email). You are responsible for keeping your login credentials confidential and for all activity under your account. We reserve the right to suspend accounts used in a way that violates these terms.",
  },
  {
    title: "3. Pricing & GST",
    body: (BUSINESS) => `All prices shown are exclusive of GST unless stated otherwise; applicable GST is calculated at checkout and shown on your invoice. GSTIN: ${BUSINESS.gstin || "available on request"}. Bulk/slab pricing applies automatically once minimum order quantities are met, as shown on each product page.`,
  },
  {
    title: "4. Payment Methods",
    body: () => "We currently accept Cash on Delivery, UPI, Bank Transfer, online payment via Razorpay (where enabled), and — for approved wholesale accounts — billing to a Credit Account with agreed payment terms. Orders placed on a Credit Account are subject to the credit limit and due date shown on your account and invoice; amounts not settled by the due date may affect your available credit for future orders.",
  },
  {
    title: "5. Order Confirmation & Fulfilment",
    body: () => "An order is confirmed once placed; you will see live status updates (placed → confirmed → processing → packed → dispatched → delivered) in your account and via WhatsApp where a valid number is provided. We aim to confirm orders within 2 hours during business hours. Delivery timelines depend on order size, location and stock availability.",
  },
  {
    title: "6. Cancellations & Returns",
    body: () => "Orders can be cancelled before dispatch by contacting us directly. Because packaged drinking water is a sealed food-grade product, returns are only accepted for goods that arrive damaged, leaking, or otherwise defective — reported within 48 hours of delivery with photo evidence. Approved returns are resolved as a replacement, credit note, or refund at our discretion.",
  },
  {
    title: "7. Product Reviews",
    body: () => "Reviews may only be submitted by customers with a delivered order for that product, and are moderated before publishing. We reserve the right to remove reviews that are abusive, fraudulent, or unrelated to the product.",
  },
  {
    title: "8. Limitation of Liability",
    body: (BUSINESS) => `${BUSINESS.name} is not liable for indirect or consequential losses arising from delayed delivery, stock unavailability, or events outside our reasonable control. Our total liability for any order is limited to the value of that order.`,
  },
  {
    title: "9. Changes to These Terms",
    body: () => "We may update these terms from time to time to reflect changes in our services or applicable law. Continued use of the site after changes are posted constitutes acceptance of the revised terms.",
  },
  {
    title: "10. Contact",
    body: (BUSINESS) => `Questions about these terms can be sent to ${BUSINESS.email} or ${BUSINESS.phoneDisplay}.`,
  },
];

export default function Terms() {
  const BUSINESS = useSettings();
  return (
    <div className="py-12 md:py-16">
      <div className="container-x max-w-3xl">
        <div className="text-eyebrow mb-3">Legal</div>
        <h1 className="h-hero !text-4xl">Terms &amp; Conditions</h1>
        <p className="text-slate-500 mt-3 text-sm">Last updated: {new Date().getFullYear()}</p>

        <div className="mt-10 space-y-8">
          {sections.map((s) => (
            <div key={s.title}>
              <h2 className="font-heading font-bold text-lg text-slate-900 mb-2">{s.title}</h2>
              <p className="text-slate-600 leading-relaxed">{s.body(BUSINESS)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
