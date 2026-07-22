import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { ShoppingCart, MessageCircle, Minus, Plus, ShieldCheck, Truck, Package, ChevronRight, Heart, Star, HelpCircle } from "lucide-react";
import { api, formatINR, isCustomerLoggedIn } from "@/lib/api";
import { useSettings } from "@/lib/settings";
import { useCart } from "@/lib/cart";
import { useWishlist } from "@/lib/wishlist";
import { isFlashSaleActive, effectivePrice } from "@/lib/pricing";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import ProductCard from "@/components/ProductCard";

export default function ProductDetail() {
  const BUSINESS = useSettings();
  const navigate = useNavigate();
  const { slug } = useParams();
  const { addItem } = useCart();
  const { toggle: toggleWl, has: inWl } = useWishlist();
  const [product, setProduct] = useState(null);
  const [related, setRelated] = useState([]);
  const [qty, setQty] = useState(1);
  const [activeImg, setActiveImg] = useState(0);
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState([]);
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: "" });
  const [submittingReview, setSubmittingReview] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [questionForm, setQuestionForm] = useState({ name: "", question: "" });
  const [submittingQuestion, setSubmittingQuestion] = useState(false);
  const [bundleSelected, setBundleSelected] = useState({});

  useEffect(() => {
    setLoading(true);
    api.get(`/products/${slug}`)
      .then(async (r) => {
        setProduct(r.data);
        setQty(r.data.moq || 1);
        setActiveImg(0);
        const initSel = { [r.data.id]: true };
        (r.data.frequently_bought_together || []).forEach((p) => { initSel[p.id] = true; });
        setBundleSelected(initSel);
        const rel = await api.get("/products", { params: { category: r.data.category_id, limit: 4 } });
        setRelated(rel.data.filter((p) => p.id !== r.data.id).slice(0, 3));
        const rev = await api.get(`/products/${r.data.id}/reviews`);
        setReviews(rev.data);
        const qs = await api.get(`/questions/product/${r.data.id}`);
        setQuestions(qs.data);
      })
      .catch(() => setProduct(null))
      .finally(() => setLoading(false));
  }, [slug]);

  const submitReview = async (e) => {
    e.preventDefault();
    setSubmittingReview(true);
    try {
      await api.post(`/products/${product.id}/reviews`, reviewForm);
      toast.success("Thanks! Your review is submitted and will appear once approved.");
      setReviewForm({ rating: 5, comment: "" });
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to submit review");
    } finally {
      setSubmittingReview(false);
    }
  };

  const submitQuestion = async (e) => {
    e.preventDefault();
    setSubmittingQuestion(true);
    try {
      await api.post("/questions", { ...questionForm, product_id: product.id });
      toast.success("Thanks! Your question will appear here once answered.");
      setQuestionForm({ name: "", question: "" });
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to submit question");
    } finally {
      setSubmittingQuestion(false);
    }
  };

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

  const onSale = isFlashSaleActive(product);
  const unitPrice = effectivePrice(product, qty);
  const gstAmount = (unitPrice * qty) * (product.gst_rate / 100);
  const grandTotal = (unitPrice * qty) + gstAmount;

  const onAdd = () => {
    addItem(product, qty);
    toast.success(`${product.name} added to cart`, { description: `Quantity: ${qty}` });
  };

  const bundleItems = [product, ...(product.frequently_bought_together || [])];
  const toggleBundleItem = (id) => setBundleSelected((s) => ({ ...s, [id]: !s[id] }));
  const bundleTotal = bundleItems
    .filter((p) => bundleSelected[p.id])
    .reduce((sum, p) => sum + effectivePrice(p, p.moq || 1) * (p.moq || 1), 0);
  const addBundleToCart = () => {
    const chosen = bundleItems.filter((p) => bundleSelected[p.id]);
    chosen.forEach((p) => addItem(p, p.moq || 1));
    toast.success(`${chosen.length} item(s) added to cart`);
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
            {product.review_count > 0 && (
              <div className="flex items-center gap-1.5 mt-2" data-testid="product-rating">
                <div className="flex items-center">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star key={n} className={`w-4 h-4 ${n <= Math.round(product.rating) ? "fill-amber-400 text-amber-400" : "text-slate-300"}`} />
                  ))}
                </div>
                <span className="text-sm font-semibold text-slate-700">{product.rating?.toFixed(1)}</span>
                <span className="text-xs text-slate-500">({product.review_count} review{product.review_count === 1 ? "" : "s"})</span>
              </div>
            )}
            <div className="flex flex-wrap gap-2 mt-4">
              <span className="chip">{product.size}</span>
              {product.featured && <span className="chip !bg-emerald-50 !text-brand-emerald">Featured</span>}
              {onSale && <span className="chip !bg-rose-500 !text-white">Flash Sale</span>}
              <span className={`chip ${product.stock > 0 ? "!bg-emerald-50 !text-brand-emerald" : "!bg-rose-50 !text-rose-600"}`}>
                {product.stock > 0 ? "In Stock" : "Out of Stock"}
              </span>
            </div>

            {product.variants && product.variants.length > 1 && (
              <div className="mt-4">
                <div className="text-xs text-slate-500 mb-1.5">Size: <span className="font-semibold text-slate-900">{product.variant_label || product.size}</span></div>
                <div className="flex flex-wrap gap-2" data-testid="variant-selector">
                  {product.variants.map((v) => {
                    const isActive = v.id === product.id;
                    const outOfStock = (v.stock || 0) <= 0;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        disabled={isActive}
                        onClick={() => navigate(`/products/${v.slug || v.id}`)}
                        data-testid={`variant-${v.id}`}
                        className={`rounded-xl border px-3 py-1.5 text-sm text-left min-w-[5.5rem] transition ${isActive ? "border-brand-primary ring-1 ring-brand-primary bg-sky-50" : "border-slate-200 hover:border-brand-primary/60"} ${outOfStock ? "opacity-50" : ""}`}
                      >
                        <div className="font-semibold text-slate-900">{v.variant_label || "Option"}</div>
                        <div className="text-xs text-slate-500">{formatINR(v.price)}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="mt-6 pb-6 border-b border-slate-100">
              <div className="text-xs text-slate-500 uppercase tracking-wider">Unit Price</div>
              <div className="flex items-end gap-3 mt-1">
                <div className={`text-4xl font-heading font-bold ${onSale ? "text-rose-600" : "text-slate-900"}`} data-testid="product-price">{formatINR(unitPrice)}</div>
                {(onSale || (product.bulk_price && product.bulk_price < product.price)) && (
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

            {product.specs && Object.keys(product.specs).length > 0 && (
              <div className="mt-6" data-testid="product-additional-specs">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Specifications</div>
                <div className="rounded-xl border border-slate-100 divide-y divide-slate-100 overflow-hidden">
                  {Object.entries(product.specs).map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between px-4 py-2 text-sm odd:bg-slate-50">
                      <span className="text-slate-500">{k}</span>
                      <span className="font-medium text-slate-900">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

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

        {/* Reviews */}
        <div className="mt-24 max-w-3xl">
          <h2 className="h-section mb-8">Customer Reviews</h2>

          {isCustomerLoggedIn() && (
            <form onSubmit={submitReview} className="card-premium p-5 mb-6 space-y-3">
              <div className="text-sm font-semibold text-slate-900">Write a review</div>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setReviewForm((f) => ({ ...f, rating: n }))}
                    aria-label={`${n} star${n === 1 ? "" : "s"}`}
                    data-testid={`review-star-${n}`}
                  >
                    <Star className={`w-6 h-6 ${n <= reviewForm.rating ? "fill-amber-400 text-amber-400" : "text-slate-300"}`} />
                  </button>
                ))}
              </div>
              <textarea
                placeholder="Share your experience with this product (optional)"
                value={reviewForm.comment}
                onChange={(e) => setReviewForm((f) => ({ ...f, comment: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 p-3 text-sm min-h-[80px]"
                data-testid="review-comment-input"
              />
              <div className="flex justify-end">
                <button type="submit" className="btn-primary" disabled={submittingReview} data-testid="submit-review-btn">
                  {submittingReview ? "Submitting…" : "Submit Review"}
                </button>
              </div>
              <p className="text-xs text-slate-500">Only customers with a delivered order for this product can review it. Reviews are checked before appearing publicly.</p>
            </form>
          )}

          {reviews.length === 0 ? (
            <p className="text-sm text-slate-500">No reviews yet.</p>
          ) : (
            <div className="space-y-4">
              {reviews.map((r) => (
                <div key={r.id} className="border-b border-slate-100 pb-4" data-testid={`review-${r.id}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Star key={n} className={`w-3.5 h-3.5 ${n <= r.rating ? "fill-amber-400 text-amber-400" : "text-slate-300"}`} />
                        ))}
                      </div>
                      <span className="text-sm font-semibold text-slate-900">{r.business_name}</span>
                    </div>
                    <span className="text-xs text-slate-400">{r.created_at?.slice(0, 10)}</span>
                  </div>
                  {r.comment && <p className="text-sm text-slate-600 mt-2">{r.comment}</p>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Q&A */}
        <div className="mt-24 max-w-3xl">
          <div className="flex items-center justify-between gap-4 mb-8">
            <h2 className="h-section mb-0">Questions &amp; Answers</h2>
            <Dialog>
              <DialogTrigger asChild>
                <button className="btn-secondary" data-testid="open-question-dialog">
                  <HelpCircle className="w-4 h-4" /> Ask a Question
                </button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Ask a Question</DialogTitle></DialogHeader>
                <form onSubmit={submitQuestion} className="space-y-3">
                  <Input
                    required
                    placeholder="Your name"
                    value={questionForm.name}
                    onChange={(e) => setQuestionForm({ ...questionForm, name: e.target.value })}
                    className="rounded-xl"
                    data-testid="question-name-input"
                  />
                  <textarea
                    required
                    placeholder="What would you like to know about this product?"
                    rows={4}
                    value={questionForm.question}
                    onChange={(e) => setQuestionForm({ ...questionForm, question: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 p-3 text-sm"
                    data-testid="question-text-input"
                  />
                  <button type="submit" className="btn-primary w-full justify-center" disabled={submittingQuestion} data-testid="submit-question-button">
                    {submittingQuestion ? "Submitting…" : "Submit Question"}
                  </button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {questions.length === 0 ? (
            <p className="text-sm text-slate-500">No questions yet. Ask us anything about this product!</p>
          ) : (
            <div className="space-y-4">
              {questions.map((q) => (
                <div key={q.id} className="border-b border-slate-100 pb-4" data-testid={`question-${q.id}`}>
                  <div className="flex items-start gap-2">
                    <HelpCircle className="w-4 h-4 mt-0.5 text-brand-primary shrink-0" />
                    <div className="text-sm font-semibold text-slate-900">{q.question}</div>
                  </div>
                  <div className="text-xs text-slate-400 mt-1 ml-6">— {q.name}</div>
                  {q.answer && <p className="text-sm text-slate-600 mt-2 ml-6 border-l-2 border-brand-primary/30 pl-3">{q.answer}</p>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Frequently bought together */}
        {product.frequently_bought_together?.length > 0 && (
          <div className="mt-24">
            <h2 className="h-section mb-8">Frequently Bought Together</h2>
            <div className="card-premium p-5">
              <div className="flex flex-wrap items-stretch gap-3">
                {bundleItems.map((p, i) => (
                  <div key={p.id} className="flex items-center gap-2">
                    <label className="flex items-center gap-2 border border-slate-200 rounded-xl p-2 cursor-pointer min-w-[9rem]">
                      <input
                        type="checkbox"
                        checked={!!bundleSelected[p.id]}
                        onChange={() => toggleBundleItem(p.id)}
                        data-testid={`bundle-item-${p.id}`}
                      />
                      <img src={p.images?.[0]} alt={p.name} className="h-12 w-12 rounded-lg object-cover bg-slate-100" />
                      <div className="min-w-0">
                        <div className="text-xs text-slate-700 line-clamp-2">{p.name}{p.id === product.id ? " (this item)" : ""}</div>
                        <div className="text-xs font-semibold text-slate-900">{formatINR(effectivePrice(p, p.moq || 1))}</div>
                      </div>
                    </label>
                    {i < bundleItems.length - 1 && <div className="text-slate-400 font-bold">+</div>}
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between flex-wrap gap-3 pt-4 border-t border-slate-100">
                <div className="text-sm text-slate-600">Total for selected: <span className="font-heading font-bold text-lg text-slate-900">{formatINR(bundleTotal)}</span></div>
                <button onClick={addBundleToCart} className="btn-primary" data-testid="add-bundle-to-cart">
                  <ShoppingCart className="w-4 h-4" /> Add Selected to Cart
                </button>
              </div>
            </div>
          </div>
        )}

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
