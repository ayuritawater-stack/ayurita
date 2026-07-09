import { Link } from "react-router-dom";
import { toast } from "sonner";
import { X, ShoppingCart, ArrowRight, CheckCircle2, MinusCircle, GitCompare } from "lucide-react";
import { useCompare } from "@/lib/compare";
import { useCart } from "@/lib/cart";
import { formatINR } from "@/lib/api";

const ROWS = [
  { key: "size", label: "Size" },
  { key: "category_name", label: "Category" },
  { key: "packaging", label: "Packaging" },
  { key: "moq", label: "MOQ" },
  { key: "price", label: "Unit Price", render: (v) => formatINR(v) },
  { key: "bulk_price", label: "Bulk Price", render: (v) => (v ? formatINR(v) : "—") },
  { key: "gst_rate", label: "GST", render: (v) => `${v}%` },
  { key: "stock", label: "Stock", render: (v) => (v > 0 ? <span className="inline-flex items-center gap-1 text-brand-emerald"><CheckCircle2 className="w-3.5 h-3.5" /> In stock</span> : <span className="inline-flex items-center gap-1 text-rose-500"><MinusCircle className="w-3.5 h-3.5" /> Out</span>) },
  { key: "description", label: "Description" },
];

export default function Compare() {
  const { items, remove, clear } = useCompare();
  const { addItem } = useCart();

  if (items.length === 0) {
    return (
      <div className="py-24">
        <div className="container-x max-w-xl text-center">
          <div className="w-20 h-20 rounded-full bg-sky-50 text-brand-primary flex items-center justify-center mx-auto mb-6">
            <GitCompare className="w-9 h-9" strokeWidth={1.5} />
          </div>
          <h1 className="h-section">Nothing to compare yet</h1>
          <p className="text-slate-600 mt-3">Add up to 4 products from the catalogue and see them side-by-side.</p>
          <Link to="/products" className="btn-primary mt-8 inline-flex" data-testid="compare-browse-cta">
            Browse Products <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="py-12 md:py-16">
      <div className="container-x">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div>
            <div className="text-eyebrow mb-3">Compare</div>
            <h1 className="h-hero !text-4xl md:!text-5xl">Side-by-side comparison</h1>
            <p className="text-slate-600 mt-2">{items.length} of 4 selected</p>
          </div>
          <button onClick={clear} className="btn-secondary" data-testid="clear-compare">Clear all</button>
        </div>

        <div className="card-premium overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left px-6 py-4 text-xs uppercase tracking-wider text-slate-500 font-semibold w-40">Attribute</th>
                {items.map((p) => (
                  <th key={p.id} className="text-left px-4 py-4 min-w-[220px]" data-testid={`compare-col-${p.slug}`}>
                    <div className="relative">
                      <button onClick={() => remove(p.id)} className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-slate-100 hover:bg-rose-100 hover:text-rose-500 flex items-center justify-center">
                        <X className="w-3.5 h-3.5" />
                      </button>
                      <img src={p.image} alt="" className="w-full aspect-[4/3] object-cover rounded-xl bg-slate-50" />
                      <div className="mt-3">
                        <Link to={`/products/${p.slug}`} className="font-heading font-semibold text-slate-900 hover:text-brand-primary">
                          {p.name}
                        </Link>
                      </div>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ROWS.map((row) => (
                <tr key={row.key}>
                  <td className="px-6 py-3 text-slate-500 font-medium">{row.label}</td>
                  {items.map((p) => (
                    <td key={p.id} className="px-4 py-3 text-slate-800">
                      {row.render ? row.render(p[row.key]) : (p[row.key] ?? "—")}
                    </td>
                  ))}
                </tr>
              ))}
              <tr>
                <td className="px-6 py-4"></td>
                {items.map((p) => (
                  <td key={p.id} className="px-4 py-4">
                    <button
                      onClick={() => { addItem({ id: p.id, name: p.name, slug: p.slug, size: p.size, price: p.price, bulk_price: p.bulk_price, moq: p.moq, images: [p.image] }, p.moq || 1); toast.success("Added to cart"); }}
                      className="btn-primary w-full !py-2"
                      data-testid={`compare-add-${p.slug}`}
                    >
                      <ShoppingCart className="w-3.5 h-3.5" /> Add to cart
                    </button>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
