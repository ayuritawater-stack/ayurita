import { motion } from "framer-motion";
import { Award, HeartHandshake, Target, Sparkles, ShieldCheck, Leaf, Droplets } from "lucide-react";
import { useSettings } from "@/lib/settings";

const values = [
  { icon: ShieldCheck, title: "Uncompromising Quality", desc: "Every batch tested. Every bottle sealed. Every promise kept." },
  { icon: HeartHandshake, title: "Partner-First Mindset", desc: "We win when our business partners grow. Long-term over short wins." },
  { icon: Leaf, title: "Sustainable Practice", desc: "Responsible water sourcing, recyclable packaging, minimal waste." },
  { icon: Sparkles, title: "Premium Standard", desc: "From bottling line to doorstep — every touchpoint is world-class." },
];

const timeline = [
  { year: "2026", title: "Founded in Bishanpur", desc: "Started as a small bottling unit with a big vision — pure, reliable water for Bihar." },
  { year: "2026", title: "50+ Business Partners", desc: "Crossed 50 recurring corporate & hotel supply contracts across Begusarai." },
  { year: "2026", title: "Full Begusarai Coverage", desc: "Same-day delivery infrastructure across the entire district." },
  { year: "2026", title: "Custom Branding Launch", desc: "Introduced white-label water for corporate gifting and events." },
];

export default function About() {
  const BUSINESS = useSettings();
  return (
    <div>
      {/* Hero */}
      <section className="py-16 md:py-24 bg-ripple">
        <div className="container-x max-w-4xl text-center">
          <div className="text-eyebrow mb-3">About Ayurita</div>
          <h1 className="h-hero">Pure water. Trusted quality. Built for Bihar's businesses.</h1>
          <p className="text-slate-600 mt-6 text-lg leading-relaxed">
            Ayurita Packaged Drinking Water was born in Bishanpur, Begusarai, with one simple mission — to deliver water that businesses can rely on, every single day. Today, we serve 150+ hotels, offices, hospitals and events across the district.
          </p>
        </div>
      </section>

      {/* Mission / Vision */}
      <section className="py-16">
        <div className="container-x grid md:grid-cols-2 gap-6">
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="card-premium p-8">
            <div className="w-12 h-12 rounded-2xl bg-sky-50 text-brand-primary flex items-center justify-center mb-4">
              <Target className="w-6 h-6" />
            </div>
            <div className="font-heading font-bold text-2xl text-slate-900">Our Mission</div>
            <p className="text-slate-600 mt-4 leading-relaxed">
              To be the most trusted packaged drinking water partner for businesses across Bihar — combining lab-tested purity, on-time delivery, and premium service standards at wholesale-friendly prices.
            </p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="card-premium p-8">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-brand-emerald flex items-center justify-center mb-4">
              <Award className="w-6 h-6" />
            </div>
            <div className="font-heading font-bold text-2xl text-slate-900">Our Vision</div>
            <p className="text-slate-600 mt-4 leading-relaxed">
              A future where every business in North Bihar — from small cafes to large corporates — has access to premium, reliable drinking water without compromise on quality or cost.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Values */}
      <section className="py-16 bg-white">
        <div className="container-x">
          <div className="text-center mb-12 max-w-2xl mx-auto">
            <div className="text-eyebrow mb-3">Our Values</div>
            <h2 className="h-section">What We Stand For</h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {values.map((v, i) => (
              <motion.div key={v.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }} className="card-premium p-6">
                <div className="w-11 h-11 rounded-2xl bg-sky-50 text-brand-primary flex items-center justify-center mb-4">
                  <v.icon className="w-5 h-5" />
                </div>
                <div className="font-heading font-semibold text-lg text-slate-900">{v.title}</div>
                <p className="text-sm text-slate-500 mt-2 leading-relaxed">{v.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section className="py-16 md:py-24">
        <div className="container-x max-w-3xl">
          <div className="text-center mb-14">
            <div className="text-eyebrow mb-3">Our Journey</div>
            <h2 className="h-section">Milestones that shaped us</h2>
          </div>
          <div className="relative">
            <div className="absolute left-5 md:left-1/2 top-2 bottom-2 w-0.5 bg-slate-200 md:-translate-x-1/2" />
            <div className="space-y-10">
              {timeline.map((t, i) => (
                <div key={t.year} className={`relative md:grid md:grid-cols-2 md:gap-10 ${i % 2 === 1 ? "" : ""}`}>
                  <div className={`pl-14 md:pl-0 ${i % 2 === 0 ? "md:text-right md:pr-12" : "md:col-start-2 md:pl-12"}`}>
                    <div className="text-brand-secondary font-heading font-bold text-2xl">{t.year}</div>
                    <div className="font-heading font-semibold text-slate-900 text-lg mt-1">{t.title}</div>
                    <p className="text-slate-600 mt-2 leading-relaxed">{t.desc}</p>
                  </div>
                  <div className="absolute left-5 md:left-1/2 top-1 w-4 h-4 rounded-full bg-brand-primary ring-4 ring-white md:-translate-x-1/2" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Owner message */}
      <section className="py-16 bg-slate-900 text-white">
        <div className="container-x max-w-3xl text-center">
          <Droplets className="w-10 h-10 text-brand-secondary mx-auto mb-6" />
          <blockquote className="font-heading font-medium text-2xl md:text-3xl leading-snug tracking-tight">
            "We started Ayurita because our community deserves better water. Every drop we bottle carries that promise — to businesses, to families, to Bihar."
          </blockquote>
          <div className="mt-6 text-sm text-slate-400">— The Founding Team, Ayurita</div>
          <div className="text-xs text-slate-500 mt-1">{BUSINESS.address}</div>
        </div>
      </section>
    </div>
  );
}
