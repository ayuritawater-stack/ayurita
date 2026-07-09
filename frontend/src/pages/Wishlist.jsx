import { Link, useNavigate } from "react-router-dom";
import { Heart, Trash2, ShoppingCart, ArrowRight } from "lucide-react";
import { useWishlist } from "@/lib/wishlist";
import { useCart } from "@/lib/cart";
import { formatINR } from "@/lib/api";
import { toast } from "sonner";

export default function Wishlist() {
  const { items, remove, clear } = useWishlist();
  const { addItem } = useCart();
  const nav = useNavigate();

  const moveAllToCart = () => {
    items.forEach((i) => addItem({ id: i.product_id, name: i.name, slug: i.slug, size: i.size, price: i.price, bulk_price: i.bulk_price, moq: i.moq, images: [i.image] }, i.moq || 1));
    clear();
    toast.success("All items moved to cart");
    nav("/cart");
  };

  if (items.length === 0) {
    return (
      <div className="py-24">
        <div className="container-x max-w-xl text-center">
          <div className="w-20 h-20 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center mx-auto mb-6">
            <Heart className="w-9 h-9" strokeWidth={1.5} />
          </div>
          <h1 className="h-section">Your wishlist is empty</h1>
          <p className="text-slate-600 mt-3">Save products you love and revisit them anytime.</p>
          <Link to="/products" className="btn-primary mt-8 inline-flex" data-testid="wishlist-browse-cta">
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
            <div className="text-eyebrow mb-3">Wishlist</div>
            <h1 className="h-hero !text-4xl md:!text-5xl">Saved for later</h1>
            <p className="text-slate-600 mt-2">{items.length} product{items.length > 1 ? "s" : ""}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={moveAllToCart} className="btn-primary" data-testid="move-all-to-cart">
              <ShoppingCart className="w-4 h-4" /> Move all to cart
            </button>
            <button onClick={clear} className="btn-secondary" data-testid="clear-wishlist">Clear all</button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((i) => (
            <div key={i.product_id} className="card-premium overflow-hidden" data-testid={`wl-${i.slug}`}>
              <Link to={`/products/${i.slug}`} className="block aspect-[4/3] overflow-hidden bg-slate-50">
                <img src={i.image} alt={i.name} className="w-full h-full object-cover" />
              </Link>
              <div className="p-5">
                <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold">{i.category_name}</div>
                <Link to={`/products/${i.slug}`} className="block font-heading font-semibold text-slate-900 mt-1 hover:text-brand-primary">
                  {i.name}
                </Link>
                <div className="mt-3 flex items-end justify-between">
                  <div className="font-heading font-bold text-lg text-slate-900">
                    {formatINR(i.bulk_price || i.price)}
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => { addItem({ id: i.product_id, name: i.name, slug: i.slug, size: i.size, price: i.price, bulk_price: i.bulk_price, moq: i.moq, images: [i.image] }, i.moq || 1); toast.success("Added to cart"); }}
                      className="w-9 h-9 rounded-full bg-brand-primary text-white flex items-center justify-center"
                      data-testid={`wl-add-${i.slug}`}
                      aria-label="Add to cart"
                    >
                      <ShoppingCart className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => remove(i.product_id)}
                      className="w-9 h-9 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center"
                      data-testid={`wl-remove-${i.slug}`}
                      aria-label="Remove from wishlist"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
