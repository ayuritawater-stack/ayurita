import { Link } from "react-router-dom";
import { useCompare } from "@/lib/compare";
import { formatINR } from "@/lib/api";

const ROWS = [
  { key: "category_name", label: "Category" },
  { key: "size", label: "Size" },
  { key: "price", label: "Price / Unit", format: (v) => formatINR(v) },
  { key: "bulk_price", label: "Bulk Price / Unit", format: (v) => (v ? formatINR(v) : "—") },
  { key: "moq", label: "MOQ" },
];

export default function Compare() {
  const { items, remove, clear } = useCompare();

  return (
    <div className="py-12 md:py-16">
      <div className="container-x">
        <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-heading font-bold">Compare Products</h1>
            <p className="text-sm text-slate-500 mt-2">Compare selected products side by side.</p>
          </div>
          {items.length > 0 && (
            <button onClick={clear} className="btn-secondary" data-testid="compare-clear">
              Clear Compare
            </button>
          )}
        </div>

        {items.length === 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-12 text-center">
            <p className="text-lg font-semibold text-slate-900">No products selected for comparison yet.</p>
            <p className="text-sm text-slate-500 mt-2">Tap the compare icon on any product card to add it here.</p>
            <Link to="/products" className="btn-primary mt-6 inline-flex">
              Browse Products
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-separate border-spacing-0" data-testid="compare-table">
              <thead>
                <tr>
                  <th className="text-left p-3 w-40"></th>
                  {items.map((p) => (
                    <th key={p.product_id} className="p-3 min-w-[200px] align-top">
                      <div className="card-premium p-4 text-left">
                        <img src={p.image} alt={p.name} className="w-full aspect-square object-cover rounded-xl mb-3" />
                        <Link to={`/products/${p.slug}`} className="font-heading font-semibold text-slate-900 hover:text-brand-primary transition">
                          {p.name}
                        </Link>
                        <button
                          onClick={() => remove(p.product_id)}
                          className="block mt-2 text-xs text-rose-500 hover:underline"
                          data-testid={`compare-remove-${p.product_id}`}
                        >
                          Remove
                        </button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROWS.map((row) => (
                  <tr key={row.key} className="border-t border-slate-100">
                    <td className="p-3 text-xs uppercase tracking-wider text-slate-500 font-semibold">{row.label}</td>
                    {items.map((p) => (
                      <td key={p.product_id} className="p-3 text-slate-900 font-medium">
                        {row.format ? row.format(p[row.key]) : (p[row.key] ?? "—")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
