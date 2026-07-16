import { useSettings } from "@/lib/settings";

const sections = [
  {
    title: "1. What We Collect",
    body: () => "When you create an account or place an order, we collect your business name, contact person, phone number, email, delivery address(es), and GST number (optional). Order history, saved addresses, wishlist items, and product reviews you submit are stored against your account.",
  },
  {
    title: "2. How We Use It",
    body: () => "Your details are used to process and deliver orders, generate GST invoices, send order-status updates over WhatsApp, respond to support requests, and — where applicable — manage a wholesale credit account (limit, balance, due dates). We do not use your data for anything beyond running this business.",
  },
  {
    title: "3. WhatsApp Notifications",
    body: () => "If you provide a valid phone number, we send order-placed and order-status messages via the WhatsApp Business Platform. We do not currently send order communications by email.",
  },
  {
    title: "4. Payment Information",
    body: () => "For online payments, card/UPI/net-banking details are handled directly by Razorpay and are never stored on our servers. For Credit Account orders, we store the amounts owed, paid, and due dates necessary to manage your account balance.",
  },
  {
    title: "5. Data Sharing",
    body: (BUSINESS) => `We do not sell or rent your data. Information is shared only with the service providers needed to operate the site — our payment gateway (Razorpay), our messaging provider (Meta/WhatsApp Cloud API), and our hosting/database providers — solely to deliver the service you've requested from ${BUSINESS.name}.`,
  },
  {
    title: "6. Data Retention & Your Rights",
    body: () => "Account and order data is retained as long as your account is active and as needed to meet tax/invoicing requirements. You can update your profile and saved addresses at any time from your Account page, or contact us to request access to, correction of, or deletion of your data, subject to our legal obligation to retain invoicing records.",
  },
  {
    title: "7. Security",
    body: () => "Passwords are stored using industry-standard hashing (never in plain text). Access to admin functions is role-restricted, and all connections to the site are encrypted.",
  },
  {
    title: "8. Changes to This Policy",
    body: () => "We may update this policy as our services evolve. The \"last updated\" date at the top of this page reflects the most recent revision.",
  },
  {
    title: "9. Contact",
    body: (BUSINESS) => `For any privacy-related question, reach us at ${BUSINESS.email} or ${BUSINESS.phoneDisplay}.`,
  },
];

export default function Privacy() {
  const BUSINESS = useSettings();
  return (
    <div className="py-12 md:py-16">
      <div className="container-x max-w-3xl">
        <div className="text-eyebrow mb-3">Legal</div>
        <h1 className="h-hero !text-4xl">Privacy Policy</h1>
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
