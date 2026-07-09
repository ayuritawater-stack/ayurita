import { Link } from "react-router-dom";
import { X, ArrowRight } from "lucide-react";
import { useCompare } from "@/lib/compare";

export default function CompareBar() {
  const { items, remove, clear } = useCompare();
  if (items.length === 0) return null;
  return (
    <div className="fixed bottom-4 right-4 z-40 max-w-xs" data-testid="compare-bar">
      <div className="glass rounded-2xl shadow-2xl p-4 border border-white/60">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs uppercase tracking-wider font-semibold text-brand-primary">
            Compare · {items.length}/4
          </div>
          <button onClick={clear} className="text-xs text-slate-500 hover:text-rose-500">Clear</button>
        </div>
        <div className="flex gap-2 mb-3">
          {items.map((p) => (
            <div key={p.id} className="relative">
              <img src={p.image} alt="" className="w-12 h-12 rounded-lg object-cover bg-slate-100" />
              <button onClick={() => remove(p.id)} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-white shadow flex items-center justify-center">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
        <Link to="/compare" className="btn-primary w-full !py-2 !px-4 text-xs" data-testid="compare-open">
          Compare Now <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
