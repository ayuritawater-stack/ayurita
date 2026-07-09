import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { api } from "@/lib/api";

export default function Categories() {
  const [cats, setCats] = useState([]);
  useEffect(() => {
    api.get("/categories").then((r) => setCats(r.data)).catch(() => {});
  }, []);

  return (
    <div className="py-12 md:py-16">
      <div className="container-x">
        <div className="mb-12 max-w-2xl">
          <div className="text-eyebrow mb-3">Explore Categories</div>
          <h1 className="h-hero !text-4xl md:!text-5xl">Solutions for Every Business</h1>
          <p className="text-slate-600 mt-3">From single bottles to full corporate contracts — find the right water solution for your business.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cats.map((c, i) => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.05 }}
            >
              <Link
                to={`/products?cat=${c.slug}`}
                className="card-premium overflow-hidden block group"
                data-testid={`category-card-${c.slug}`}
              >
                <div className="aspect-[4/3] overflow-hidden bg-gradient-to-br from-sky-50 to-slate-50 relative">
                  <img src={c.image_url} alt={c.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent" />
                  <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between">
                    <div>
                      <div className="text-xs text-white/70 uppercase tracking-wider">Category</div>
                      <div className="font-heading font-bold text-white text-2xl">{c.name}</div>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-white/90 text-brand-primary flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <ArrowUpRight className="w-4 h-4" />
                    </div>
                  </div>
                </div>
                <div className="p-5">
                  <p className="text-sm text-slate-600 leading-relaxed">{c.description}</p>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
