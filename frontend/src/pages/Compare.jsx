import { Link } from "react-router-dom";
import { useCompare } from "@/lib/compare";
import ProductCard from "@/components/ProductCard";

export default function Compare() {
  const { items, clear } = useCompare();

  return (
    <div className="py-12 md:py-16">
      <div className="container-x">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-heading font-bold">Compare Products</h1>
            <p className="text-sm text-slate-500 mt-2">Compare selected products side by side.</p>
          </div>
          {items.length > 0 && (
            <button
              onClick={clear}
              className="btn-secondary"
              data-testid="compare-clear"
            >
              Clear Compare
            </button>
          )}
        </div>

        {items.length === 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-12 text-center">
            <p className="text-lg font-semibold text-slate-900">No products selected for comparison yet.</p>
            <Link to="/products" className="btn-primary mt-6 inline-flex">
              Browse Products
            </Link>
          </div>
        ) : (
          <div className="grid gap-8">
            {items.map((product) => (
              <ProductCard key={product.product_id} product={product} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
