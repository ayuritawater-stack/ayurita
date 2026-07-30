import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Droplets, ShieldCheck, Truck, FlaskConical, Building2, Utensils, HeartPulse, School, PartyPopper,
  Factory, ArrowRight, CheckCircle2, MapPin, Phone, MessageCircle, Star, TrendingUp,
} from "lucide-react";
import { api } from "@/lib/api";
import { useSettings } from "@/lib/settings";
import ProductCard from "@/components/ProductCard";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const industries = [
  { name: "Hotels", icon: Building2, tone: "from-sky-100 to-white" },
  { name: "Restaurants", icon: Utensils, tone: "from-blue-100 to-white" },
  { name: "Hospitals", icon: HeartPulse, tone: "from-emerald-100 to-white" },
  { name: "Schools & Colleges", icon: School, tone: "from-amber-100 to-white" },
  { name: "Events & Marriage Halls", icon: PartyPopper, tone: "from-rose-100 to-white" },
  { name: "Factories & Corporates", icon: Factory, tone: "from-slate-100 to-white" },
];

const processSteps = [
  { title: "Source Water Intake", desc: "Groundwater tested and drawn from certified sources." },
  { title: "Sand & Carbon Filtration", desc: "Multi-layer filtration removes sediments and odour." },
  { title: "Reverse Osmosis (RO)", desc: "High-pressure RO membrane strips all dissolved impurities." },
  { title: "UV + Ozone Sterilisation", desc: "Kills microbes to ensure zero contamination." },
  { title: "Mineral Balancing", desc: "Essential minerals reintroduced for taste & health." },
  { title: "Bottling & Sealing", desc: "Fully automated, tamper-proof bottling line." },
];

const testimonials = [
  { name: "Rakesh Kumar", role: "Owner · Hotel Ganga Residency", text: "Ayurita has been our exclusive water partner for 2 years. Consistent quality, always on time." },
  { name: "Anjali Sharma", role: "Admin Head · Bihar Corp Office", text: "Their 20L jar supply for our 300-employee office is flawless. Never a missed delivery." },
  { name: "Manoj Verma", role: "Event Manager · Prem Marriage Hall", text: "Custom-branded 500ml bottles for weddings look premium and taste excellent." },
];

const faqs = [
  { q: "What areas do you deliver to?", a: "We deliver across Begusarai District — including Bishanpur, Barauni, Teghra, Bakhri and all surrounding towns." },
  { q: "What is the minimum order quantity?", a: "MOQ varies by product. Bottles start at a case of 24; 20L jars have no minimum. Bulk plans are customised." },
  { q: "Do you offer GST invoices?", a: "Yes, we provide GST-compliant invoices for every order. Just add your business GST number at checkout." },
  { q: "Can you provide custom-branded bottles?", a: "Absolutely. We offer white-label 500ml bottles with your brand for corporate gifting and events (min 500 units)." },
  { q: "How do I place a bulk order?", a: "Fill our Bulk Order form or call us directly at +91 99732 51687. We respond within a few hours." },
];

export default function Home() {
  const BUSINESS = useSettings();
  const [featured, setFeatured] = useState([]);

  useEffect(() => {
    api.get("/products", { params: { featured: true, limit: 6 } }).then((r) => setFeatured(r.data)).catch(() => {});
  }, []);

  return (
    <div className="overflow-x-hidden">
      {/* HERO */}
      <section
        className="relative overflow-hidden min-h-[600px] md:min-h-[680px] lg:min-h-[740px] flex flex-col"
        style={{
          backgroundImage: `url(${BUSINESS.heroImage || "/images/hero-bg.jpg"})`,
          backgroundSize: "cover",
          backgroundPosition: "65% center",
        }}
        data-testid="hero-section"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-[#081B3E]/80 via-[#0B2249]/35 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#081B3E]/85 via-[#081B3E]/15 to-transparent" />

        <div className="container-x w-full relative z-10 flex-1 flex items-center pt-14 pb-12">
          <div className="max-w-xl rounded-[28px] p-5 sm:p-7 bg-[#081B3E]/50 backdrop-blur-[3px] lg:bg-transparent lg:backdrop-blur-none lg:p-0">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <span className="text-eyebrow text-white/90">Pure By Nature</span>
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.05 }}
              className="h-hero mt-4 text-white"
            >
              Sustained <br className="hidden md:block" />
              By <span className="text-brand-emerald">Purpose</span>
            </motion.h1>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.15 }}
              className="flex items-center gap-3 mt-6"
            >
              <span className="w-10 h-px bg-white/30" />
              <Droplets className="w-4 h-4 text-brand-emerald" strokeWidth={1.8} />
              <span className="w-10 h-px bg-white/30" />
            </motion.div>

            <motion.p
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="lead mt-6 max-w-lg text-sky-50/90"
            >
              Ayurita is more than just water — a quiet expression of what sustains us. Reliable wholesale and bulk packaged drinking water for hotels, restaurants, corporates and events across Begusarai District, backed by 20+ quality checks and GST-compliant invoicing.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.3 }}
              className="flex flex-wrap gap-3 mt-8"
            >
              <Link to="/products" className="btn-primary" data-testid="hero-cta-quote">
                Explore Our Water <ArrowRight className="w-4 h-4" />
              </Link>
              <a href={`tel:${BUSINESS.phone}`} className="btn-secondary" data-testid="hero-cta-call">
                <Phone className="w-4 h-4" /> Call Now
              </a>
              <a
                href={`https://wa.me/${BUSINESS.whatsapp}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2.5 rounded-full px-6 py-4 font-bold text-[12px] uppercase tracking-[0.12em] transition-colors duration-300 text-white/90 hover:text-white"
                data-testid="hero-cta-whatsapp"
              >
                <MessageCircle className="w-4 h-4" /> WhatsApp
              </a>
            </motion.div>

          </div>
        </div>

        {/* trust bar pinned to the bottom of the hero */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.45 }}
          className="relative z-10 border-t border-white/15 bg-[#081B3E]/60 backdrop-blur-sm"
        >
          <div className="container-x py-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-6 gap-y-5">
            {[
              { label: "Natural Water", value: "100% Pure", icon: Droplets },
              { label: "Perfectly Balanced", value: "Balanced pH", icon: FlaskConical },
              { label: "Quality Assured", value: "Safe & Tested", icon: ShieldCheck },
              { label: "Sustainable Choice", value: "Eco Friendly", icon: TrendingUp },
              { label: "Dispatch under 20 km", value: "Same-Day", icon: Truck },
            ].map((s) => (
              <div key={s.label} className="flex items-center gap-3">
                <s.icon className="w-6 h-6 shrink-0 text-white/85" strokeWidth={1.5} />
                <div className="min-w-0">
                  <div className="text-[13px] font-heading font-bold uppercase tracking-wide text-white leading-tight">{s.value}</div>
                  <div className="text-[11px] text-sky-100/70 mt-0.5 leading-snug">{s.label}</div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* FEATURED PRODUCTS */}
      <section className="py-24 bg-white" data-testid="featured-products">
        <div className="container-x">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-12">
            <div>
              <div className="text-eyebrow mb-3">Featured Products</div>
              <h2 className="h-section max-w-2xl">Premium Bottled Water & Jars for Every Business Need</h2>
            </div>
            <Link to="/products" className="btn-secondary shrink-0" data-testid="view-all-products">
              View All Products <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {featured.map((p, i) => (
              <ProductCard key={p.id} product={p} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* INDUSTRIES */}
      <section className="py-24 bg-brand-bg" data-testid="industries-section">
        <div className="container-x">
          <div className="text-center mb-14">
            <div className="text-eyebrow mb-3">Industries We Serve</div>
            <h2 className="h-section">Trusted by Hundreds of Businesses Across Begusarai</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {industries.map((ind, i) => (
              <motion.div
                key={ind.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.05 }}
                className={`card-premium p-6 text-center bg-gradient-to-b ${ind.tone}`}
              >
                <div className="w-12 h-12 mx-auto rounded-2xl bg-white shadow-sm flex items-center justify-center text-brand-primary mb-3">
                  <ind.icon className="w-6 h-6" strokeWidth={1.6} />
                </div>
                <div className="text-sm font-semibold text-slate-900">{ind.name}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* PROCESS */}
      <section className="py-24 bg-white" data-testid="process-section">
        <div className="container-x grid lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-5">
            <div className="text-eyebrow mb-3">Manufacturing & Purification</div>
            <h2 className="h-section">12-Stage Purification for Uncompromising Purity</h2>
            <p className="text-slate-600 mt-6 leading-relaxed">
              Every drop of Ayurita water passes through our 12-stage purification process — from raw water intake to sealed bottling. Multi-media filtration, RO, UV, ozonation and mineral balancing ensure water that's crisp, clean and safe.
            </p>
            <div className="mt-8 space-y-3">
              {["Premium purification technology", "20+ automated quality checks", "Zero-touch bottling & sealing", "GST invoicing & compliant packaging"].map((line) => (
                <div key={line} className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-50 text-brand-emerald flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <span className="text-sm text-slate-700">{line}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="lg:col-span-7 grid sm:grid-cols-2 gap-4">
            {processSteps.map((s, i) => (
              <motion.div
                key={s.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.05 }}
                className="card-premium p-5"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-brand-primary text-white text-xs font-bold flex items-center justify-center font-heading">
                    {String(i + 1).padStart(2, "0")}
                  </div>
                  <div className="font-heading font-semibold text-slate-900">{s.title}</div>
                </div>
                <p className="text-sm text-slate-500 leading-relaxed">{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* WHY CHOOSE */}
      <section className="py-24 bg-slate-900 text-white relative overflow-hidden" data-testid="why-choose">
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: "radial-gradient(circle at 20% 30%, rgba(56,189,248,0.6), transparent 40%), radial-gradient(circle at 80% 70%, rgba(16,185,129,0.5), transparent 40%)"
        }} />
        <div className="container-x relative">
          <div className="max-w-2xl">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-secondary mb-3">Why Choose Ayurita</div>
            <h2 className="font-heading font-bold text-3xl sm:text-4xl lg:text-5xl tracking-tight text-white leading-tight">The trusted water partner for growing businesses.</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6 mt-12">
            {[
              { icon: ShieldCheck, title: "Certified Purity", desc: "20+ quality checks per batch, lab-tested every shift, sealed at source." },
              { icon: Truck, title: "Reliable Delivery", desc: "Same-day dispatch for orders under 20 km; orders beyond 20 km are dispatched in 3 days." },
              { icon: TrendingUp, title: "Bulk Pricing", desc: "Aggressive bulk pricing tiers with transparent GST invoicing." },
            ].map((it) => (
              <div key={it.title} className="glass-dark p-6 rounded-2xl">
                <div className="w-12 h-12 rounded-2xl bg-white/10 text-brand-secondary flex items-center justify-center mb-4">
                  <it.icon className="w-6 h-6" strokeWidth={1.6} />
                </div>
                <div className="font-heading font-semibold text-white text-lg">{it.title}</div>
                <p className="text-sm text-slate-300 mt-2 leading-relaxed">{it.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="py-24 bg-white" data-testid="testimonials-section">
        <div className="container-x">
          <div className="text-center mb-14">
            <div className="text-eyebrow mb-3">What Our Partners Say</div>
            <h2 className="h-section">Real Feedback from Business Partners</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <div key={t.name} className="card-premium p-8">
                <div className="flex gap-0.5 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-slate-700 leading-relaxed">"{t.text}"</p>
                <div className="mt-6 pt-6 border-t border-slate-100">
                  <div className="font-semibold text-slate-900">{t.name}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{t.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* DELIVERY MAP */}
      <section className="py-24 bg-brand-bg" data-testid="delivery-map-section">
        <div className="container-x grid lg:grid-cols-2 gap-10 items-stretch">
          <div className="flex flex-col justify-center">
            <div className="text-eyebrow mb-3">Delivery Coverage</div>
            <h2 className="h-section">Serving Every Corner of Begusarai District</h2>
            <p className="text-slate-600 mt-5 leading-relaxed">
              Our logistics team covers Begusarai city, Barauni, Teghra, Bakhri, Ballia, Bihat, Cheria Bariarpur, Matihani, Sahebpur Kamal and all surrounding areas. Same-day dispatch for orders under 20 km; orders beyond 20 km are dispatched in 3 days.
            </p>
            <div className="mt-6 space-y-3">
              <div className="flex items-center gap-3 text-sm text-slate-700">
                <MapPin className="w-4 h-4 text-brand-primary" /> {BUSINESS.address}
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-700">
                <Phone className="w-4 h-4 text-brand-primary" /> {BUSINESS.phoneDisplay}
              </div>
            </div>
            <Link to="/bulk-order" className="btn-primary self-start mt-8">
              Get a Quote <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="rounded-3xl overflow-hidden shadow-xl min-h-[380px]">
            <iframe
              title="Ayurita location"
              src={BUSINESS.mapEmbed}
              className="w-full h-full min-h-[380px] border-0"
              loading="lazy"
            />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-24 bg-white" data-testid="faq-section">
        <div className="container-x max-w-3xl">
          <div className="text-center mb-12">
            <div className="text-eyebrow mb-3">Frequently Asked</div>
            <h2 className="h-section">Everything You Need to Know</h2>
          </div>
          <Accordion type="single" collapsible className="w-full space-y-3">
            {faqs.map((f, i) => (
              <AccordionItem key={i} value={`item-${i}`} className="card-premium !border-0 px-6">
                <AccordionTrigger className="font-heading font-semibold text-slate-900 text-left hover:no-underline py-5">
                  {f.q}
                </AccordionTrigger>
                <AccordionContent className="text-slate-600 leading-relaxed pb-5">
                  {f.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* CTA BANNER */}
      <section className="py-16 md:py-20" data-testid="cta-banner">
        <div className="container-x">
          <div className="relative rounded-[2rem] overflow-hidden bg-gradient-to-br from-brand-primary via-[#0F4C81] to-[#0B3A66] p-10 md:p-16">
            <div className="absolute inset-0 opacity-30" style={{
              backgroundImage: "radial-gradient(circle at 90% 10%, rgba(56,189,248,0.5), transparent 40%), radial-gradient(circle at 10% 90%, rgba(16,185,129,0.4), transparent 40%)"
            }} />
            <div className="relative grid md:grid-cols-2 gap-8 items-center">
              <div>
                <h3 className="font-heading font-bold text-3xl md:text-4xl text-white leading-tight tracking-tight">
                  Ready to switch to reliable water supply?
                </h3>
                <p className="text-sky-100 mt-4">Get a customised bulk quote in under 2 hours. GST invoicing, flexible delivery, transparent pricing.</p>
              </div>
              <div className="flex flex-wrap md:justify-end gap-3">
                <Link to="/bulk-order" className="inline-flex items-center gap-2 rounded-full px-6 py-3 bg-white text-brand-primary font-semibold text-sm hover:bg-sky-50 transition">
                  Request Quote <ArrowRight className="w-4 h-4" />
                </Link>
                <a href={`tel:${BUSINESS.phone}`} className="inline-flex items-center gap-2 rounded-full px-6 py-3 bg-brand-emerald text-white font-semibold text-sm hover:bg-brand-emerald-hover transition">
                  <Phone className="w-4 h-4" /> Call Now
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
