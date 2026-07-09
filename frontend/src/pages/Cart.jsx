import { Link } from "react-router-dom";
import { Minus, Plus, Trash2, ShoppingBag, ArrowRight } from "lucide-react";
import { useCart } from "@/lib/cart";
import { formatINR } from "@/lib/api";

export default function Cart() {
  const { items, removeItem, updateQty, subtotal } = useCart();

  if (items.length === 0) {
    return (
      <div className="py-24">
        <div className="container-x max-w-xl text-center">
          <div className="w-20 h-20 rounded-full bg-sky-50 text-brand-primary flex items-center justify-center mx-auto mb-6">
            <ShoppingBag className="w-9 h-9" strokeWidth={1.5} />
          </div>
          <h1 className="h-section">Your cart is empty</h1>
          <p className="text-slate-600 mt-3">Explore our range of premium water products and start your order.</p>
          <Link to="/products" className="btn-primary mt-8 inline-flex" data-testid="empty-cart-cta">
            Browse Products <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  const gst = subtotal * 0.18;
  const shipping = subtotal >= 500 ? 0 : 50;
  const total = subtotal + gst + shipping;

  return (
    <div className="py-12 md:py-16">
      <div className="container-x">
        <h1 className="h-hero !text-4xl md:!text-5xl">Your Cart</h1>
        <p className="text-slate-600 mt-2 mb-10">{items.length} product{items.length > 1 ? "s" : ""} in your cart</p>

        <div className="grid lg:grid-cols-[1fr_400px] gap-8">
          <div className="space-y-4" data-testid="cart-items">
            {items.map((item) => {
              const price = item.bulk_price && item.quantity >= (item.moq || 1) * 10 ? item.bulk_price : item.price;
              return (
                <div key={item.product_id} className="card-premium p-4 flex gap-4 items-center" data-testid={`cart-item-${item.slug}`}>
                  <img src={item.image} alt={item.name} className="w-24 h-24 rounded-xl object-cover bg-slate-100" />
                  <div className="flex-1 min-w-0">
                    <Link to={`/products/${item.slug}`} className="font-heading font-semibold text-slate-900 hover:text-brand-primary">
                      {item.name}
                    </Link>
                    <div className="text-xs text-slate-500 mt-1">{item.size} · {formatINR(price)}/unit</div>
                  </div>
                  <div className="inline-flex items-center bg-slate-100 rounded-full p-1">
                    <button
                      onClick={() => updateQty(item.product_id, item.quantity - 1)}
                      className="w-8 h-8 rounded-full bg-white flex items-center justify-center"
                      data-testid={`decrease-qty-${item.slug}`}
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <div className="w-10 text-center text-sm font-semibold">{item.quantity}</div>
                    <button
                      onClick={() => updateQty(item.product_id, item.quantity + 1)}
                      className="w-8 h-8 rounded-full bg-white flex items-center justify-center"
                      data-testid={`increase-qty-${item.slug}`}
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="text-right w-28">
                    <div className="font-heading font-bold text-slate-900">{formatINR(price * item.quantity)}</div>
                  </div>
                  <button
                    onClick={() => removeItem(item.product_id)}
                    className="w-9 h-9 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center hover:bg-rose-100 transition"
                    data-testid={`remove-item-${item.slug}`}
                    aria-label="Remove item"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>

          <aside className="card-premium p-6 h-fit lg:sticky lg:top-24" data-testid="cart-summary">
            <div className="font-heading font-bold text-lg text-slate-900 mb-4">Order Summary</div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-slate-600">Subtotal</span><span className="font-semibold">{formatINR(subtotal)}</span></div>
              <div className="flex justify-between"><span className="text-slate-600">GST (18%)</span><span className="font-semibold">{formatINR(gst)}</span></div>
              <div className="flex justify-between"><span className="text-slate-600">Shipping</span><span className="font-semibold">{shipping === 0 ? "Free" : formatINR(shipping)}</span></div>
              <div className="border-t border-slate-100 pt-3 mt-3 flex justify-between items-center">
                <span className="text-slate-900 font-semibold">Grand Total</span>
                <span className="font-heading font-bold text-2xl text-slate-900" data-testid="cart-total">{formatINR(total)}</span>
              </div>
            </div>
            <Link to="/checkout" className="btn-primary w-full mt-6" data-testid="checkout-btn">
              Proceed to Checkout <ArrowRight className="w-4 h-4" />
            </Link>
            <Link to="/products" className="block text-center mt-3 text-sm text-slate-500 hover:text-brand-primary">
              Continue shopping
            </Link>
          </aside>
        </div>
      </div>
    </div>
  );
}
