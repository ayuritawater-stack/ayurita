import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ShoppingCart, ArrowUpRight, Heart, Scale } from "lucide-react";
import { formatINR } from "@/lib/api";
import { useCart } from "@/lib/cart";
import { useWishlist } from "@/lib/wishlist";
import { useCompare } from "@/lib/compare";
import { isFlashSaleActive } from "@/lib/pricing";
import { toast } from "sonner";

export default function ProductCard({ product, index = 0 }) {
  const { addItem } = useCart();
  const { toggle: toggleWl, has: inWl } = useWishlist();
  const { toggle: toggleCompare, has: inCompare } = useCompare();
  const onSale = isFlashSaleActive(product);

  const handleAdd = (e) => {
    e.preventDefault();
    e.stopPropagation();
    addItem(product, product.moq || 1);
    toast.success(`${product.name} added to cart`, { description: `MOQ ${product.moq || 1} units` });
  };
  const handleWl = (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleWl(product);
    toast.success(inWl(product.id) ? "Removed from wishlist" : "Saved to wishlist");
  };
  const handleCompare = (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleCompare(product);
    toast.success(inCompare(product.id) ? "Removed from compare" : "Added to compare");
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
      className="card-premium overflow-hidden group flex flex-col"
      data-testid={`product-card-${product.slug}`}
    >
      <Link to={`/products/${product.slug}`} className="block relative overflow-hidden bg-gradient-to-br from-sky-50 to-slate-50 aspect-[4/3]">
        <img
          src={product.images?.[0]}
          alt={product.name}
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
        <div className="absolute top-3 left-3 flex gap-2">
          <span className="chip !bg-white/90 !text-brand-primary">{product.size}</span>
          {product.featured && (
            <span className="chip !bg-emerald-50 !text-brand-emerald">Featured</span>
          )}
          {onSale && (
            <span className="chip !bg-rose-500 !text-white">Sale</span>
          )}
        </div>
        <div className="absolute top-3 right-3 flex flex-col gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
          <button
            onClick={handleWl}
            className={`w-9 h-9 rounded-full backdrop-blur-md shadow-md flex items-center justify-center transition ${
              inWl(product.id) ? "bg-rose-500 text-white" : "bg-white/90 text-slate-700 hover:bg-white"
            }`}
            data-testid={`wl-toggle-${product.slug}`}
            aria-label="Toggle wishlist"
          >
            <Heart className={`w-4 h-4 ${inWl(product.id) ? "fill-current" : ""}`} />
          </button>
          <button
            onClick={handleCompare}
            className={`w-9 h-9 rounded-full backdrop-blur-md shadow-md flex items-center justify-center transition ${
              inCompare(product.id) ? "bg-brand-primary text-white" : "bg-white/90 text-slate-700 hover:bg-white"
            }`}
            data-testid={`compare-toggle-${product.slug}`}
            aria-label="Toggle compare"
          >
            <Scale className="w-4 h-4" />
          </button>
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      </Link>

      <div className="p-5 flex flex-col flex-1">
        <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">{product.category_name}</div>
        <Link to={`/products/${product.slug}`} className="font-heading font-semibold text-slate-900 text-lg leading-tight hover:text-brand-primary transition">
          {product.name}
        </Link>
        <p className="text-xs text-slate-500 mt-1 line-clamp-2">{product.description}</p>

        <div className="flex items-end justify-between mt-4 pt-4 border-t border-slate-100">
          <div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider">From</div>
            <div className="text-xl font-bold text-slate-900 font-heading">
              {onSale ? (
                <>
                  <span className="text-rose-600">{formatINR(product.sale_price)}</span>
                  <span className="text-sm font-medium text-slate-400 line-through ml-1.5">{formatINR(product.price)}</span>
                </>
              ) : (
                formatINR(product.bulk_price || product.price)
              )}
              <span className="text-xs font-medium text-slate-500 ml-1">/ unit</span>
            </div>
            {product.moq > 1 && (
              <div className="text-[11px] text-brand-emerald font-medium mt-0.5">MOQ · {product.moq}</div>
            )}
          </div>
          <div className="flex gap-1.5">
            <button
              onClick={handleAdd}
              className="w-10 h-10 rounded-full bg-brand-primary text-white flex items-center justify-center hover:bg-brand-primary-hover transition"
              data-testid={`add-to-cart-${product.slug}`}
              aria-label="Add to cart"
            >
              <ShoppingCart className="w-4 h-4" />
            </button>
            <Link
              to={`/products/${product.slug}`}
              className="w-10 h-10 rounded-full bg-slate-50 text-slate-700 flex items-center justify-center hover:bg-slate-100 transition"
              aria-label="View product"
            >
              <ArrowUpRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
