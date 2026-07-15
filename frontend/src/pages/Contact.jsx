import { useState } from "react";
import { toast } from "sonner";
import { Phone, Mail, MapPin, Clock, MessageCircle, Send } from "lucide-react";
import { api } from "@/lib/api";
import { useSettings } from "@/lib/settings";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export default function Contact() {
  const BUSINESS = useSettings();
  const [form, setForm] = useState({ name: "", email: "", phone: "", subject: "", message: "" });
  const [submitting, setSubmitting] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post("/contact", form);
      toast.success("Message sent! We'll reply within 24 hours.");
      setForm({ name: "", email: "", phone: "", subject: "", message: "" });
    } catch (err) {
      toast.error(err.response?.data?.detail || "Could not send message");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="py-12 md:py-16">
      <div className="container-x">
        <div className="mb-10 max-w-2xl">
          <div className="text-eyebrow mb-3">Get in Touch</div>
          <h1 className="h-hero !text-4xl md:!text-5xl">Let's talk about your water needs.</h1>
          <p className="text-slate-600 mt-3">Whether you need a single order or a monthly corporate supply plan, our team is ready to help.</p>
        </div>

        <div className="grid lg:grid-cols-[1.1fr_1fr] gap-8">
          <form onSubmit={submit} className="card-premium p-6 md:p-8 space-y-4" data-testid="contact-form">
            <div className="font-heading font-bold text-xl">Send us a message</div>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>Name *</Label>
                <Input required data-testid="contact-name" value={form.name} onChange={(e) => set("name", e.target.value)} className="mt-1.5 rounded-xl" />
              </div>
              <div>
                <Label>Email *</Label>
                <Input required type="email" data-testid="contact-email" value={form.email} onChange={(e) => set("email", e.target.value)} className="mt-1.5 rounded-xl" />
              </div>
              <div>
                <Label>Phone</Label>
                <Input data-testid="contact-phone" value={form.phone} onChange={(e) => set("phone", e.target.value)} className="mt-1.5 rounded-xl" />
              </div>
              <div>
                <Label>Subject</Label>
                <Input data-testid="contact-subject" value={form.subject} onChange={(e) => set("subject", e.target.value)} className="mt-1.5 rounded-xl" />
              </div>
              <div className="md:col-span-2">
                <Label>Message *</Label>
                <Textarea required data-testid="contact-message" value={form.message} onChange={(e) => set("message", e.target.value)} className="mt-1.5 rounded-xl min-h-[140px]" />
              </div>
            </div>
            <button type="submit" disabled={submitting} className="btn-primary disabled:opacity-60" data-testid="contact-submit">
              {submitting ? "Sending…" : "Send Message"} <Send className="w-4 h-4" />
            </button>
          </form>

          <div className="space-y-4">
            <div className="card-premium p-6">
              <div className="font-heading font-bold text-lg mb-4">Business Information</div>
              <div className="space-y-4 text-sm">
                <div className="flex gap-3">
                  <div className="w-10 h-10 rounded-full bg-sky-50 text-brand-primary flex items-center justify-center shrink-0">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wider text-slate-500">Address</div>
                    <div className="text-slate-900">{BUSINESS.address}</div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-10 h-10 rounded-full bg-sky-50 text-brand-primary flex items-center justify-center shrink-0">
                    <Phone className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wider text-slate-500">Phone</div>
                    <a href={`tel:${BUSINESS.phone}`} className="text-slate-900 hover:text-brand-primary">{BUSINESS.phoneDisplay}</a>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-10 h-10 rounded-full bg-sky-50 text-brand-primary flex items-center justify-center shrink-0">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wider text-slate-500">Email</div>
                    <a href={`mailto:${BUSINESS.email}`} className="text-slate-900 hover:text-brand-primary">{BUSINESS.email}</a>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-10 h-10 rounded-full bg-sky-50 text-brand-primary flex items-center justify-center shrink-0">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wider text-slate-500">Business Hours</div>
                    <div className="text-slate-900">{BUSINESS.hours}</div>
                  </div>
                </div>
              </div>
              <div className="mt-5 flex gap-2">
                <a href={`tel:${BUSINESS.phone}`} className="btn-primary flex-1"><Phone className="w-4 h-4" /> Call</a>
                <a href={`https://wa.me/${BUSINESS.whatsapp}`} target="_blank" rel="noreferrer" className="btn-accent flex-1">
                  <MessageCircle className="w-4 h-4" /> WhatsApp
                </a>
              </div>
            </div>

            <div className="card-premium overflow-hidden">
              <iframe
                title="Ayurita location"
                src={BUSINESS.mapEmbed}
                className="w-full h-64 border-0"
                loading="lazy"
              />
              <div className="p-4 bg-gradient-to-r from-sky-50 to-emerald-50 text-xs text-slate-700 font-semibold">
                🚚 {BUSINESS.deliveryArea}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
