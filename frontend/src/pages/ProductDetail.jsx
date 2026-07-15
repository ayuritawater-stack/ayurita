import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { ShoppingCart, MessageCircle, Minus, Plus, ShieldCheck, Truck, Package, ChevronRight, Heart } from "lucide-react";
import { api, formatINR } from "@/lib/api";
import { useSettings } from "@/lib/settings";
import { useCart } from "@/lib/cart";
import { useWishlist } from "@/lib/wishlist";
import ProductCard from "@/components/ProductCard";

export default function ProductDetail() {
  const BUSINESS = useSettings();
  const { slug } = useParams();
  const { addItem } = useCart();
  const { toggle: toggleWl, has: inWl } = useWishlist();
  const [product, setProduct] = useState(null);
  const [related, setRelated] = useState([]);
  const [qty, setQty] = useState(1);
  const [activeImg, setActiveImg] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get(`/products/${slug}`)
      .then(async (r) => {
        setProduct(r.data);
        setQty(r.data.moq || 1);
        setActiveImg(0);
        const rel = await api.get("/products", { params: { category: r.data.category_id, limit: 4 } });
        setRelated(rel.data.filter((p) => p.id !== r.data.id).slice(0, 3));
      })
      .catch(() => setProduct(null))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return <div className="container-x py-24 text-center text-slate-500">Loading…</div>;
  }
  if (!product) {
    return (
      <div className="container-x py-24 text-center">
        <div className="text-slate-500">Product not found.</div>
        <Link to="/products" className="btn-primary mt-6">Browse Products</Link>
      </div>
    );
  }

  const unitPrice = product.bulk_price && qty >= (product.moq || 1) * 10 ? product.bulk_price : product.price;
  const gstAmount = (unitPrice * qty) * (product.gst_rate / 100);
  const grandTotal = (unitPrice * qty) + gstAmount;

  const onAdd = () => {
    addItem(product, qty);
    toast.success(`${product.name} added to cart`, { description: `Quantity: ${qty}` });
  };

  const whatsappUrl = `https://wa.me/${BUSINESS.whatsapp}?text=${encodeURIComponent(
    `Hi Ayurita, I'm interested in ${product.name} (${product.size}). Quantity: ${qty}. Please share bulk pricing.`,
  )}`;

  return (
    <div className="py-12 md:py-16">
      <div className="container-x">
        <nav className="flex items-center gap-1 text-xs text-slate-500 mb-8" data-testid="breadcrumb">
          <Link to="/" className="hover:text-brand-primary">Home</Link>
          <ChevronRight className="w-3 h-3" />
          <Link to="/products" className="hover:text-brand-primary">Products</Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-slate-900 font-semibold">{product.name}</span>
        </nav>

        <div className="grid lg:grid-cols-2 gap-12">
          {/* Gallery */}
          <div>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="aspect-square rounded-3xl overflow-hidden bg-gradient-to-br from-sky-50 to-slate-50 mb-4"
            >
              <img src={product.images?.[activeImg]} alt={product.name} className="w-full h-full object-cover" />
            </motion.div>
            <div className="grid grid-cols-4 gap-3">
              {product.images?.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setActiveImg(i)}
                  className={`aspect-square rounded-xl overflow-hidden border-2 transition ${activeImg === i ? "border-brand-primary" : "border-transparent hover:border-slate-200"}`}
                  data-testid={`gallery-thumb-${i}`}
                >
                  <img src={img} alt={`${product.name} ${i + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>

          {/* Details */}
          <div>
            <div className="text-xs uppercase tracking-widest text-slate-500 font-semibold">{product.category_name}</div>
            <h1 className="font-heading font-bold text-3xl md:text-4xl tracking-tight text-slate-900 mt-2" data-testid="product-title">{product.name}</h1>
            <div className="flex flex-wrap gap-2 mt-4">
              <span className="chip">{product.size}</span>
              {product.featured && <span className="chip !bg-emerald-50 !text-brand-emerald">Featured</span>}
              <span className={`chip ${product.stock > 0 ? "!bg-emerald-50 !text-brand-emerald" : "!bg-rose-50 !text-rose-600"}`}>
                {product.stock > 0 ? "In Stock" : "Out of Stock"}
              </span>
            </div>

            <div className="mt-6 pb-6 border-b border-slate-100">
              <div className="text-xs text-slate-500 uppercase tracking-wider">Unit Price</div>
              <div className="flex items-end gap-3 mt-1">
                <div className="text-4xl font-heading font-bold text-slate-900" data-testid="product-price">{formatINR(unitPrice)}</div>
                {product.bulk_price && product.bulk_price < product.price && (
                  <div className="text-sm text-slate-400 line-through pb-1">{formatINR(product.price)}</div>
                )}
                <div className="text-sm text-slate-500 pb-1">/ unit</div>
              </div>
              <div className="text-xs text-slate-500 mt-1">Excludes {product.gst_rate}% GST</div>
            </div>

            <p className="text-slate-600 mt-6 leading-relaxed">{product.description}</p>

            {/* Specs */}
            <div className="grid grid-cols-2 gap-3 mt-6" data-testid="product-specs">
              {[
                { label: "Size", value: product.size },
                { label: "Packaging", value: product.packaging || "—" },
                { label: "MOQ", value: `${product.moq} units` },
                { label: "GST", value: `${product.gst_rate}%` },
              ].map((s) => (
                <div key={s.label} className="p-3 rounded-xl bg-slate-50">
                  <div className="text-[10px] uppercase tracking-wider text-slate-500">{s.label}</div>
                  <div className="text-sm font-semibold text-slate-900 mt-0.5">{s.value}</div>
                </div>
              ))}
            </div>

            {product.bulk_price && (
              <div className="mt-4 p-4 rounded-2xl border border-emerald-100 bg-emerald-50/50">
                <div className="text-xs font-semibold text-brand-emerald uppercase tracking-wider">Bulk pricing available</div>
                <div className="text-sm text-slate-700 mt-1">
                  Order {(product.moq || 1) * 10}+ units at {formatINR(product.bulk_price)}/unit — save {formatINR(product.price - product.bulk_price)} per unit.
                </div>
              </div>
            )}

            {/* Qty + CTAs */}
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center bg-slate-100 rounded-full p-1" data-testid="qty-selector">
                <button
                  onClick={() => setQty((q) => Math.max(product.moq || 1, q - 1))}
                  className="w-10 h-10 rounded-full bg-white flex items-center justify-center hover:bg-slate-50"
                  aria-label="Decrease quantity"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <input
                  type="number"
                  min={product.moq || 1}
                  value={qty}
                  onChange={(e) => setQty(Math.max(product.moq || 1, parseInt(e.target.value) || 1))}
                  className="w-16 text-center bg-transparent font-semibold outline-none"
                  data-testid="qty-input"
                />
                <button
                  onClick={() => setQty((q) => q + 1)}
                  className="w-10 h-10 rounded-full bg-white flex items-center justify-center hover:bg-slate-50"
                  aria-label="Increase quantity"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <button className="btn-primary" onClick={onAdd} data-testid="add-to-cart-btn">
                <ShoppingCart className="w-4 h-4" /> Add to Cart
              </button>
              <a href={whatsappUrl} target="_blank" rel="noreferrer" className="btn-accent" data-testid="whatsapp-order-btn">
                <MessageCircle className="w-4 h-4" /> WhatsApp Order
              </a>
              <button
                onClick={() => { toggleWl(product); toast.success(inWl(product.id) ? "Removed from wishlist" : "Saved to wishlist"); }}
                className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 border font-semibold text-sm transition ${
                  inWl(product.id) ? "bg-rose-500 text-white border-rose-500" : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                }`}
                data-testid="wl-toggle-detail"
              >
                <Heart className={`w-4 h-4 ${inWl(product.id) ? "fill-current" : ""}`} />
                {inWl(product.id) ? "Saved" : "Save"}
              </button>
              <Link to="/bulk-order" className="btn-secondary">Request Quote</Link>
            </div>

            <div className="mt-6 p-4 rounded-2xl bg-slate-50 flex items-center justify-between text-sm">
              <div className="text-slate-500">Estimated total (incl. GST)</div>
              <div className="font-heading font-bold text-2xl text-slate-900" data-testid="est-total">{formatINR(grandTotal)}</div>
            </div>

            {/* Trust bar */}
            <div className="grid grid-cols-3 gap-3 mt-6">
              {[
                { icon: ShieldCheck, label: "Lab-tested Purity" },
                { icon: Truck, label: "24hr Delivery" },
                { icon: Package, label: "Sealed Packaging" },
              ].map((b) => (
                <div key={b.label} className="flex items-center gap-2 p-3 rounded-xl bg-white border border-slate-100">
                  <b.icon className="w-5 h-5 text-brand-primary" strokeWidth={1.7} />
                  <span className="text-xs font-semibold text-slate-700">{b.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Related */}
        {related.length > 0 && (
          <div className="mt-24">
            <h2 className="h-section mb-8">Related Products</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {related.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
