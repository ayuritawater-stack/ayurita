import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Search, SlidersHorizontal } from "lucide-react";
import { api } from "@/lib/api";
import ProductCard from "@/components/ProductCard";
import { Input } from "@/components/ui/input";

const SIZES = ["250ml", "500ml", "1L", "2L", "5L", "20L", "Bulk", "Custom"];

export default function Products() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [size, setSize] = useState("");
  const [inStock, setInStock] = useState(false);

  useEffect(() => {
    api.get("/categories").then((r) => setCategories(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = {};
    if (q) params.q = q;
    if (cat) params.category = cat;
    if (size) params.size = size;
    if (inStock) params.in_stock = true;
    api.get("/products", { params }).then((r) => setProducts(r.data)).finally(() => setLoading(false));
  }, [q, cat, size, inStock]);

  const total = products.length;

  return (
    <div className="py-12 md:py-16">
      <div className="container-x">
        <div className="mb-10">
          <div className="text-eyebrow mb-3">Product Catalogue</div>
          <h1 className="h-hero !text-4xl md:!text-5xl">All Products</h1>
          <p className="text-slate-600 mt-3 max-w-2xl">Explore our complete range of packaged drinking water — bottles from 250ml to 5L, 20L jars, corporate & event supply, and custom-branded solutions.</p>
        </div>

        <div className="grid lg:grid-cols-[280px_1fr] gap-8">
          {/* Sidebar */}
          <aside className="lg:sticky lg:top-24 self-start card-premium p-6 space-y-6" data-testid="products-filters">
            <div>
              <div className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4" /> Filters
              </div>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  data-testid="filter-search"
                  placeholder="Search products…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="pl-9 rounded-xl"
                />
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Category</div>
              <div className="space-y-1.5">
                <button
                  onClick={() => setCat("")}
                  data-testid="filter-cat-all"
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm ${!cat ? "bg-sky-50 text-brand-primary font-semibold" : "text-slate-600 hover:bg-slate-50"}`}
                >
                  All Categories
                </button>
                {categories.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setCat(c.id)}
                    data-testid={`filter-cat-${c.slug}`}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm ${cat === c.id ? "bg-sky-50 text-brand-primary font-semibold" : "text-slate-600 hover:bg-slate-50"}`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Bottle Size</div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSize("")}
                  className={`px-3 py-1.5 text-xs rounded-full ${!size ? "bg-brand-primary text-white" : "bg-slate-100 text-slate-700"}`}
                >
                  Any
                </button>
                {SIZES.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSize(s)}
                    data-testid={`filter-size-${s}`}
                    className={`px-3 py-1.5 text-xs rounded-full ${size === s ? "bg-brand-primary text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={inStock}
                onChange={(e) => setInStock(e.target.checked)}
                data-testid="filter-in-stock"
                className="rounded"
              />
              <span className="text-slate-700">In stock only</span>
            </label>

            <button
              onClick={() => { setQ(""); setCat(""); setSize(""); setInStock(false); }}
              className="text-xs font-semibold text-brand-primary hover:underline"
              data-testid="filter-clear"
            >
              Clear all filters
            </button>
          </aside>

          {/* Grid */}
          <div>
            <div className="flex items-center justify-between mb-6">
              <div className="text-sm text-slate-500" data-testid="products-count">
                Showing <span className="font-semibold text-slate-900">{total}</span> products
              </div>
            </div>
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="card-premium overflow-hidden">
                    <div className="aspect-[4/3] bg-slate-100 animate-pulse" />
                    <div className="p-5 space-y-3">
                      <div className="h-4 bg-slate-100 rounded animate-pulse w-2/3" />
                      <div className="h-3 bg-slate-100 rounded animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            ) : total === 0 ? (
              <div className="card-premium p-12 text-center">
                <div className="text-slate-500">No products match your filters. Try clearing filters.</div>
              </div>
            ) : (
              <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                {products.map((p, i) => (
                  <ProductCard key={p.id} product={p} index={i} />
                ))}
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
