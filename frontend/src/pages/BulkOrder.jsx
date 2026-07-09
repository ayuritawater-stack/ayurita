import { useState } from "react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Send, ShieldCheck, Truck, HeartHandshake, Download } from "lucide-react";
import { api, API } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const SIZES = ["250ml", "500ml", "1L", "2L", "5L", "20L Jar", "Mixed / Custom"];
const PRODUCTS = ["Bottles", "Water Jars", "Corporate Supply", "Event Supply", "Hotel/Restaurant Supply", "Custom Branding"];

const INITIAL = {
  business_name: "", contact_person: "", phone: "", email: "",
  product: "", bottle_size: "", quantity: "", monthly_requirement: "",
  delivery_address: "", message: "",
};

export default function BulkOrder() {
  const [form, setForm] = useState(INITIAL);
  const [submitting, setSubmitting] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = { ...form, quantity: form.quantity ? Number(form.quantity) : null };
      await api.post("/bulk-inquiries", payload);
      toast.success("Bulk inquiry submitted! Our team will contact you within 2 hours.");
      setForm(INITIAL);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to submit inquiry");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="py-12 md:py-16">
      <div className="container-x">
        <div className="grid lg:grid-cols-[1.2fr_1fr] gap-10 items-start">
          <div>
            <div className="text-eyebrow mb-3">Bulk Order Enquiry</div>
            <h1 className="h-hero !text-4xl md:!text-5xl">Get a customised bulk quote in 2 hours.</h1>
            <p className="text-slate-600 mt-4 leading-relaxed">
              Whether you need weekly office jar supply, wedding-day water packs, or monthly corporate contracts — our sales team will design a plan that fits your business.
            </p>

            <div className="grid sm:grid-cols-3 gap-4 mt-10">
              {[
                { icon: ShieldCheck, label: "GST invoicing" },
                { icon: Truck, label: "Same-day dispatch" },
                { icon: HeartHandshake, label: "Dedicated manager" },
              ].map((b) => (
                <div key={b.label} className="card-premium p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-sky-50 text-brand-primary flex items-center justify-center">
                    <b.icon className="w-5 h-5" />
                  </div>
                  <span className="text-sm font-semibold text-slate-800">{b.label}</span>
                </div>
              ))}
            </div>

            <div className="mt-10 card-premium p-6 bg-gradient-to-br from-brand-primary to-[#0C3D68] text-white">
              <div className="font-heading font-bold text-lg">Best pricing tier unlocked at 500+ units</div>
              <p className="text-sky-100 text-sm mt-2 leading-relaxed">
                Our bulk pricing is transparent and tiered — the more you order, the better the per-unit rate. Corporate contracts unlock the best rate.
              </p>
              <a
                href={`${API}/catalogue.pdf`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full mt-4 px-5 py-2.5 bg-white text-brand-primary font-semibold text-sm hover:bg-sky-50 transition"
                data-testid="download-catalogue-bulk"
              >
                <Download className="w-4 h-4" /> Download Full Catalogue PDF
              </a>
            </div>
          </div>

          <motion.form
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            onSubmit={submit}
            className="card-premium p-6 md:p-8 space-y-4"
            data-testid="bulk-form"
          >
            <div className="font-heading font-bold text-xl mb-2">Tell us about your requirement</div>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>Business Name *</Label>
                <Input required data-testid="bulk-business" value={form.business_name} onChange={(e) => set("business_name", e.target.value)} className="mt-1.5 rounded-xl" />
              </div>
              <div>
                <Label>Contact Person *</Label>
                <Input required data-testid="bulk-person" value={form.contact_person} onChange={(e) => set("contact_person", e.target.value)} className="mt-1.5 rounded-xl" />
              </div>
              <div>
                <Label>Phone *</Label>
                <Input required data-testid="bulk-phone" value={form.phone} onChange={(e) => set("phone", e.target.value)} className="mt-1.5 rounded-xl" />
              </div>
              <div>
                <Label>Email *</Label>
                <Input required type="email" data-testid="bulk-email" value={form.email} onChange={(e) => set("email", e.target.value)} className="mt-1.5 rounded-xl" />
              </div>
              <div>
                <Label>Product</Label>
                <Select value={form.product} onValueChange={(v) => set("product", v)}>
                  <SelectTrigger className="mt-1.5 rounded-xl" data-testid="bulk-product"><SelectValue placeholder="Choose product" /></SelectTrigger>
                  <SelectContent>
                    {PRODUCTS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Bottle Size</Label>
                <Select value={form.bottle_size} onValueChange={(v) => set("bottle_size", v)}>
                  <SelectTrigger className="mt-1.5 rounded-xl" data-testid="bulk-size"><SelectValue placeholder="Choose size" /></SelectTrigger>
                  <SelectContent>
                    {SIZES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Quantity (units)</Label>
                <Input type="number" data-testid="bulk-quantity" value={form.quantity} onChange={(e) => set("quantity", e.target.value)} className="mt-1.5 rounded-xl" />
              </div>
              <div>
                <Label>Monthly Requirement</Label>
                <Input data-testid="bulk-monthly" placeholder="e.g. 2000 units/month" value={form.monthly_requirement} onChange={(e) => set("monthly_requirement", e.target.value)} className="mt-1.5 rounded-xl" />
              </div>
              <div className="md:col-span-2">
                <Label>Delivery Address</Label>
                <Textarea data-testid="bulk-address" value={form.delivery_address} onChange={(e) => set("delivery_address", e.target.value)} className="mt-1.5 rounded-xl" />
              </div>
              <div className="md:col-span-2">
                <Label>Additional Requirements</Label>
                <Textarea data-testid="bulk-message" placeholder="Tell us about branding, frequency, timing…" value={form.message} onChange={(e) => set("message", e.target.value)} className="mt-1.5 rounded-xl min-h-[100px]" />
              </div>
            </div>
            <button type="submit" disabled={submitting} className="btn-primary w-full disabled:opacity-60" data-testid="bulk-submit">
              {submitting ? "Submitting…" : "Submit Enquiry"} <Send className="w-4 h-4" />
            </button>
          </motion.form>
        </div>
      </div>
    </div>
  );
}
